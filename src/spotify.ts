import { fetch, ProxyAgent } from 'undici';

import {
    SPOTIFY_TYPES,
    type CompactItemRecord,
    type ImageRecord,
    type ParsedSpotifyInput,
    type PersonRecord,
    type ProxyUrlProvider,
    type SpotifyRecord,
    type SpotifyType,
} from './types.js';

const REQUEST_HEADERS = {
    accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36',
};

const RETRYABLE_STATUS_CODES = new Set([403, 408, 429, 500, 502, 503, 504]);

type UnknownRecord = Record<string, unknown>;

interface OEmbedResponse {
    title?: string;
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
}

export function parseSpotifyInput(value: string): ParsedSpotifyInput {
    const sourceUrl = value.trim();
    if (!sourceUrl) throw new Error('Spotify URL cannot be empty.');

    let type: string | undefined;
    let id: string | undefined;

    const uriMatch = sourceUrl.match(/^spotify:(track|artist|album|playlist|show|episode):([A-Za-z0-9]+)$/i);
    if (uriMatch) {
        [, type, id] = uriMatch;
    } else {
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(sourceUrl);
        } catch {
            throw new Error(`Not a valid Spotify URL or URI: ${sourceUrl}`);
        }

        if (!['open.spotify.com', 'www.open.spotify.com'].includes(parsedUrl.hostname.toLowerCase())) {
            throw new Error(`Unsupported Spotify hostname: ${parsedUrl.hostname}`);
        }

        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        if (segments[0]?.startsWith('intl-')) segments.shift();
        if (segments[0] === 'embed') segments.shift();
        [type, id] = segments;
    }

    type = type?.toLowerCase();
    if (!SPOTIFY_TYPES.includes(type as SpotifyType) || !id || !/^[A-Za-z0-9]+$/.test(id)) {
        throw new Error(`Unsupported Spotify item: ${sourceUrl}`);
    }

    const canonicalUrl = `https://open.spotify.com/${type}/${id}`;
    return {
        sourceUrl,
        type: type as SpotifyType,
        id,
        canonicalUrl,
        embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
        spotifyUri: `spotify:${type}:${id}`,
    };
}

export async function scrapeSpotifyItem(
    input: ParsedSpotifyInput,
    proxyConfiguration?: ProxyUrlProvider,
): Promise<SpotifyRecord> {
    const [embedHtml, oembed] = await Promise.all([
        requestText(input.embedUrl, proxyConfiguration),
        requestJson<OEmbedResponse>(
            `https://open.spotify.com/oembed?url=${encodeURIComponent(input.canonicalUrl)}`,
            proxyConfiguration,
        ).catch(() => undefined),
    ]);

    const entity = extractEntity(embedHtml);
    const resolvedType = stringValue(entity.type) ?? input.type;
    const typeMismatch = resolvedType !== input.type;
    const oembedTitle = cleanOEmbedTitle(oembed?.title);
    const parentName = input.type === 'show' ? stringValue(entity.subtitle) : null;
    const name = typeMismatch
        ? parentName ?? oembedTitle ?? stringValue(entity.title) ?? stringValue(entity.name) ?? input.id
        : stringValue(entity.title) ?? stringValue(entity.name) ?? oembedTitle ?? input.id;
    const images = collectImages(entity, oembed);
    const tracks = arrayValue(entity.trackList).map((item, index) => normalizeCompactItem(item, index + 1));
    const durationMs = positiveNumberValue(entity.duration);

    return {
        sourceUrl: input.sourceUrl,
        url: input.canonicalUrl,
        spotifyUri: input.spotifyUri,
        type: input.type,
        resolvedType,
        id: input.id,
        name,
        subtitle: typeMismatch ? null : stringValue(entity.subtitle),
        artists: normalizePeople(entity.artists),
        authors: normalizePeople(entity.authors),
        releaseDate: typeMismatch ? null : releaseDateValue(entity.releaseDate),
        durationMs: typeMismatch ? null : durationMs,
        durationText: typeMismatch ? null : formatDuration(durationMs),
        explicit: typeMismatch ? null : booleanValue(entity.isExplicit),
        playable: typeMismatch ? null : booleanValue(entity.isPlayable),
        playabilityReason: typeMismatch ? null : stringValue(entity.playabilityReason),
        previewUrl: typeMismatch ? null : previewUrlValue(entity.audioPreview),
        imageUrl: images[0]?.url ?? null,
        images,
        trackCount: tracks.length,
        tracksMayBePartial: input.type === 'playlist' && tracks.length >= 50,
        tracks,
        featuredItem: typeMismatch ? normalizeCompactItem(entity, 1) : null,
        scrapedAt: new Date().toISOString(),
    };
}

function extractEntity(html: string): UnknownRecord {
    const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
    for (const match of html.matchAll(scriptPattern)) {
        const script = match[1].trim();
        if (!script.startsWith('{')) continue;

        try {
            const payload = JSON.parse(script) as UnknownRecord;
            const entity = getPath(payload, ['props', 'pageProps', 'state', 'data', 'entity']);
            if (isRecord(entity)) return entity;
        } catch {
            // Most script tags are not the page data island.
        }
    }

    throw new Error('Spotify embed page did not contain a readable entity data island.');
}

async function requestJson<T>(url: string, proxyConfiguration?: ProxyUrlProvider): Promise<T> {
    const body = await requestText(url, proxyConfiguration);
    return JSON.parse(body) as T;
}

async function requestText(url: string, proxyConfiguration?: ProxyUrlProvider): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt++) {
        const proxyUrl = await proxyConfiguration?.newUrl();
        const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

        try {
            const response = await fetch(url, {
                dispatcher,
                headers: REQUEST_HEADERS,
                redirect: 'follow',
            });
            const body = await response.text();

            if (response.ok) return body;

            const error = new Error(`Spotify returned HTTP ${response.status} for ${url}`);
            if (!RETRYABLE_STATUS_CODES.has(response.status)) throw error;
            lastError = error;
        } catch (error) {
            lastError = error;
        } finally {
            await dispatcher?.close();
        }

        if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

function normalizePeople(value: unknown): PersonRecord[] {
    return arrayValue(value).map((person) => {
        const uri = stringValue(person.uri);
        return {
            name: stringValue(person.name) ?? stringValue(person.title) ?? '',
            uri,
            url: spotifyUriToUrl(uri),
        };
    }).filter((person) => person.name.length > 0);
}

function normalizeCompactItem(value: unknown, position: number): CompactItemRecord {
    const item = isRecord(value) ? value : {};
    const uri = stringValue(item.uri);
    const durationMs = numberValue(item.duration);
    return {
        position,
        type: stringValue(item.entityType) ?? stringValue(item.type) ?? uri?.split(':')[1] ?? 'unknown',
        id: uri?.split(':')[2] ?? stringValue(item.id),
        uri,
        url: spotifyUriToUrl(uri),
        name: stringValue(item.title) ?? stringValue(item.name) ?? '',
        subtitle: stringValue(item.subtitle),
        durationMs,
        durationText: formatDuration(durationMs),
        explicit: booleanValue(item.isExplicit),
        playable: booleanValue(item.isPlayable),
        previewUrl: previewUrlValue(item.audioPreview),
    };
}

function collectImages(entity: UnknownRecord, oembed?: OEmbedResponse): ImageRecord[] {
    const candidates: unknown[] = [
        getPath(entity, ['visualIdentity', 'image']),
        entity.coverArt,
        entity.relatedEntityCoverArt,
        entity.videoThumbnailImage,
    ];
    const images: ImageRecord[] = [];

    const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (!isRecord(value)) return;

        const url = stringValue(value.url);
        if (url) {
            images.push({
                url,
                width: numberValue(value.maxWidth) ?? numberValue(value.width),
                height: numberValue(value.maxHeight) ?? numberValue(value.height),
            });
            return;
        }

        Object.values(value).forEach(visit);
    };

    candidates.forEach(visit);
    if (oembed?.thumbnail_url) {
        images.push({
            url: oembed.thumbnail_url,
            width: oembed.thumbnail_width ?? null,
            height: oembed.thumbnail_height ?? null,
        });
    }

    return [...new Map(images.map((image) => [image.url, image])).values()]
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
}

function cleanOEmbedTitle(value: string | undefined): string | null {
    return value?.replace(/^Spotify Embed:\s*/i, '').trim() || null;
}

function releaseDateValue(value: unknown): string | null {
    if (typeof value === 'string') return value;
    return isRecord(value) ? stringValue(value.isoString) : null;
}

function previewUrlValue(value: unknown): string | null {
    return isRecord(value) ? stringValue(value.url) : null;
}

function spotifyUriToUrl(uri: string | null): string | null {
    if (!uri) return null;
    const match = uri.match(/^spotify:(track|artist|album|playlist|show|episode):([A-Za-z0-9]+)$/);
    return match ? `https://open.spotify.com/${match[1]}/${match[2]}` : null;
}

function formatDuration(milliseconds: number | null): string | null {
    if (milliseconds === null) return null;
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getPath(value: unknown, path: string[]): unknown {
    let current = value;
    for (const key of path) {
        if (!isRecord(current)) return undefined;
        current = current[key];
    }
    return current;
}

function arrayValue(value: unknown): UnknownRecord[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveNumberValue(value: unknown): number | null {
    const number = numberValue(value);
    return number !== null && number > 0 ? number : null;
}

function booleanValue(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
