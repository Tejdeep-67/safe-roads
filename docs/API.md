# Safe Roads open data API

Free to use, no key. Data is **CC BY 4.0**: please credit *"Safe Roads community reports (thesaferoads.netlify.app)"*.
Base URL: `https://thesaferoads.netlify.app`

The same data is on the website at `/data` with a download builder.

## What is in it (and what is not)

Every row is one community report of a road hazard: where it is, what kind, how severe, whether people confirmed it, whether it was marked as fixed.

Left out on purpose: names, accounts, photos and photo links, the free-text note, exact timestamps (rounded to the minute) and anything about who voted. Reports that people flagged until they were hidden are not in the feed. Positions are rounded to 5 decimals (about 1 m).

What the numbers mean, and what they do not:

- **`verified`** = at least two different accounts agree (the reporter counts as one). Votes are not location-checked, so it means "two accounts agree", not "an inspector looked".
- **`status: resolved`** = two different accounts said it is fixed and they outnumber the ones who still see it, or a moderator marked it fixed. It is a community signal, not an official work order.
- **`status: stale`** = open, never confirmed by a second person and not touched for 180 days.
- **`reported_via`** = `ai_detection` when the report came from a photo (the in-browser model looked at it), `manual` otherwise. The model misses many potholes and can be wrong.
- There is no guarantee that an area is covered: no reports in an area means nobody reported there, not that the road is fine.

## Feed

```
GET /api/feed/geojson     GeoJSON FeatureCollection (Point features)
GET /api/feed/csv         CSV, one row per report
GET /api/feed/json        plain JSON: { license, generated_at, count, truncated, hazards: [...] }
```

Query parameters (all optional, combine freely):

| parameter | values | default |
|---|---|---|
| `bbox` | `minLng,minLat,maxLng,maxLat` (at most 400 map tiles of 0.1°, so roughly a few cities) | everything |
| `type` | comma list of `pothole`, `waterlogging`, `broken_edge`, `open_manhole`, `speed_bump` | all |
| `severity` | comma list of `low`, `medium`, `high` | all |
| `status` | `open`, `resolved`, `stale`, `all` | `open` |
| `verified` | `1` = only verified | off |
| `since` | a date like `2026-11-01`, matched against the last change of the report | none |
| `limit` | 1 to 5000 | 1000 |

Columns / properties:

`id, lat, lng, type, severity, status, verified, confirmations, fixed_votes, potholes_detected, reported_via, created_at, updated_at`

The GeoJSON has `lng, lat` in `geometry.coordinates` and the rest in `properties`; the top level also carries `license`, `generated_at` (the newest change in the result, so the same data gives the same bytes), `count` and `truncated`.

Headers: `Access-Control-Allow-Origin: *` (use it from any web page), `ETag` (send `If-None-Match` and get a `304`), `X-Total-Count` (how many rows match before `limit`), `Cache-Control: public, max-age=60`.

Examples:

```bash
# verified potholes around Guntur as GeoJSON (open it in QGIS or geojson.io)
curl "https://thesaferoads.netlify.app/api/feed/geojson?type=pothole&verified=1&bbox=80.30,16.20,80.55,16.45" -o guntur.geojson

# everything that changed since 1 November, as CSV
curl "https://thesaferoads.netlify.app/api/feed/csv?status=all&since=2026-11-01" -o hazards.csv

# how many open severe reports are there? (count only: limit=1 and read the header)
curl -sI "https://thesaferoads.netlify.app/api/feed/json?severity=high&limit=1" | grep -i x-total-count
```

```python
import requests
fc = requests.get("https://thesaferoads.netlify.app/api/feed/geojson", params={"type": "pothole", "status": "all"}).json()
print(fc["count"], fc["license"]["attribution"])
```

CSV cells that would start with `=`, `+`, `-` or `@` are prefixed with `'` so spreadsheets don't run them as formulas.

## Statistics

```
GET /api/stats          same filters as the feed (status is ignored, all statuses are counted)
```

Returns `total`, `verified`, `by_status`, `by_type`, `by_severity`, `resolved_share` (percent, `null` when there are no reports), `weekly` (new reports per week for the last 12 weeks, weeks start on Monday, UTC) and `hotspots`: up to 20 grid cells of 0.005° (about 550 m) with at least 2 open reports, with the count, the severe ones and the verified ones.

An empty database gives zeros and empty lists. Nothing is estimated or filled in.

## Limits

120 requests per 5 minutes per address on the feed and stats (a request over that gets `429` with `Retry-After`). Answers are cached for a minute, so polling more often than that does not give newer data anyway. Be kind: if you need more, download the CSV once and work on it.

## Community and moderation endpoints (used by the app)

Need a signed-in session cookie; state-changing requests must come from the site's own origin.

| endpoint | what |
|---|---|
| `GET /api/hazards?bbox=…` | reports for the map (also `?mine=1`, `?stale=1`) |
| `POST /api/hazards` | new report `{lat, lng, type?, severity, confidence?, potholes?, source, note?, photo?}` |
| `DELETE /api/hazards/:id` | delete my own report |
| `POST /api/hazards/:id/vote` | `{vote: "confirm" \| "fixed" \| "flag", reason?: "fake" \| "wrong_place" \| "spam" \| "offensive" \| "other"}` |
| `DELETE /api/hazards/:id/vote` | take my vote back |
| `GET /api/moderation` | moderator only: flagged and hidden reports |
| `POST /api/moderation/:id` | moderator only: `{action: "approve" \| "remove" \| "resolve" \| "reopen", note?}` |

Rules in one place (constants in `netlify/functions/lib/hazards-core.mjs`): a second person confirming verifies a report; two "fixed" votes that outnumber the "still there" votes resolve it; three different flags hide it until a moderator approves or removes it; you cannot confirm or flag your own report; 12 reports per 10 minutes and 60 per day per account, 3 per hour for accounts younger than an hour; 60 votes per 10 minutes; 10 flags per hour.
