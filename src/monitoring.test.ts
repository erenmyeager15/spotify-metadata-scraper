import assert from 'node:assert/strict';
import test from 'node:test';

import {
    compareSnapshots,
    monitorStateKey,
    monitorStoreName,
    sanitizeMonitorName,
    toCsv,
    type Snapshot,
} from './monitoring.js';

const track = (id: string, position: number) => ({
    id,
    uri: `spotify:track:${id}`,
    url: `https://open.spotify.com/track/${id}`,
    name: `Track ${id}`,
    position,
});

const snapshot = (tracks: ReturnType<typeof track>[], featuredItemId: string | null = null): Snapshot => ({
    observedAt: '2026-10-11T00:00:00.000Z',
    name: 'Watch item',
    subtitle: 'Owner',
    releaseDate: null,
    playable: true,
    trackCount: tracks.length,
    tracks,
    featuredItemId,
});

test('detects added, removed, and reordered playlist tracks', () => {
    const previous = snapshot([track('a', 1), track('b', 2), track('c', 3)]);
    const current = snapshot([track('b', 1), track('a', 2), track('d', 3)]);
    const result = compareSnapshots(previous, current, 'playlist');

    assert.deepEqual(result.addedTracks.map((item) => item.id), ['d']);
    assert.deepEqual(result.removedTracks.map((item) => item.id), ['c']);
    assert.equal(result.trackOrderChanged, true);
    assert.deepEqual(result.changeReasons, ['tracks-added', 'tracks-removed', 'track-order-changed']);
});

test('detects a newly featured podcast episode', () => {
    const result = compareSnapshots(snapshot([], 'episode-old'), snapshot([], 'episode-new'), 'show');
    assert.equal(result.newFeaturedItemDetected, true);
    assert.ok(result.changeReasons.includes('new-featured-episode'));
});

test('does not invent changes for identical snapshots', () => {
    const previous = snapshot([track('a', 1), track('b', 2)]);
    const current = { ...previous, observedAt: '2026-10-12T00:00:00.000Z' };
    const result = compareSnapshots(previous, current, 'playlist');
    assert.deepEqual(result.changeReasons, []);
});

test('uses isolated stable monitor keys and safe names', () => {
    assert.equal(sanitizeMonitorName('  US playlist / daily  '), 'US-playlist-daily');
    assert.equal(monitorStateKey('one', 'spotify:track:a'), monitorStateKey('one', 'spotify:track:a'));
    assert.notEqual(monitorStateKey('one', 'spotify:track:a'), monitorStateKey('two', 'spotify:track:a'));
    assert.notEqual(monitorStoreName('one'), monitorStoreName('two'));
    assert.match(monitorStoreName('one'), /^spotify-monitor-[a-f0-9]{20}$/);
});

test('CSV output escapes commas and arrays', () => {
    const csv = toCsv([{ name: 'A, B', reasons: ['tracks-added', 'name-changed'], emitted: true }]);
    assert.match(csv, /"A, B"/);
    assert.match(csv, /tracks-added\|name-changed/);
});
