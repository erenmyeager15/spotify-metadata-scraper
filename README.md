# Spotify Metadata Scraper

Extract clean public metadata from Spotify tracks, artists, albums, playlists, podcast shows, and episodes. The Actor uses Spotify's public embed data, so it needs no Spotify login and no API key.

## Features

- Accepts Spotify web URLs and `spotify:` URIs
- Supports tracks, artists, albums, playlists, shows, and episodes
- Returns names, artists, authors, dates, durations, images, preview URLs, and playability
- Nests album tracks, artist top tracks, and up to 50 playlist tracks inside the parent record
- Retries temporary blocks and supports optional Apify Proxy routing
- Writes invalid or failed inputs to the separate `failed-urls` dataset
- Charges only after a successful record is saved

## Input

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `startUrls` | string array | Sample track | Spotify URLs or `spotify:` URIs |
| `maxItems` | integer | `100` | Maximum unique inputs to process |
| `maxConcurrency` | integer | `5` | Parallel Spotify page requests |
| `proxyConfiguration` | object | Proxy off | Optional Apify Proxy settings |

## Sample input

```json
{
  "startUrls": [
    "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    "spotify:album:4m2880jivSbbyEGAKfITCa"
  ],
  "maxItems": 2,
  "proxyConfiguration": { "useApifyProxy": false }
}
```

## Sample output

```json
{
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
  "durationMs": 213573,
  "durationText": "3:33",
  "explicit": false,
  "trackCount": 0,
  "tracks": []
}
```

## Pricing

The `spotify-item` event costs **$0.0015 per successfully saved input item**, or **$1.50 per 1,000 items**. Nested tracks are included at no extra charge. Failed inputs are not charged.

## Notes

- Spotify playlist embeds currently expose up to 50 tracks. `tracksMayBePartial` is `true` when that limit is reached.
- Spotify show embeds can resolve to a featured episode. In that case the show remains the parent record and the resolved episode is stored in `featuredItem`.
- This Actor extracts public metadata only. It does not download full audio or bypass Spotify access controls.

## Use cases

- Music catalog audits and metadata cleanup
- Playlist research and curation
- Artist top-track monitoring
- Podcast and episode indexing
- Cover-art and preview-link collection
- Spotify URL enrichment for internal datasets

## Local development

```powershell
npm install
npm run build
New-Item -ItemType Directory -Force storage/key_value_stores/default
Copy-Item test_input.json storage/key_value_stores/default/INPUT.json
npm start
```
