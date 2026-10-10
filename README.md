# Spotify Playlist & Podcast Change Monitor

Monitor public Spotify playlists, albums, artist top-track lists, podcast shows, episodes, and tracks without a Spotify login or API key. Every run returns clean metadata; optional named watchlists compare each item with its previous observation and identify added, removed, reordered, or newly featured content.

This Actor is designed for recurring music and podcast research, not only one-off extraction. It runs at **256 MB**, uses **no proxy by default**, and includes up to 50 publicly exposed playlist or album tracks inside one parent-item charge.

## Why use this Actor?

- **Persistent named watchlists** keep each client, campaign, or research project separate.
- **Playlist and album changes** show added tracks, removed tracks, and order changes.
- **Podcast monitoring** flags a newly featured episode when Spotify exposes one.
- **Changed-only delivery** can suppress unchanged repeats from the dataset and `spotify-item` charge.
- **JSON and CSV reports** summarize baseline, changed, unchanged, and failed items after every run.
- **One parent price** includes the nested tracks Spotify exposes—there is no extra item fee per nested track.
- **No login, API key, browser, or default proxy** is required.
- **Budget-aware execution** stops taking new work when the run reaches the user's Apify maximum-charge limit.

## Quick start: monitor a playlist

```json
{
  "startUrls": [
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
  ],
  "maxItems": 1,
  "maxConcurrency": 1,
  "trackChanges": true,
  "monitorName": "us-playlist-watch",
  "onlyChanged": false,
  "historyLimit": 30,
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

The first run returns a `baseline`. Schedule the same input daily or weekly. Later runs become `changed` or `unchanged` and include exact change reasons.

After the baseline is confirmed, set `onlyChanged` to `true` if downstream automations should receive only meaningful updates. Unchanged observations still refresh the bounded history and appear in the monitoring report, but they do not create a dataset row or `spotify-item` charge.

## Supported Spotify inputs

Paste public Spotify web URLs or `spotify:` URIs for:

- Tracks
- Artists and their publicly exposed top-track list
- Albums and their publicly exposed track list
- Playlists and up to 50 publicly exposed tracks
- Podcast shows
- Podcast episodes

Mixed input types are supported in one run. Duplicate Spotify items are processed once.

## Change fields

When `trackChanges` is enabled, every emitted row includes:

| Field | Meaning |
| --- | --- |
| `monitorName` | Named watchlist that owns this history |
| `changeStatus` | `baseline`, `changed`, or `unchanged` |
| `changeDetected` | Whether this observation differs from the prior one |
| `changeReasons` | Fixed reason codes such as `tracks-added`, `tracks-removed`, `track-order-changed`, or `new-featured-episode` |
| `previousObservedAt` | Timestamp of the prior observation |
| `observationCount` | Number of observations recorded for this item and monitor |
| `previousTrackCount` | Prior publicly exposed nested-track count |
| `addedTracks` | Compact identity, URL, name, and position for newly observed tracks |
| `removedTracks` | Compact identity, URL, name, and prior position for tracks no longer observed |
| `trackOrderChanged` | Whether the order of common tracks changed |
| `newFeaturedItemDetected` | Whether a different featured item or episode appeared |

The Actor stores at most `historyLimit` observations per Spotify item. Histories are isolated by `monitorName`, so two watchlists do not affect each other.

## Run reports

Every run writes three convenient outputs to the default key-value store:

- `OUTPUT` — machine-readable run totals and item-level outcomes
- `MONITORING-REPORT` — the same monitoring report as JSON
- `MONITORING-REPORT.csv` — spreadsheet-ready change report

The report includes items suppressed by `onlyChanged`, making it possible to prove that the run checked the watchlist even when the result dataset is intentionally empty.

## Public metadata fields

Each requested Spotify item produces at most one charged parent row.

| Group | Fields |
| --- | --- |
| Identity | `sourceUrl`, `url`, `spotifyUri`, `type`, `resolvedType`, `id`, `name` |
| Context | `subtitle`, `artists`, `authors`, `releaseDate` |
| Playback | `durationMs`, `durationText`, `explicit`, `playable`, `playabilityReason`, `previewUrl` |
| Media | `imageUrl`, `images` |
| Nested content | `trackCount`, `tracksMayBePartial`, `tracks`, `featuredItem` |
| Monitoring | `changeStatus`, `changeReasons`, `addedTracks`, `removedTracks`, observation fields |
| Audit | `scrapedAt` |

Nested tracks include position, Spotify ID and URI, URL, name, subtitle, duration, explicit flag, playability, and preview URL when Spotify exposes those values.

## Example changed playlist row

```json
{
  "spotifyUri": "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
  "type": "playlist",
  "name": "Today's Top Hits",
  "trackCount": 50,
  "tracksMayBePartial": true,
  "monitorName": "us-playlist-watch",
  "changeStatus": "changed",
  "changeDetected": true,
  "changeReasons": ["tracks-added", "tracks-removed", "track-order-changed"],
  "observationCount": 4,
  "addedTracks": [{"id": "example-new-track", "name": "Newly observed track", "position": 3}],
  "removedTracks": [{"id": "example-removed-track", "name": "Previously observed track", "position": 42}],
  "trackOrderChanged": true,
  "scrapedAt": "2026-10-11T12:00:00.000Z"
}
```

This is an illustrative monitoring shape. Spotify content changes over time, and optional values can be `null`.

## Inputs

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `startUrls` | array | One sample track | Public Spotify URLs or URIs, one per line |
| `maxItems` | integer | `1` | Maximum unique parent inputs to process, from 1 to 10,000 |
| `maxConcurrency` | integer | `1` | Parallel Spotify requests, from 1 to 20 |
| `trackChanges` | boolean | `false` | Compare each item with its prior observation |
| `monitorName` | string | `default` | Stable watchlist name used to isolate history |
| `onlyChanged` | boolean | `false` | Emit baselines and changes; suppress unchanged repeat item charges |
| `historyLimit` | integer | `30` | Recent observations retained per item, from 2 to 100 |
| `proxyConfiguration` | object | Proxy off | Optional override if a network requires it |

## US-focused workflows

### Playlist placement monitoring

Schedule label, editorial, genre, or campaign playlists. Review newly added and removed tracks, order movement, and a CSV report ready for Sheets or a BI tool.

### Podcast competitor monitoring

Watch public show URLs with a stable monitor name. When Spotify changes the featured episode, the row includes `new-featured-episode` and `newFeaturedItemDetected: true`.

### Artist and release research

Monitor artist, album, and track URLs together. Use the canonical Spotify IDs, release dates, image URLs, and public nested content in catalog or launch reports.

### Automation

Connect scheduled runs to Apify webhooks, Make, Zapier, n8n, Google Sheets, Slack, or an internal API. `onlyChanged` reduces duplicate downstream work.

## Pricing and profitability

This Actor uses Pay Per Event pricing:

| Event | Price |
| --- | ---: |
| Actor start | $0.00005 |
| Each emitted Spotify parent item | $0.0015 ($1.50 per 1,000) |

Up to 50 nested playlist or album tracks exposed by the public embed are included in the parent item charge. A one-playlist baseline is approximately $0.00155 in listed event fees. Failed inputs and unchanged repeats suppressed by `onlyChanged` do not trigger `spotify-item` events. Platform storage and runtime can still contribute to usage depending on the user's Apify plan and settings.

## Limits and honest coverage

- Public Spotify embed data can change without notice.
- Playlist embeds currently expose at most 50 tracks. `tracksMayBePartial: true` means the Actor did not observe the complete playlist; added or removed results apply only to the exposed window.
- A show embed can resolve to one featured episode rather than a full episode archive.
- Spotify does not expose every metric through public embeds. This Actor does not claim monthly listeners, full play counts, follower counts, private playlists, or complete discographies.
- Preview URLs, release dates, durations, and playability fields can be unavailable for some items or markets.
- The Actor does not access private accounts, listening history, or full audio.
- Change detection compares what Spotify exposed on two runs; it is not proof that an unexposed catalog item was added or removed.

## API example

```bash
curl -X POST "https://api.apify.com/v2/acts/fascinating_lentil~spotify-metadata-scraper/runs?token=YOUR_APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startUrls": ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"],
    "trackChanges": true,
    "monitorName": "us-playlist-watch",
    "onlyChanged": true,
    "proxyConfiguration": {"useApifyProxy": false}
  }'
```

## Responsible use

Use this Actor only for lawful collection of publicly available metadata. You are responsible for complying with Spotify's terms, copyright rules, privacy laws, and regulations that apply to your use case.

This Actor is an independent tool and is not affiliated with, endorsed by, or sponsored by Spotify.

## Local development

```powershell
npm install
npm test
npm start
```

## License

Apache-2.0
