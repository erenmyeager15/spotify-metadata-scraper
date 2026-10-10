# Spotify Playlist & Podcast Change Monitor — Promotion Notes

Use these notes after the verified Store build is live. Keep every claim limited to metadata Spotify exposes publicly.

## Positioning

Monitor public Spotify playlists, albums, artist top tracks, podcast shows, episodes, and tracks. Named watchlists detect added, removed, reordered, and newly featured content; changed-only delivery avoids duplicate item charges and downstream work.

## Strong US user messages

- Playlist teams: review additions, removals, and order changes in a CSV report.
- Labels and music marketers: keep separate watchlists for artists, campaigns, clients, or genres.
- Podcast researchers: detect when a show exposes a different featured episode.
- Automation teams: send only changes to Sheets, Slack, Make, Zapier, n8n, or a webhook.
- Cost-sensitive users: one $0.0015 parent item includes up to 50 publicly exposed nested tracks.

## LinkedIn post draft

I updated my Spotify Actor on Apify for recurring playlist and podcast monitoring.

It now keeps named watchlists and reports playlist track additions, removals, order changes, and newly featured podcast episodes. You can schedule the same input, export a JSON or CSV change report, and enable changed-only delivery so unchanged repeats do not create another item charge.

The Actor uses 256 MB, needs no Spotify login or API key, and does not require a proxy by default. A playlist or album is billed as one parent item, with up to 50 publicly exposed nested tracks included.

The scope is deliberately honest: it monitors public embed metadata, not private playlists, listening history, full play counts, or complete discographies.

Actor: https://apify.com/fascinating_lentil/spotify-metadata-scraper

#Apify #Spotify #MusicData #PodcastAnalytics #WebScraping #Automation

## Tutorial outline

1. Open Spotify Playlist & Podcast Change Monitor on Apify.
2. Paste one public playlist or podcast show URL.
3. Enable `trackChanges` and choose a stable `monitorName`.
4. Run once to create the baseline.
5. Schedule the same input daily or weekly.
6. Open `MONITORING-REPORT` or `MONITORING-REPORT.csv`.
7. Enable `onlyChanged` after confirming the baseline.
8. Connect the output to an Apify integration or webhook.

## SEO keywords

- spotify playlist monitor
- spotify playlist change tracker
- spotify podcast monitor
- spotify playlist scraper
- export spotify playlist changes csv
- spotify track additions removals
- spotify metadata scraper api
- apify spotify scraper

## Claim guardrails

- Say "public Spotify metadata," not "all Spotify data."
- Say "up to 50 publicly exposed nested tracks," not "complete playlist."
- Do not claim access to private playlists, account data, streams, followers, or listening history.
- Do not claim monthly listeners or exact play counts.
- Do not claim preview URLs are always available.
- Do not imply that the Actor downloads full audio.
- State that the tool is independent and not affiliated with Spotify.
