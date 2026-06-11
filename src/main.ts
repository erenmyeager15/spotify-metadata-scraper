import { Actor, log } from 'apify';

import { parseSpotifyInput, scrapeSpotifyItem } from './spotify.js';
import type { ActorInput, ParsedSpotifyInput, ProxyUrlProvider } from './types.js';

await Actor.init();

try {
    const input = await Actor.getInput<ActorInput>();
    if (!input?.startUrls?.length) {
        throw new Error('Input must contain at least one Spotify URL or URI in startUrls.');
    }

    const maxItems = clampInteger(input.maxItems, 1, 10_000, 100);
    const maxConcurrency = clampInteger(input.maxConcurrency, 1, 20, 5);
    const proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration);
    const parsedInputs = deduplicateInputs(input.startUrls, maxItems);
    const failedDataset = await Actor.openDataset('failed-urls');

    let nextIndex = 0;
    let savedCount = 0;
    let failedCount = 0;

    const worker = async (): Promise<void> => {
        while (true) {
            const currentIndex = nextIndex++;
            const current = parsedInputs[currentIndex];
            if (!current) return;

            try {
                log.info(`Scraping ${current.type}: ${current.canonicalUrl}`);
                const record = await scrapeSpotifyItem(
                    current,
                    proxyConfiguration as ProxyUrlProvider | undefined,
                );
                await Actor.pushData(record);
                await Actor.charge({ eventName: 'spotify-item' });
                savedCount++;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                failedCount++;
                log.warning(`Failed ${current.sourceUrl}: ${message}`);
                await failedDataset.pushData({
                    sourceUrl: current.sourceUrl,
                    error: message,
                    failedAt: new Date().toISOString(),
                });
            }
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(maxConcurrency, parsedInputs.length) }, () => worker()),
    );

    log.info(`Finished. Saved ${savedCount} item(s); ${failedCount} failed.`);
    if (savedCount === 0) throw new Error('No Spotify records were saved. Check the failed-urls dataset.');
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
