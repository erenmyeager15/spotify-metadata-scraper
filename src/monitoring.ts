import { createHash } from 'node:crypto';

import { Actor } from 'apify';

import type {
    CompactItemRecord,
    MonitoredSpotifyRecord,
    SpotifyRecord,
    TrackChangeRecord,
} from './types.js';

export interface Snapshot {
    observedAt: string;
    name: string;
    subtitle: string | null;
    releaseDate: string | null;
    playable: boolean | null;
    trackCount: number;
    tracks: TrackChangeRecord[];
    featuredItemId: string | null;
}

interface MonitorState {
    schemaVersion: 1;
    monitorName: string;
    spotifyUri: string;
    observations: Snapshot[];
}

export interface ApplyMonitoringOptions {
    enabled: boolean;
    monitorName: string;
    historyLimit: number;
}

export async function applyMonitoring(
    record: SpotifyRecord,
    options: ApplyMonitoringOptions,
): Promise<MonitoredSpotifyRecord> {
    if (!options.enabled) return withoutMonitoring(record);

    const store = await Actor.openKeyValueStore(monitorStoreName(options.monitorName));
    const key = monitorStateKey(options.monitorName, record.spotifyUri);
    const previousState = await store.getValue<MonitorState>(key);
    const observations = Array.isArray(previousState?.observations) ? previousState.observations : [];
    const previous = observations.at(-1) ?? null;
    const current = createSnapshot(record);
    const comparison = compareSnapshots(previous, current, record.type);
    const {
        addedTracks,
        removedTracks,
        trackOrderChanged,
        previousFeaturedItemId,
        newFeaturedItemDetected,
        changeReasons,
    } = comparison;
    const changeStatus = previous ? (changeReasons.length > 0 ? 'changed' : 'unchanged') : 'baseline';

    const nextState: MonitorState = {
        schemaVersion: 1,
        monitorName: options.monitorName,
        spotifyUri: record.spotifyUri,
        observations: [...observations, current].slice(-options.historyLimit),
    };
    await store.setValue(key, nextState);

    return {
        ...record,
        monitorName: options.monitorName,
        changeStatus,
        changeDetected: changeStatus === 'changed',
        changeReasons,
        previousObservedAt: previous?.observedAt ?? null,
        observationCount: observations.length + 1,
        previousTrackCount: previous?.trackCount ?? null,
        addedTracks,
        removedTracks,
        trackOrderChanged,
        previousFeaturedItemId,
        newFeaturedItemDetected,
    };
}

export function monitorStateKey(monitorName: string, spotifyUri: string): string {
    const digest = createHash('sha256').update(`${monitorName}\n${spotifyUri}`).digest('hex').slice(0, 32);
    return `ITEM-${digest}`;
}

export function monitorStoreName(monitorName: string): string {
    const digest = createHash('sha256').update(monitorName).digest('hex').slice(0, 20);
    return `spotify-monitor-${digest}`;
}

export function sanitizeMonitorName(value: string | undefined): string {
    const clean = String(value ?? 'default').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return (clean || 'default').slice(0, 80);
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) return 'spotifyUri,type,name,changeStatus,changeDetected,observationCount,observedAt,emitted\r\n';
    const columns = Object.keys(rows[0]);
    const escape = (value: unknown): string => {
        const raw = Array.isArray(value) ? value.join('|') : value == null ? '' : String(value);
        return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };
    return `${columns.join(',')}\r\n${rows.map((row) => columns.map((column) => escape(row[column])).join(',')).join('\r\n')}\r\n`;
}

export function createSnapshot(record: SpotifyRecord): Snapshot {
    return {
        observedAt: record.scrapedAt,
        name: record.name,
        subtitle: record.subtitle,
        releaseDate: record.releaseDate,
        playable: record.playable,
        trackCount: record.trackCount,
        tracks: record.tracks.map(compactTrack),
        featuredItemId: record.featuredItem?.id ?? record.featuredItem?.uri ?? null,
    };
}

export function compareSnapshots(previous: Snapshot | null, current: Snapshot, type: SpotifyRecord['type']) {
    if (!previous) {
        return {
            addedTracks: [] as TrackChangeRecord[],
            removedTracks: [] as TrackChangeRecord[],
            trackOrderChanged: false,
            previousFeaturedItemId: null,
            newFeaturedItemDetected: false,
            changeReasons: [] as string[],
        };
    }

    const addedTracks = difference(current.tracks, previous.tracks);
    const removedTracks = difference(previous.tracks, current.tracks);
    const trackOrderChanged = orderChanged(previous.tracks, current.tracks);
    const previousFeaturedItemId = previous.featuredItemId;
    const newFeaturedItemDetected = Boolean(
        current.featuredItemId
        && current.featuredItemId !== previousFeaturedItemId,
    );
    return {
        addedTracks,
        removedTracks,
        trackOrderChanged,
        previousFeaturedItemId,
        newFeaturedItemDetected,
        changeReasons: collectChangeReasons(
            type,
            previous,
            current,
            addedTracks,
            removedTracks,
            trackOrderChanged,
            newFeaturedItemDetected,
        ),
    };
}

function withoutMonitoring(record: SpotifyRecord): MonitoredSpotifyRecord {
    return {
        ...record,
        monitorName: null,
        changeStatus: 'not-tracked',
        changeDetected: false,
        changeReasons: [],
        previousObservedAt: null,
        observationCount: 0,
        previousTrackCount: null,
        addedTracks: [],
        removedTracks: [],
        trackOrderChanged: false,
        previousFeaturedItemId: null,
        newFeaturedItemDetected: false,
    };
}

function compactTrack(track: CompactItemRecord): TrackChangeRecord {
    return {
        id: track.id,
        uri: track.uri,
        url: track.url,
        name: track.name,
        position: track.position,
    };
}

function trackKey(track: TrackChangeRecord): string {
    return track.uri ?? track.id ?? `${track.name}:${track.position}`;
}

function difference(left: TrackChangeRecord[], right: TrackChangeRecord[]): TrackChangeRecord[] {
    const rightKeys = new Set(right.map(trackKey));
    return left.filter((track) => !rightKeys.has(trackKey(track)));
}

function orderChanged(previous: TrackChangeRecord[], current: TrackChangeRecord[]): boolean {
    const previousOrder = previous.map(trackKey).filter((key) => current.some((track) => trackKey(track) === key));
    const currentOrder = current.map(trackKey).filter((key) => previous.some((track) => trackKey(track) === key));
    return previousOrder.length > 1 && previousOrder.join('|') !== currentOrder.join('|');
}

function collectChangeReasons(
    type: SpotifyRecord['type'],
    previous: Snapshot,
    current: Snapshot,
    addedTracks: TrackChangeRecord[],
    removedTracks: TrackChangeRecord[],
    trackOrderChanged: boolean,
    newFeaturedItemDetected: boolean,
): string[] {
    const reasons: string[] = [];
    if (addedTracks.length > 0) reasons.push(type === 'show' ? 'episodes-added' : 'tracks-added');
    if (removedTracks.length > 0) reasons.push(type === 'show' ? 'episodes-removed' : 'tracks-removed');
    if (trackOrderChanged) reasons.push('track-order-changed');
    if (newFeaturedItemDetected) reasons.push(type === 'show' ? 'new-featured-episode' : 'featured-item-changed');
    if (previous.name !== current.name) reasons.push('name-changed');
    if (previous.subtitle !== current.subtitle) reasons.push('subtitle-changed');
    if (previous.releaseDate !== current.releaseDate) reasons.push('release-date-changed');
    if (previous.playable !== current.playable) reasons.push('playability-changed');
    return reasons;
}
