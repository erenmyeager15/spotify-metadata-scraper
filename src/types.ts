export const SPOTIFY_TYPES = ['track', 'artist', 'album', 'playlist', 'show', 'episode'] as const;

export type SpotifyType = (typeof SPOTIFY_TYPES)[number];

export interface ActorInput {
    startUrls: string[];
    maxItems?: number;
    maxConcurrency?: number;
    trackChanges?: boolean;
    monitorName?: string;
    onlyChanged?: boolean;
    historyLimit?: number;
    proxyConfiguration?: Record<string, unknown>;
}

export interface ParsedSpotifyInput {
    sourceUrl: string;
    type: SpotifyType;
    id: string;
    canonicalUrl: string;
    embedUrl: string;
    spotifyUri: string;
}

export interface ImageRecord {
    url: string;
    width: number | null;
    height: number | null;
}

export interface PersonRecord {
    name: string;
    uri: string | null;
    url: string | null;
}

export interface CompactItemRecord {
    position: number;
    type: string;
    id: string | null;
    uri: string | null;
    url: string | null;
    name: string;
    subtitle: string | null;
    durationMs: number | null;
    durationText: string | null;
    explicit: boolean | null;
    playable: boolean | null;
    previewUrl: string | null;
}

export interface SpotifyRecord {
    sourceUrl: string;
    url: string;
    spotifyUri: string;
    type: SpotifyType;
    resolvedType: string;
    id: string;
    name: string;
    subtitle: string | null;
    artists: PersonRecord[];
    authors: PersonRecord[];
    releaseDate: string | null;
    durationMs: number | null;
    durationText: string | null;
    explicit: boolean | null;
    playable: boolean | null;
    playabilityReason: string | null;
    previewUrl: string | null;
    imageUrl: string | null;
    images: ImageRecord[];
    trackCount: number;
    tracksMayBePartial: boolean;
    tracks: CompactItemRecord[];
    featuredItem: CompactItemRecord | null;
    scrapedAt: string;
}

export type ChangeStatus = 'not-tracked' | 'baseline' | 'changed' | 'unchanged';

export interface TrackChangeRecord {
    id: string | null;
    uri: string | null;
    url: string | null;
    name: string;
    position: number;
}

export interface MonitoredSpotifyRecord extends SpotifyRecord {
    monitorName: string | null;
    changeStatus: ChangeStatus;
    changeDetected: boolean;
    changeReasons: string[];
    previousObservedAt: string | null;
    observationCount: number;
    previousTrackCount: number | null;
    addedTracks: TrackChangeRecord[];
    removedTracks: TrackChangeRecord[];
    trackOrderChanged: boolean;
    previousFeaturedItemId: string | null;
    newFeaturedItemDetected: boolean;
}

export interface MonitorReportRow {
    spotifyUri: string;
    type: SpotifyType;
    name: string;
    url: string;
    changeStatus: ChangeStatus;
    changeDetected: boolean;
    changeReasons: string[];
    observationCount: number;
    previousObservedAt: string | null;
    observedAt: string;
    addedTrackCount: number;
    removedTrackCount: number;
    trackOrderChanged: boolean;
    newFeaturedItemDetected: boolean;
    emitted: boolean;
}

export interface ProxyUrlProvider {
    newUrl(): Promise<string | null>;
}
