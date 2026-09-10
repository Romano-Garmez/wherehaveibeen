# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhereHaveIBeen is a Flask-based geospatial web application that visualizes OwnTracks GPS history on an interactive Leaflet map. Users connect to their OwnTracks server, and the app displays routes, calculates distance traveled, area explored, and other analytics.

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application (Waitress WSGI server on port 5000)
python app.py
```

For VS Code debugging, use the preconfigured Flask debugger in `.vscode/launch.json`.

## Environment Variables

Create a `.env` file with:
- `WHIB_FLASK_SECRET_KEY` - Flask session secret key

## Architecture

**Backend (Flask - `app.py`):**
- Session-based authentication storing OwnTracks credentials
- Proxy endpoints for OwnTracks API (`/locations`, `/usersdevices`)
- Settings persistence in Flask session (`/save_settings`, `/get_settings`)

**Frontend (Vanilla JS in `static/js/`):**
- `manageData.js` - Data fetching, filtering, and processing pipeline
- `drawOnMap.js` - Route calculation and Leaflet map rendering
- `logIn.js` - Authentication handling
- `cacheManager.js` - IndexedDB caching with settings validation
- `progressBar.js` - Progress strip and reload-chip state
- `statsPanel.js` - Stats ribbon; single source of truth for stat labels and unit formatting (imperial first, metric underneath)

**Data Flow:**
```
OwnTracks Server → Flask Backend (proxy/auth) → Frontend JS → Leaflet Map
                                              → IndexedDB Cache
```

**Routing Strategies (based on point count):**
- Simple: straight segments between fixes, buffered with Turf.js
- NoRoute: Point filtering only (very large datasets)

## Key Libraries

- **Backend:** Flask, Waitress, requests, pytz
- **Frontend:** Leaflet.js, Turf.js, Leaflet Routing Machine, Bootstrap 5

## Deployment

Production is hosted on Fly.io using Docker (see `fly.toml` and `Dockerfile`).

---

## Authentication and Connection Architecture

### System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     Browser     │     │  Flask Backend   │     │ OwnTracks Server │
│   (Frontend)    │     │    (app.py)      │     │    (External)    │
└────────┬────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                       │                        │
         │ POST /login           │                        │
         │ (username, password,  │                        │
         │  serverurl)           │                        │
         │──────────────────────>│                        │
         │                       │                        │
         │ Set encrypted session │                        │
         │ cookie (30-day)       │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ GET /usersdevices     │                        │
         │──────────────────────>│                        │
         │                       │ GET /api/0/last        │
         │                       │ (HTTPBasicAuth)        │
         │                       │───────────────────────>│
         │                       │<───────────────────────│
         │ JSON (users/devices)  │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ GET /locations        │                        │
         │──────────────────────>│                        │
         │                       │ GET /api/0/locations   │
         │                       │ (HTTPBasicAuth)        │
         │                       │───────────────────────>│
         │                       │<───────────────────────│
         │ GeoJSON response      │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ Store in IndexedDB    │                        │
         │ (browser cache)       │                        │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

### Session-Based Authentication

**Security Model:**
- Credentials stored in Flask session cookie (not in database)
- The session is **signed** (tamper-proof) with `WHIB_FLASK_SECRET_KEY`, but
  **not encrypted** — the cookie contents are base64-readable by anyone who
  holds the cookie. The username/password are therefore exposed to the client.
  The cookie is set `Secure` + `HttpOnly` + `SameSite=Lax` to limit exposure.
- Session lifetime: 30 days (`app.permanent_session_lifetime`)
- Sign-out clears entire session (`session.clear()`)

**Session Contents:**

| Key | Description | Set By |
|-----|-------------|--------|
| `username` | OwnTracks username | `/login` |
| `password` | OwnTracks password | `/login` |
| `serverurl` | OwnTracks server URL (e.g., `https://owntracks.example.com`) | `/login` |
| `circle_size` | Buffer size setting (km) | `/save_settings` |

### API Endpoints

#### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login` | POST | Store OwnTracks credentials in session. Form fields: `username`, `password`, `serverurl` |
| `/sign_out` | GET | Clear session, redirect to `/` |

#### OwnTracks Proxy

These endpoints require a valid session and proxy requests to the user's OwnTracks server using HTTPBasicAuth.

| Endpoint | Method | Proxies To | Description |
|----------|--------|------------|-------------|
| `/locations` | GET | `/api/0/locations` | Fetch GPS history as GeoJSON |
| `/usersdevices` | GET | `/api/0/last` | List available users/devices |

**`/locations` Query Parameters:**
- `startdate` - ISO 8601 datetime (converted to UTC internally)
- `enddate` - ISO 8601 datetime (converted to UTC internally)
- `user` - OwnTracks username filter
- `device` - OwnTracks device filter

#### Settings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/save_settings` | POST | Save `circleSize` to session |
| `/get_settings` | GET | Retrieve saved settings |

#### TRMNL e-ink display

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/trmnl` | GET | Compact JSON of the last N days of driving for a TRMNL 800×480 e-ink screen |
| `/trmnl/preview` | GET | WYSIWYG HTML render of that screen for local browser testing |

These accept **HTTP Basic auth** (so the TRMNL server can poll them — it can't
hold a session) and fall back to the **session cookie** (so a logged-in browser
can hit `/trmnl/preview` directly). Credentials are passed straight through to
OwnTracks, scoped to that user; an unauthenticated request returns `401` with a
`WWW-Authenticate` header so browsers prompt for login. All map projection (Web
Mercator, fitted + decimated to the screen), path building, and stats are
computed server-side. `/trmnl` returns JSON consumed by `trmnl/markup.liquid`;
`/trmnl/preview` renders `templates/trmnl_preview.html`. See `trmnl/README.md`.

The basemap uses the same OpenStreetMap tiles as the main map, positioned
server-side and grayscaled in the markup for e-ink. Tiles are served through a
`/trmnl/tile/<z>/<x>/<y>.png` proxy (in the blueprint) that adds the `Referer` /
`User-Agent` OSM requires — TRMNL's renderer sends neither, so a direct OSM fetch
is blocked. The proxy validates coordinates and caches tiles in memory.

**Query Parameters:** `days` (default 30), `tz` (IANA, default
`America/Los_Angeles`), `device` (optional filter), `basemap` (`osm` default, or
`none` for line-only), `w`/`h` (map area px, default 800×400 — must match the SVG
`viewBox` in the markup).

### Routing Strategy

Routes are calculated differently based on GPS point count:

| Point Count | Strategy | Description |
|-------------|----------|-------------|
| < 3000 | Simple | Direct line connections via Turf.js |
| 3000 - 5000 | NoRoute | Point filtering, 10m minimum spacing |
| > 5000 | NoRoute | Point filtering, 100m minimum spacing |

### Frontend Authentication Flow

```
Page Load (index.html)
    │
    ├─> getUserSettings()           # Load saved settings from /get_settings
    │
    └─> getUsersAndDevices()        # Validate session via /usersdevices
            │
            ├── Success ──> loggedIn = true
            │               closeForm()
            │               runTasks()  # Fetch and display location data
            │
            └── Failure ──> loggedIn = false
                            openForm()  # Show login form
```

**Key Frontend Files:**
- `logIn.js` - Session validation, settings load/save
- `manageData.js` - Data fetching from `/locations`, filtering, statistics
- `drawOnMap.js` - Route calculation (Simple/NoRoute), Leaflet rendering
- `cacheManager.js` - IndexedDB cache management

### IndexedDB Caching

The frontend caches processed route data in IndexedDB to avoid re-fetching and re-processing.

**Cache Structure:**
```javascript
{
  driving: { buffer: GeoJSON, timestamp, startTimestamp },
  flying: { buffer: GeoJSON, timestamp, startTimestamp },
  settings: { bufferSize },
  metrics: { highestAltitude, highestVelocity, totalDistance }
}
```

**Cache Invalidation Triggers:**
- Buffer size (`circleSize`) setting changed
- Manual cache clear by user

---

## Future: User Management API

*This section is a placeholder for the planned user management backend integration.*

### Planned Integration

A separate backend/API will be added to:
- Create new OwnTracks users
- Manage user accounts
- Integrate with OwnTracks user provisioning

### Integration Considerations

When implementing:
- **Admin Authentication** - Separate auth system from OwnTracks credentials
- **Permission Model** - Define admin vs regular user access levels
- **Session Extension** - May need `is_admin` flag in Flask session
- **API Layer** - New endpoints for user CRUD operations
