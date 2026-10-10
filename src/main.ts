import { Actor, log } from 'apify';

import { applyMonitoring, sanitizeMonitorName, toCsv } from './monitoring.js';
import { parseSpotifyInput, scrapeSpotifyItem } from './spotify.js';
import type { ActorInput, MonitorReportRow, ParsedSpotifyInput, ProxyUrlProvider } from './types.js';

await Actor.init();

try {
    const input = await Actor.getInput<ActorInput>();
    if (!input?.startUrls?.length) {
        throw new Error('Input must contain at least one Spotify URL or URI in startUrls.');
    }

    const maxItems = clampInteger(input.maxItems, 1, 10_000, 1);
    const maxConcurrency = clampInteger(input.maxConcurrency, 1, 20, 1);
    const trackChanges = input.trackChanges ?? false;
    const monitorName = sanitizeMonitorName(input.monitorName);
    const onlyChanged = trackChanges && (input.onlyChanged ?? false);
    const historyLimit = clampInteger(input.historyLimit, 2, 100, 30);
    const proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration);
    const parsedInputs = deduplicateInputs(input.startUrls, maxItems);
    const failedDataset = await Actor.openDataset('failed-urls');

    let nextIndex = 0;
    let savedCount = 0;
    let failedCount = 0;
    let unchangedSuppressedCount = 0;
    let spendingLimitReached = false;
    const monitorReport: MonitorReportRow[] = [];

    const worker = async (): Promise<void> => {
        while (!spendingLimitReached) {
            const currentIndex = nextIndex++;
            const current = parsedInputs[currentIndex];
            if (!current) return;

            let record;
            try {
                log.info(`Scraping ${current.type}: ${current.canonicalUrl}`);
                record = await scrapeSpotifyItem(
                    current,
                    proxyConfiguration as ProxyUrlProvider | undefined,
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                failedCount++;
                log.warning(`Failed ${current.sourceUrl}: ${message}`);
                await failedDataset.pushData({
                    sourceUrl: current.sourceUrl,
                    error: message,
                    failedAt: new Date().toISOString(),
                });
                continue;
            }

            const monitoredRecord = await applyMonitoring(record, {
                enabled: trackChanges,
                monitorName,
                historyLimit,
            });
            const emitRecord = !onlyChanged || monitoredRecord.changeStatus !== 'unchanged';
            monitorReport.push({
                spotifyUri: monitoredRecord.spotifyUri,
                type: monitoredRecord.type,
                name: monitoredRecord.name,
                url: monitoredRecord.url,
                changeStatus: monitoredRecord.changeStatus,
                changeDetected: monitoredRecord.changeDetected,
                changeReasons: monitoredRecord.changeReasons,
                observationCount: monitoredRecord.observationCount,
                previousObservedAt: monitoredRecord.previousObservedAt,
                observedAt: monitoredRecord.scrapedAt,
                addedTrackCount: monitoredRecord.addedTracks.length,
                removedTrackCount: monitoredRecord.removedTracks.length,
                trackOrderChanged: monitoredRecord.trackOrderChanged,
                newFeaturedItemDetected: monitoredRecord.newFeaturedItemDetected,
                emitted: emitRecord,
            });

            if (!emitRecord) {
                unchangedSuppressedCount += 1;
                log.info(`No change for ${monitoredRecord.spotifyUri}; output and item charge suppressed.`);
                continue;
            }

            // Another worker may have reached the spending limit while this request was in flight.
            if (spendingLimitReached) return;

            const chargeResult = await Actor.pushData(monitoredRecord, 'spotify-item');
            const recordWasSaved = chargeResult.chargedCount > 0 || !chargeResult.eventChargeLimitReached;
            if (recordWasSaved) {
                savedCount += 1;
            }

            if (chargeResult.eventChargeLimitReached) {
                spendingLimitReached = true;
                const message = `Stopped at the user's spending limit after ${savedCount} Spotify item(s).`;
                await Actor.setStatusMessage(message);
                log.warning(message);
                return;
            }
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(maxConcurrency, parsedInputs.length) }, () => worker()),
    );

    const report = {
        schemaVersion: 1,
        monitorName: trackChanges ? monitorName : null,
        trackChanges,
        onlyChanged,
        requestedUniqueItems: parsedInputs.length,
        savedItems: savedCount,
        unchangedSuppressedItems: unchangedSuppressedCount,
        failedItems: failedCount,
        spendingLimitReached,
        baselineItems: monitorReport.filter((row) => row.changeStatus === 'baseline').length,
        changedItems: monitorReport.filter((row) => row.changeStatus === 'changed').length,
        unchangedItems: monitorReport.filter((row) => row.changeStatus === 'unchanged').length,
        generatedAt: new Date().toISOString(),
        items: monitorReport,
    };
    await Actor.setValue('OUTPUT', report);
    await Actor.setValue('MONITORING-REPORT', report);
    await Actor.setValue('MONITORING-REPORT.csv', toCsv(monitorReport as unknown as Array<Record<string, unknown>>), {
        contentType: 'text/csv; charset=utf-8',
    });

    if (!spendingLimitReached) {
        const message = `Finished: ${savedCount} saved, ${unchangedSuppressedCount} unchanged suppressed, ${failedCount} failed.`;
        await Actor.setStatusMessage(message);
        log.info(message);
    }
    if (savedCount === 0 && unchangedSuppressedCount === 0 && !spendingLimitReached) {
        throw new Error('No Spotify records were saved. Check the failed-urls dataset.');
    }
} finally {
    await Actor.exit();
}

function deduplicateInputs(values: string[], maxItems: number): ParsedSpotifyInput[] {
    const unique = new Map<string, ParsedSpotifyInput>();

    for (const value of values) {
        try {
            const parsed = parseSpotifyInput(value);
            unique.set(parsed.spotifyUri, parsed);
            if (unique.size >= maxItems) break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.warning(message);
        }
    }

    if (unique.size === 0) throw new Error('No supported Spotify URLs or URIs were found in startUrls.');
    return [...unique.values()];
}

function clampInteger(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
    if (!Number.isInteger(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, value as number));
}
