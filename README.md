# Spotify Metadata Scraper

Extract structured public metadata from Spotify tracks, artists, albums, playlists, podcast shows, and episodes. Provide Spotify web URLs or `spotify:` URIs and receive clean dataset rows ready for catalog enrichment, playlist research, podcast indexing, reporting, and automation.

No Spotify login or API key is required. The Actor reads public Spotify embed data and does not download full audio.

## Quick start

Run this one-item example:

```json
{
  "startUrls": [
    "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
  ],
  "maxItems": 1,
  "maxConcurrency": 1,
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

The result can be exported as JSON, CSV, Excel, XML, or HTML, or consumed through the Apify API, webhooks, Make, Zapier, n8n, or other integrations.

## What you can scrape

- Tracks
- Artists and their public top-track lists
- Albums and their public track lists
- Playlists and up to 50 publicly exposed tracks
- Podcast shows
- Podcast episodes
- Spotify web URLs and `spotify:` URIs

## Output fields

Each requested Spotify item produces one dataset row.

| Group | Fields |
| --- | --- |
| Identity | `sourceUrl`, `url`, `spotifyUri`, `type`, `resolvedType`, `id`, `name` |
| Context | `subtitle`, `artists`, `authors`, `releaseDate` |
| Playback | `durationMs`, `durationText`, `explicit`, `playable`, `playabilityReason`, `previewUrl` |
| Media | `imageUrl`, `images` |
| Nested content | `trackCount`, `tracksMayBePartial`, `tracks`, `featuredItem` |
| Audit | `scrapedAt` |

Nested track rows include position, type, Spotify ID and URI, URL, name, subtitle, duration, explicit flag, playability, and preview URL when Spotify exposes one.

## Verified sample output

This shortened example comes from a successful public Actor run:

```json
{
  "sourceUrl": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
  "url": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
  "spotifyUri": "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
  "type": "track",
  "resolvedType": "track",
  "id": "4uLU6hMCjMI75M1A2tKUQC",
  "name": "Never Gonna Give You Up",
  "artists": [
    {
      "name": "Rick Astley",
      "uri": "spotify:artist:0gxyHStUsqpMadRV0Di1Qt",
      "url": "https://open.spotify.com/artist/0gxyHStUsqpMadRV0Di1Qt"
    }
  ],
  "releaseDate": "1987-11-12T00:00:00Z",
  "durationMs": 213573,
  "durationText": "3:33",
  "explicit": false,
  "playable": true,
  "trackCount": 0,
  "tracksMayBePartial": false,
  "scrapedAt": "2026-06-11T08:05:21.284Z"
}
```

Values can change when Spotify updates its public metadata. Optional fields may be `null`.

## Input

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `startUrls` | array | One sample track | Spotify web URLs or `spotify:` URIs, one per line |
| `maxItems` | integer | `1` | Maximum number of unique inputs to process, from 1 to 10,000 |
| `maxConcurrency` | integer | `1` | Parallel Spotify requests, from 1 to 20 |
| `proxyConfiguration` | object | Proxy off | Optional Apify Proxy configuration |

Duplicate Spotify items are processed once. Unsupported and failed inputs are written to the separate `failed-urls` dataset.

## Common workflows

### Resolve a mixed Spotify list

Paste track, artist, album, playlist, show, and episode URLs together. The `type` and `resolvedType` fields make the output easy to filter.

### Enrich a music catalog

Join canonical Spotify IDs, artist references, release dates, durations, images, and public preview URLs to an internal catalog.

### Monitor playlists or artist pages

Schedule repeated runs and compare nested `tracks` arrays over time. Playlist embeds may expose only the first 50 tracks.

### Index public podcast metadata

Collect show or episode names, authors, publish dates, images, and preview links where available.

## Pricing

This Actor uses Pay Per Event pricing.

| Event | Price |
| --- | ---: |
| Actor start | $0.00005 |
| Each successfully saved `spotify-item` | $0.0015 |

Nested tracks are included in the parent item charge. Failed inputs are not charged as `spotify-item` events. The Actor stops taking new work when the run reaches the user's maximum-cost limit.

## Limits and reliability

- Public Spotify embed data can change without notice.
- Playlist embeds currently expose at most 50 tracks. Check `tracksMayBePartial`.
- A show embed can resolve to a featured episode; the resolved item is placed in `featuredItem`.
- `previewUrl`, release date, duration, and playability fields may be unavailable for some items or markets.
- The Actor does not access private playlists, account data, listening history, or full audio.
- Start with low concurrency. Increase it only when processing larger lists.

## API example

```bash
curl -X POST "https://api.apify.com/v2/acts/fascinating_lentil~spotify-metadata-scraper/runs?token=YOUR_APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startUrls": ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"],
    "maxItems": 1,
    "maxConcurrency": 1,
    "proxyConfiguration": {"useApifyProxy": false}
  }'
```

## Responsible use

Use this Actor only for lawful collection of publicly available metadata. You are responsible for complying with Spotify's terms, copyright rules, privacy laws, and regulations that apply to your use case.

This Actor is an independent tool and is not affiliated with, endorsed by, or sponsored by Spotify.

## Local development

```powershell
npm install
npm run build
New-Item -ItemType Directory -Force storage/key_value_stores/default
Copy-Item test_input.json storage/key_value_stores/default/INPUT.json
npm start
```

## License

Apache-2.0.
