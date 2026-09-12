# PRD: WhereHaveIBeen iOS app (v1, native viewer)

## Summary

A native SwiftUI iOS app that shows a user's OwnTracks history the way the web
app does: buffered "explored" coverage, flights, a visit-frequency heatmap, an
Everyone view, and a stats ribbon, over selectable date ranges. All geometry
and stats come from new per-user endpoints on the user management API at
`https://mini.romangarms.com`; the app does no route or buffer computation.

The long-term goal is for this app to also record location in the background
and replace the OwnTracks mobile app. That is out of scope for v1, but the
architecture must leave a clean slot for it.

The project lives in this repo under `ios/`.

## Why native, and why now

- Background location is native-only and is the end goal.
- The web frontend's geometry pipeline (Turf.js, OSRM, IndexedDB) is being
  moved server-side into the API (see the companion PRD in
  `../wherehaveibeen-api/PRD.md`). Once it exists, a native viewer is mostly
  networking plus MapKit overlays.
- The Fly.io host serving the web app is slow. The app talks only to the Mac
  Mini, which hosts the recorder, the API, and OSRM.

## Non-goals (v1)

- Background location recording, motion permissions, or posting to the
  recorder. No location usage keys in `Info.plist` in v1.
- Account creation. Sign-in only; registration stays on the web.
- OpenStreetMap tiles. The basemap is Apple Maps.
- iPad-specific layout, widgets, Apple Watch, App Store submission. It must
  run on the owner's iPhone via Xcode.
- Client-side geometry. If the API does not provide a shape, the app does not
  draw it.

## Dependencies

- The API endpoints below. They are being built in parallel; until they are
  deployed, develop against committed fixture JSON through a mock client. The
  contract is fixed and shared between both PRDs.
- Xcode 26.6 on the owner's Mac. No third-party dependencies (no SPM
  packages) in v1.

## Shared API contract (v1)

This section is duplicated verbatim in the API PRD. Do not change it without
changing both.

Base URL: `https://mini.romangarms.com`. Auth: HTTP Basic on every request.
Missing or invalid credentials return `401` with
`WWW-Authenticate: Basic realm="WhereHaveIBeen"`; an inactive account returns
`403`. Bad parameters return `400` with `{"error": "<message>"}`.

### `GET /api/me/devices`

Response `200`:

```json
{ "username": "roman", "devices": ["phone", "ipad"] }
```

### `GET /api/me/track`

Query parameters:

| Param | Type | Default | Notes |
|---|---|---|---|
| `from` | ISO 8601 datetime with offset or `Z` | full history | Inclusive lower bound on `tst`. |
| `to` | ISO 8601 datetime | now | Inclusive upper bound. Omitted means open-ended and enables incremental refresh. |
| `device` | string | all of the user's devices | Must be one of the user's devices, else `400`. |
| `buffer_m` | integer | `500` | Corridor radius in metres. Clamped to `100..5000`. |
| `refresh` | `1` | unset | Discard the cache entry and recompute. |

Response `200`:

```json
{
  "range": { "from": "2024-08-01T00:00:00Z", "to": "2026-09-10T17:00:00Z" },
  "computed_at": 1789000000,
  "latest_tst": 1788999000,
  "buffer_m": 500,
  "driving": { "type": "Feature", "properties": {}, "geometry": { "type": "MultiPolygon", "coordinates": [] } },
  "flights": {
    "type": "FeatureCollection",
    "features": [
      { "type": "Feature",
        "properties": { "start_tst": 1780000000, "end_tst": 1780010000, "distance_km": 1234.5 },
        "geometry": { "type": "LineString", "coordinates": [[-122.3, 47.4], [-118.4, 33.9]] } }
    ]
  },
  "flights_buffer": { "type": "Feature", "properties": {}, "geometry": { "type": "MultiPolygon", "coordinates": [] } },
  "stats": {
    "driving": { "distance_km": 0.0, "area_km2": 0.0, "max_alt_m": 0.0, "max_vel_kmh": 0.0 },
    "flying":  { "distance_km": 0.0, "area_km2": 0.0, "max_alt_m": 0.0, "max_vel_kmh": 0.0 }
  }
}
```

- `range.from` is `null` when `from` was omitted. `latest_tst` is `null` when
  there are no points.
- `driving.geometry` and `flights_buffer.geometry` are `Polygon`,
  `MultiPolygon`, or `null` when empty. Coordinates are `[lon, lat]` WGS84.
- `stats.driving.area_km2` is the area of `driving.geometry`;
  `stats.flying.area_km2` is the area of `flights_buffer.geometry`.

Response `202` when the result is not cached and the compute is still running:

```json
{ "status": "computing" }
```

with a `Retry-After` header in seconds. Clients poll the same URL.

### `GET /api/me/heatmap`

Query parameters: `from`, `to`, `device`, `refresh` as above. No `buffer_m`.

Response `200`:

```json
{
  "range": { "from": null, "to": "2026-09-10T17:00:00Z" },
  "computed_at": 1789000000,
  "latest_tst": 1788999000,
  "cell_deg": 0.0006,
  "cells": [[-203833, 79000, 12], [-203832, 79000, 3]]
}
```

Each cell is `[gx, gy, count]` where `gx = round(lon / cell_deg)` and
`gy = round(lat / cell_deg)`. The cell centre is `(gx * cell_deg, gy * cell_deg)`.
`202` semantics are identical to `/api/me/track`.

### `GET /api/aggregate-roads` (existing, one addition)

Returns one GeoJSON `Feature` with `properties` `max_vel` (km/h), `max_alt`
(m), `distance_km`, and `area_km2`, geometry `Polygon` or `MultiPolygon`. A
cold cache returns `503` with `Retry-After`; the client retries.

## Product requirements

### Sign-in

- Username and password fields, a Sign in button, and an inline error.
- Validate by calling `/api/me/devices`. On `200`, store credentials in the
  Keychain and the device list in memory; on `401` show "Wrong username or
  password"; on `403` show "Account inactive"; on network failure show the
  error and keep the form.
- On launch with stored credentials, skip the form and go straight to the map.
- Sign out clears the Keychain entry and the on-disk cache.

### Map screen (the app's main screen)

Mirror the web app's controls. Layout for iPhone widths; the map fills the
screen with controls overlaid.

- **Scope**: Mine / Everyone segmented control.
- **Mode**: Routes / Heatmap segmented control. Heatmap is disabled in
  Everyone scope (the aggregate has no grid).
- **Flights toggle** (Routes mode, Mine scope): shows or hides the flight
  lines and flight buffer, and switches the stats between driving-only and
  driving-plus-flying, exactly as the web app's "flights included" state.
- **Date range**: presets Week, Month, Year, All time, plus Custom, which
  opens a sheet with start and end date pickers. Presets are relative to now
  and send `from` only. Custom sends both. All time sends neither. Ranges
  apply to Mine scope only; Everyone is always all time.
- **Device picker**: appears only when the user has more than one device.
  Default is all devices (omit `device`).
- **Stats ribbon**: horizontally scrolling tiles, same definitions as the web
  app's `statsPanel.js`:

  | Label | Source | Primary unit | Secondary |
  |---|---|---|---|
  | Distance driven (or "Distance travelled" with flights on; "Combined distance" in Everyone) | `distance_km` | mi | km |
  | Area explored | `area_km2` | mi² | km² |
  | West coast covered | area / 863,428 km² | % | "of WA + OR + CA" |
  | Highest altitude | `max_alt_m` | ft | m |
  | Top speed | `max_vel_kmh` | mph | km/h |

  Imperial first, metric underneath. Number formatting: 0 decimals at or above
  100, 1 decimal at or above 10, otherwise 2. With flights on, distance is the
  sum of driving and flying, area is the sum, maxima are the max of both.
  When the displayed top speed exceeds 200 mph (321.9 km/h) the secondary line
  gains the note "on a flight" (Mine) or "someone was flying" (Everyone), as
  the web app does. The app never classifies flights itself; that is the
  server's job.

- **Fit to data** on first load of a scope or range; do not refit on refresh.
- **Freshness**: a small "Updated 3 min ago" label from `computed_at`, and a
  pull or button to refresh with `refresh=1`.
- **Loading**: while polling a `202`, show a progress banner "Building your
  map, this can take a minute the first time" and keep any cached shape on
  screen. Poll at the `Retry-After` interval, give up after 5 minutes with a
  retry button.

### Settings

- Buffer size stepper shown in miles, mapped to `buffer_m` (default 500 m,
  step 0.1 mi, clamp 100..5000 m). Changing it invalidates the routes cache.
- Sign out.
- Clear cache, with the cache size shown.
- App version and a link to the web app.

## Rendering

Use `MKMapView` inside `UIViewRepresentable` rather than SwiftUI `Map`: the
dissolved coverage is one large `MultiPolygon`, and `MKMultiPolygon` with
`MKMultiPolygonRenderer` draws it in a single pass.

- **Coverage** (`driving`): decode with `MKGeoJSONDecoder`, add as one
  `MKMultiPolygon` (wrap a `Polygon` in a one-element multi). Fill
  `#3d6ba8` at 0.38 alpha, stroke `#3d6ba8` at 0.55 alpha, 1 pt. The web app
  thickens the stroke and darkens the fill as the map zooms out because a
  500 m corridor is sub-pixel below zoom 9; replicate that in the renderer
  using the zoom scale.
- **Flight buffer**: `MKMultiPolygon`, fill `#e6a23c` at 0.22 alpha, no
  stroke.
- **Flight lines**: `MKPolyline` per feature, `#c98418`, 2.4 pt, dash
  pattern `[10, 8]`, drawn above the buffers.
- **Everyone**: the aggregate `Feature` rendered with the coverage style.
- **Heatmap**: a custom `MKOverlay` covering the data bounds with a renderer
  that draws each cell as a filled circle at its centre, radius about 12 pt at
  screen scale and clamped when zoomed far out. Intensity is `log(count + 1)`
  scaled to the 99th percentile of intensities, saturating above. Colour ramp
  blue at 0, cyan at 0.3, lime at 0.5, yellow at 0.7, red at 1.0. Cull cells
  outside the requested map rect. Hold the cells in a spatial bucket (by
  coarse grid) so draws stay fast with hundreds of thousands of cells.
- Replace overlays atomically on new data; never leave the map empty during a
  refresh.

## Networking and caching

- `APIClient` actor: builds requests with the Basic header from the Keychain,
  decodes responses, maps `401`/`403`/`400`/`202`/`503` to typed errors or
  states. Use `URLSession` with gzip left to the system.
- `TrackStore`: one method per view (track, heatmap, everyone) keyed by scope,
  range, device, and buffer. Returns cached data immediately if present, then
  fetches and publishes the update. Cache is JSON on disk in Application
  Support, one file per key, with `computed_at`. Cached data is shown offline
  with a "Showing saved data" note.
- Preset ranges are relative to now, so the cache key for a preset uses the
  preset name, not the resolved timestamp, and the stored `range` is displayed.
- Mock client behind a protocol, selected by a launch argument, reading
  fixture JSON from the test bundle. Fixtures: a small track with one flight,
  a heatmap grid, and an aggregate feature. Build these by hand from the
  contract; they do not need real data.
- A debug-only base URL override (`http://localhost:5002`) with an ATS
  exception scoped to localhost, for testing against the API running locally.

## Architecture

```
ios/
  project.yml                 XcodeGen spec (install: brew install xcodegen)
  WhereHaveIBeen.xcodeproj    generated; commit it so Xcode opens directly
  WhereHaveIBeen/
    App/            WhereHaveIBeenApp.swift, root navigation, sign-in gate
    Features/
      SignIn/
      Map/          MapScreen, MapContainer (MKMapView), overlay renderers, controls
      Stats/        StatsRibbon, StatFormatter
      Settings/
    Services/
      API/          APIClient, endpoints, DTOs, GeoJSON decoding
      Cache/        TrackStore, DiskCache
      Auth/         Keychain, CredentialStore
      Location/     empty in v1; future LocationPublisher lives here
    Resources/      Assets, fixtures
  WhereHaveIBeenTests/
```

- Bundle id `com.romangarms.wherehaveibeen`, display name "Where Have I
  Been", minimum iOS 26.0, Swift 6 language mode, iPhone only, portrait plus
  landscape.
- No signing team in the committed project. The owner sets it in Xcode.
- View models are `@Observable` `@MainActor` classes. Services are actors.
- Keep `Services/` free of UI imports so the future location publisher can
  reuse `APIClient` and `CredentialStore` from a background task.

## Testing and verification

- Unit tests with the Swift Testing framework: GeoJSON to MapKit conversion
  (Polygon, MultiPolygon, null, LineString), stat formatting and unit
  conversion, preset range resolution, heat intensity scaling and colour
  lookup, API client decoding of every fixture and every error status, cache
  key derivation.
- The implementer must build and test in the simulator before finishing:

  ```
  xcodebuild -project ios/WhereHaveIBeen.xcodeproj -scheme WhereHaveIBeen \
    -destination 'platform=iOS Simulator,name=iPhone 17' build test
  ```

  Pick an available simulator name from `xcrun simctl list devices` if that
  one is absent. Zero warnings under the default settings is the goal.
- Run the app in the simulator against the mock client and capture one
  screenshot per mode (routes, heatmap, everyone) into
  `static/screenshots/ios/` for the README.

## Acceptance criteria

- Fresh install: sign-in form, wrong password shows the inline error, right
  password lands on the map.
- With the mock client, all three views render with the styles above and the
  stats ribbon shows the fixture numbers formatted imperial-first.
- Against the live API (once deployed), the owner's all-time routes view
  loads from cache in under a second on second launch and shows the freshness
  label; a cold first load shows the progress banner and completes.
- Airplane mode after a successful load shows the saved data with the offline
  note.
- Changing buffer size refetches routes and leaves the heatmap cache alone.
- No location permission prompts, no location keys in `Info.plist`.
- `xcodebuild ... build test` passes.

## Follow-ups (not in this PRD)

- Background location publisher posting OwnTracks-format JSON to the
  recorder's `/pub` endpoint with Basic auth, an offline queue, and a
  "recording" indicator. Then retire the OwnTracks app.
- Home screen widget using the existing `/trmnl` JSON.
- Registration in-app.
- Migrate the web app to the same endpoints.
