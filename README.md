# Spotify Scraper - Tracks, Artists, Albums, Playlists & Podcasts Metadata

Scrape public **Spotify metadata** from tracks, artists, albums, playlists, podcast shows, and episodes. This Spotify scraper extracts names, artists, authors, release dates, durations, cover images, preview URLs, and playability from any Spotify web URL or `spotify:` URI. Export to JSON, CSV, Excel, or HTML, or pull via the Apify API — no Spotify login and no API key required, because it reads Spotify's public embed data.

Built with Node.js 20, TypeScript, and the Apify SDK. It accepts both web URLs and URIs, nests album tracks, artist top tracks, and up to 50 playlist tracks inside the parent record, retries temporary blocks, and supports optional Apify Proxy routing.

## What It Extracts

- `sourceUrl` — the input URL you provided
- `url` — canonical Spotify web URL
- `spotifyUri` — the `spotify:` URI
- `type` — requested type (track, artist, album, playlist, show, episode)
- `resolvedType` — the type actually resolved from the page
- `id` — Spotify ID
- `name` — track, artist, album, playlist, show, or episode name
- `subtitle` — secondary line (e.g. artist or show context)
- `artists` — list of artists with `name`, `uri`, `url`
- `authors` — list of authors/publishers (podcasts) with `name`, `uri`, `url`
- `releaseDate` — release or publish date
- `durationMs` and `durationText` — duration in ms and human-readable form
- `explicit` — explicit content flag
- `playable` and `playabilityReason` — playability status and reason
- `previewUrl` — audio preview URL
- `imageUrl` — primary cover image
- `images` — all cover images with `url`, `width`, `height`
- `trackCount` — number of nested tracks
- `tracksMayBePartial` — true when the embed track limit was reached
- `tracks` — nested track list (position, type, id, uri, url, name, subtitle, duration, explicit, playable, previewUrl)
- `featuredItem` — featured episode when a show resolves to one
- `scrapedAt` — extraction timestamp

## Use Cases

1. **Music catalog audits** — bulk-resolve Spotify URLs to clean metadata for cleanup and deduplication of internal datasets.
2. **Playlist research and curation** — pull playlist tracks, durations, and explicit flags to study or rebuild playlists.
3. **Artist top-track monitoring** — track an artist's top tracks and cover art over time.
4. **Podcast and episode indexing** — extract show and episode names, authors, dates, and preview links for podcast directories.
5. **Cover-art and preview-link collection** — gather high-resolution images and audio previews for enrichment or display.

## Pricing

This Actor uses Apify Pay Per Event pricing. Each unique Spotify item is saved and charged atomically; nested tracks are included at no extra charge, failed inputs are not billed, and workers stop taking new items when the user's spending limit is reached.

| Event name | Price per event | 1,000 items | 10,000 items |
| --- | ---: | ---: | ---: |
| `spotify-item` | $0.0015 | $1.50 | $15.00 |

## Input

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `startUrls` | array | yes | sample track | Spotify web URLs or `spotify:` URIs, one per line. |
| `maxItems` | integer | no | `100` | Maximum number of unique Spotify URLs to process (1–10000). |
| `maxConcurrency` | integer | no | `5` | Spotify pages fetched in parallel (1–20). |
| `proxyConfiguration` | object | no | Proxy off | Optional Apify Proxy settings. The public embed usually works without a proxy. |

## Example Input

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

## How to Scrape Spotify (Step by Step)

1. Click **Try for free** / **Run**.
2. Paste Spotify URLs or `spotify:` URIs into `startUrls`, one per line.
3. Set `maxItems` (start small to test) and optionally `maxConcurrency`.
4. Leave proxy off, or enable Apify Proxy if you need it.
5. Run, then export the results as JSON, CSV, Excel, or HTML, or pull them via the Apify API.

## Output dataset

The Actor saves one clean metadata row per requested Spotify item. Rows include the
requested source URL, canonical Spotify URL, item type, name, subtitle/artist or owner
context, release date, duration, image URL, preview URL when available, nested track
lists for albums/playlists/artists/shows, and an ISO `scrapedAt` timestamp. Export the
dataset as JSON, CSV, Excel, or HTML, or consume it through the Apify API.

### Sample output

```json
{
  "sourceUrl": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
  "url": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
  "spotifyUri": "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
  "type": "track",
  "resolvedType": "track",
  "id": "4uLU6hMCjMI75M1A2tKUQC",
  "name": "Never Gonna Give You Up",
  "subtitle": "Rick Astley",
  "artists": [
    {
      "name": "Rick Astley",
      "uri": "spotify:artist:0gxyHStUsqpMadRV0Di1Qt",
      "url": "https://open.spotify.com/artist/0gxyHStUsqpMadRV0Di1Qt"
    }
  ],
  "authors": [],
  "releaseDate": "1987-07-27",
  "durationMs": 213573,
  "durationText": "3:33",
  "explicit": false,
  "playable": true,
  "playabilityReason": null,
  "previewUrl": "https://p.scdn.co/mp3-preview/example",
  "imageUrl": "https://i.scdn.co/image/example",
  "images": [
    { "url": "https://i.scdn.co/image/example", "width": 640, "height": 640 }
  ],
  "trackCount": 0,
  "tracksMayBePartial": false,
  "tracks": [],
  "featuredItem": null,
  "scrapedAt": "2024-06-10T12:00:00.000Z"
}
```

## How It Works

1. Validates and parses each input into a canonical URL, ID, type, and embed URL.
2. Fetches Spotify's public embed data for the item (optionally through Apify Proxy).
3. Extracts and cleans fields, nesting album/artist/playlist tracks into the parent record.
4. Deduplicates inputs and writes invalid or failed inputs to the separate `failed-urls` dataset.
5. Charges `spotify-item` only after a successful record is saved, then writes it to the Apify Dataset.

## Known Limits

- Spotify playlist embeds currently expose up to 50 tracks. `tracksMayBePartial` is `true` when that limit is reached.
- Spotify show embeds can resolve to a featured episode. In that case the show stays the parent record and the resolved episode is stored in `featuredItem`.
- This Actor extracts public metadata only. It does not download full audio or bypass Spotify access controls, so some fields (like `previewUrl`) may be `null` when Spotify does not expose them.

## Legal and Ethical Use

This Actor reads only public Spotify embed metadata and uses no login or API key. You are responsible for complying with Spotify's terms, copyright, and local regulations wherever you use the data.

## Local development

```powershell
npm install
npm run build
New-Item -ItemType Directory -Force storage/key_value_stores/default
Copy-Item test_input.json storage/key_value_stores/default/INPUT.json
npm start
```

## Responsible Use

This Actor is intended for lawful collection of publicly available information only. Users are responsible for ensuring their use complies with the source website's terms, robots.txt, applicable privacy laws, including India's DPDP Act, and all local regulations.

Do not use this Actor to collect, store, sell, or misuse personal data without a lawful basis. The Actor author is not responsible for misuse by end users.

## License

Apache-2.0. See `LICENSE`.
