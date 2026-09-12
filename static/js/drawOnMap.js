// Track the heatmap layer so it can be cleared on re-render
let heatLayer = null;

// Flight buffers and lines are always built (they live in the cache) but are
// only attached to the map while the Flights toggle is on.
let flightLayers = [];
let exploredLayers = [];
// Flight paths as GeoJSON so they can be cached alongside the flight buffer
// and redrawn on cached loads (the buffer alone loses the dashed line).
let flightLines = [];
let zoomHookAttached = false;

const EXPLORED_COLOR = '#3d6ba8';
const FLIGHT_COLOR = '#e6a23c';
const FLIGHT_LINE_COLOR = '#c98418';

// A 0.5 km buffer is sub-pixel below zoom ~9, so the polygon outline is
// thickened and the fill darkened as the map zooms out to keep it legible.
function zoomBoost() {
    const zoom = (typeof map !== 'undefined' && map) ? map.getZoom() : 12;
    return Math.max(0, 9 - zoom);
}

function exploredStyle() {
    const boost = zoomBoost();
    return {
        color: EXPLORED_COLOR, weight: 1 + boost * 0.9, opacity: Math.min(.75, .55 + boost * .04),
        fillColor: EXPLORED_COLOR, fillOpacity: Math.min(.5, .38 + boost * .025)
    };
}

// The flight buffer is fill-only: with an outline it turns into a solid band
// when zoomed out and hides the dashed path, which is what the legend promises.
function flightBufferStyle() {
    return { stroke: false, fillColor: FLIGHT_COLOR, fillOpacity: .22 };
}

function flightLineStyle() {
    const boost = zoomBoost();
    return { color: FLIGHT_LINE_COLOR, weight: 2.4 + boost * 0.5, opacity: .8, dashArray: '10 8' };
}

function restyleForZoom() {
    exploredLayers.forEach(layer => layer.setStyle(exploredStyle()));
    flightLayers.forEach(({ layer, style }) => layer.setStyle(style()));
}

function ensureZoomHook() {
    if (zoomHookAttached) return;
    zoomHookAttached = true;
    map.on('zoomend', restyleForZoom);
}

function flightsShown() {
    return typeof getFlightsShown === 'function' ? getFlightsShown() : true;
}

function addFlightLayer(layer, style) {
    ensureZoomHook();
    flightLayers.push({ layer, style });
    if (flightsShown()) {
        layer.addTo(map);
        raiseFlightLines();
    }
}

function raiseFlightLines() {
    flightLayers.forEach(({ layer, style }) => {
        if (style === flightLineStyle && map.hasLayer(layer)) layer.bringToFront();
    });
}

function renderFlightLine(linestring) {
    flightLines.push(linestring);
    addFlightLayer(L.geoJSON(linestring, { style: flightLineStyle() }), flightLineStyle);
}

function renderCachedFlightLines(lines) {
    (lines || []).forEach(renderFlightLine);
}

function getFlightLines() {
    return flightLines.slice();
}

function setFlightLayersVisible(shown) {
    flightLayers.forEach(({ layer }) => shown ? layer.addTo(map) : layer.remove());
    if (shown) raiseFlightLines();
}

function addBaseLayer() {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

/**
 * Given the location data, list of latlngs, and color, this function calculates the routes for all given latlngs and draws it on the map as a single object.
 * @param {*} data retrieved from fetchLocations();
 * @param {*} latlngsList list of drivingLatlngs or flyingLatlngs
 * @param {*} color "blue" or "green" or "red"
 * @param {Object} options - Optional parameters for caching
 * @param {Object} options.cachedBuffer - Previously cached buffer to merge with
 * @returns {Object} The final buffer GeoJSON
 */
async function calculateAndDrawRoute(data, latlngsList, color, options = {}) {
    const isFlight = color === "red";
    let lineStrings = [];
    for (const latlngs of latlngsList) {
        //drawing buffer
        if (latlngs.length > 1) {
            let linestring;

            //simple route buffer can handle any number, but gets pretty slow north of 3000
            //no route is much quicker, but less accurate. Use the minDistance value to adjust accuracy.
            //Points between .01km of each other will be skipped if you pass in .01km
            if (data.features.length < 3000) {
                linestring = await calculateSimpleRoute(latlngs);
            } else if (data.features.length < 5000) {
                linestring = await calculateNoRoute(latlngs, 0.01);
            } else {
                linestring = await calculateNoRoute(latlngs, 0.1);
            }
            updateProgressBar();

            if (isFlight) {
                renderFlightLine(linestring);
            }

            lineStrings.push(linestring);
        }

    }

    const buffer = await createUnifiedBuffer(lineStrings, 0.01, color, options);
    return buffer;
}


/**
     * Draw the route on the map and buffer it using the simple route method. The simple route method uses Turf.js to buffer the route without calculating the route.
     * @param {Object} data - The data to filter
     * @returns {Array} - The filtered data
     */
async function calculateNoRoute(latlngs, minDistBetweenPoints = 0.1) { //0.01 is 10m
    let start = Date.now();

    await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update

    // Initialize an array to hold only the points that are sufficiently distant from each other
    let processedLatlngs = [];

    for (let i = 0; i < latlngs.length; i++) {
        const currentPoint = [latlngs[i][1], latlngs[i][0]]; // [lng, lat]
        let isFarEnough = true;

        // Check distance against all included points
        for (const includedPoint of processedLatlngs) {
            const distance = turf.distance(turf.point(includedPoint), turf.point(currentPoint), { units: 'kilometers' });
            if (distance < minDistBetweenPoints) {
                isFarEnough = false;
                break; // No need to check further if it's too close to any included point
            }
        }

        // Add the current point if it's far enough from all previous points
        if (isFarEnough) {
            processedLatlngs.push(currentPoint);

        }

        // Every 100 iterations, yield control back to the browser to allow the UI to update
        if (i % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Create a lineString from the filtered list of points
    let lineString = turf.lineString(processedLatlngs);

    let timeTaken = Date.now() - start;
    completeTask("no route calculation", timeTaken);

    return lineString;
}

/**
     * Draw the route on the map and buffer it using the simple route method. The simple route method uses Turf.js to buffer the route without calculating the route.
     * @param {Object} data - The data to filter
     * @returns {Array} - The filtered data
     */
async function calculateSimpleRoute(latlngs) {
    let start = Date.now();

    await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update

    // Split processing into smaller chunks
    let processedLatlngs = [];
    for (let i = 0; i < latlngs.length; i++) {
        processedLatlngs.push([latlngs[i][1], latlngs[i][0]]); // [lng, lat]

        // Every 100 iterations, yield control back to the browser to allow the UI to update
        if (i % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }


    let lineString = turf.lineString(processedLatlngs);

    let timeTaken = Date.now() - start;
    completeTask("simple route calculation", timeTaken);

    return lineString;
}

/**
 * Add all lineStrings to a single buffer rather than separate buffers, prevents overlap on map
 * @param {*} lineStrings array of linestrings to buffer
 * @param {*} tolerance turf.simplify tolerance
 * @param {*} color color for buffer on map
 * @param {Object} options - Optional parameters for caching
 * @param {Object} options.cachedBuffer - Previously cached buffer to merge with
 * @param {boolean} options.skipRender - If true, only calculate buffer without rendering
 * @returns {Object} The unified buffer GeoJSON
 */
async function createUnifiedBuffer(lineStrings, tolerance, color, options = {}) {
    const isFlight = color === "red";
    let unifiedBuffer = options.cachedBuffer || null;

    for (const lineString of lineStrings) {
        // Buffer each lineString and merge them into a single buffer
        const buffer = await drawBuffer(lineString, tolerance);
        if (unifiedBuffer) {
            try {
                unifiedBuffer = turf.union(unifiedBuffer, buffer);
            } catch (err) {
                console.error("Error merging buffers:", err);
                // If union fails, just use the new buffer
                unifiedBuffer = buffer;
            }
        } else {
            unifiedBuffer = buffer;
        }

        getLinestringStats(lineString, isFlight);
        updateProgressBar();
    }

    // If no lineStrings but we have a cached buffer, use that
    if (!unifiedBuffer && options.cachedBuffer) {
        unifiedBuffer = options.cachedBuffer;
    }

    // If skipRender is true, just return the buffer without rendering
    if (options.skipRender || !unifiedBuffer) {
        return unifiedBuffer;
    }

    renderCachedBuffer(unifiedBuffer, color);

    getBufferStats(unifiedBuffer, isFlight);
    updateProgressBar();

    return unifiedBuffer;
}

// A flight buffer never drives the viewport: fitting to it would zoom the map
// out to an airport even while flights are hidden.
function renderCachedBuffer(buffer, color) {
    if (!buffer) return;

    if (color === "red") {
        addFlightLayer(L.geoJSON(buffer, { style: flightBufferStyle() }), flightBufferStyle);
        return;
    }

    ensureZoomHook();
    let bufferLayer = L.geoJSON(buffer, { style: exploredStyle() }).addTo(map);
    exploredLayers.push(bufferLayer);

    try {
        const bounds = bufferLayer.getBounds();
        map.fitBounds(bounds);
    } catch (err) {
        console.log("No bounds found for buffer, err: " + err);
    }
}

/**
 * Merge a new buffer with a cached buffer
 * @param {Object} cachedBuffer - The cached buffer GeoJSON
 * @param {Object} newBuffer - The new buffer GeoJSON
 * @returns {Object} The merged buffer GeoJSON
 */
function mergeBuffers(cachedBuffer, newBuffer) {
    if (!cachedBuffer) return newBuffer;
    if (!newBuffer) return cachedBuffer;

    try {
        return turf.union(cachedBuffer, newBuffer);
    } catch (err) {
        console.error("Error merging buffers:", err);
        // If merge fails, return the new buffer
        return newBuffer;
    }
}

/**
 * Draw a buffer around the route using Turf.js.
 * @param {Object} lineString - The lineString to buffer
 * @returns {Object} - The buffer layer
 */
async function drawBuffer(lineString, tolerance) {
    let start = Date.now();

    let circleSize = 1; // Default circle size in km
    try {
        // Get the circle size from the UI
        circleSize = document.getElementById('circleSize').value;
    } catch (err) {
        console.log("No circle size found, using default");
    }

    let simplifiedLineString = lineString;
    if (tolerance != -1) {
        // Simplify the route in chunks to avoid freezing the UI
        simplifiedLineString = turf.simplify(lineString, { tolerance: tolerance, highQuality: false });
    }

    // Add a short pause to ensure the UI updates before buffering
    await new Promise(resolve => setTimeout(resolve, 0));

    //THIS IS THE LONG TASK
    // Buffer the simplified route with Turf.js in chunks
    let buffered;
    await new Promise(resolve => setTimeout(() => {
        buffered = turf.buffer(simplifiedLineString, circleSize, { units: 'kilometers', steps: 3 }); // 1 km buffer
        resolve();
    }, 0));

    let timeTaken = Date.now() - start;
    completeTask("buffer drawing", timeTaken);

    return buffered;
}

// --- Heatmap tunables -------------------------------------------------------
// Spatial resolution: ~0.0006 deg ~= 65 m cells. Fine enough to resolve distinct
// places while still collapsing repeat/stationary pings so frequency accumulates.
const HEATMAP_CELL_DEG = 0.0006;
// Data-driven scaling: the color ceiling is the Nth-percentile cell intensity (not
// the single busiest cell), so one extreme outlier can't wash everywhere else out.
const HEATMAP_SCALE_PERCENTILE = 0.99;
// Visual-only constants (pixels / appearance — intentionally independent of the data).
const HEATMAP_RADIUS_PX = 12;
const HEATMAP_BLUR_PX = 10;
const HEATMAP_MIN_OPACITY = 0.25;
const HEATMAP_MAX_ZOOM = 12;
const HEATMAP_GRADIENT = { 0.0: 'blue', 0.3: 'cyan', 0.5: 'lime', 0.7: 'yellow', 1.0: 'red' };
// ---------------------------------------------------------------------------

/**
 * Accumulate raw GPS points into a frequency grid, keyed "gx_gy" (cell indices),
 * value = visit count. Cells merge by simple addition, so this can be called
 * repeatedly to fold new data into an existing grid (used for incremental caching).
 * @param {Object} data - GeoJSON FeatureCollection from fetchLocations()
 * @param {Map<string, number>} grid - Existing grid to add to (defaults to a new one)
 * @returns {Map<string, number>} The grid
 */
function buildHeatGrid(data, grid = new Map()) {
    const cell = HEATMAP_CELL_DEG;
    for (const f of data.features) {
        const c = f.geometry?.coordinates;
        // Reuse the same 100 m accuracy filter used for route filtering
        if (!c || f.properties.acc >= 100) continue;
        const [lng, lat] = c;
        const key = Math.round(lat / cell) + '_' + Math.round(lng / cell);
        grid.set(key, (grid.get(key) || 0) + 1);
    }
    return grid;
}

// Cells along every driving segment, so the heatmap area covers the road between
// pings the way the routes buffer does. The heat grid itself only holds cells a
// ping landed in, which leaves most of a fast road uncovered. Flight fixes break
// the chain, matching how routes mode keeps flights out of the driving buffer.
// Returns the last chained point so the next incremental batch can join to it.
function buildPathGrid(data, grid = new Set(), prev = null) {
    const cell = HEATMAP_CELL_DEG;
    for (const f of data.features) {
        const c = f.geometry?.coordinates;
        if (!c || f.properties.acc >= 100) continue;
        if (isFlightFeature(f)) { prev = null; continue; }
        const [lng, lat] = c;
        if (prev) {
            const [plat, plng] = prev;
            const steps = Math.ceil(Math.max(Math.abs(lat - plat), Math.abs(lng - plng)) / cell);
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                grid.add(Math.round((plat + (lat - plat) * t) / cell) + '_' + Math.round((plng + (lng - plng) * t) / cell));
            }
        }
        grid.add(Math.round(lat / cell) + '_' + Math.round(lng / cell));
        prev = [lat, lng];
    }
    return prev;
}

function serializePathGrid(grid) {
    const cells = [];
    for (const key of grid) {
        const [gy, gx] = key.split('_');
        cells.push([Number(gx), Number(gy)]);
    }
    return cells;
}

function deserializePathGrid(cells) {
    const grid = new Set();
    if (!Array.isArray(cells)) return grid;
    for (const [gx, gy] of cells) grid.add(gy + '_' + gx);
    return grid;
}

// Ground area within radiusKm of any cell in the path grid, so the figure is
// comparable to the buffered-route area in routes mode. Works in local km (longitude scaled
// by cos of the mean latitude): the map is sliced into rows of height
// radiusKm / ROWS_PER_RADIUS, each visited cell contributes the chord of its disc
// at every row's midline, and the merged chord lengths give the union area.
// Rows carry a per-row cos(lat) correction for latitude drift across the region.
const KM_PER_DEG_LAT = 111.32;
const ROWS_PER_RADIUS = 8;
function pathGridAreaKm2(grid, radiusKm) {
    if (grid.size === 0 || !(radiusKm > 0)) return 0;
    const rowKm = radiusKm / ROWS_PER_RADIUS;

    let latSum = 0;
    const cells = [];
    for (const key of grid) {
        const [gy, gx] = key.split('_');
        const lat = Number(gy) * HEATMAP_CELL_DEG;
        cells.push([lat, Number(gx) * HEATMAP_CELL_DEG]);
        latSum += lat;
    }
    const cosRef = Math.cos((latSum / cells.length) * Math.PI / 180);

    const rows = new Map();
    let minRow = Infinity, maxRow = -Infinity;
    for (const [lat, lng] of cells) {
        const y = lat * KM_PER_DEG_LAT;
        const x = lng * KM_PER_DEG_LAT * cosRef;
        const r = Math.floor(y / rowKm);
        if (!rows.has(r)) rows.set(r, []);
        rows.get(r).push([x, y]);
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
    }

    let km2 = 0;
    for (let r = minRow - ROWS_PER_RADIUS; r <= maxRow + ROWS_PER_RADIUS; r++) {
        const spans = [];
        const yMid = (r + 0.5) * rowKm;
        for (let dr = -ROWS_PER_RADIUS; dr <= ROWS_PER_RADIUS; dr++) {
            const pts = rows.get(r + dr);
            if (!pts) continue;
            for (const [x, y] of pts) {
                const dy = y - yMid;
                const half = Math.sqrt(radiusKm * radiusKm - dy * dy);
                if (half > 0) spans.push([x - half, x + half]);
            }
        }
        if (spans.length === 0) continue;
        spans.sort((a, b) => a[0] - b[0]);
        let width = 0;
        let [lo, hi] = spans[0];
        for (let i = 1; i < spans.length; i++) {
            const [a, b] = spans[i];
            if (a > hi) {
                width += hi - lo;
                lo = a; hi = b;
            } else if (b > hi) {
                hi = b;
            }
        }
        width += hi - lo;
        const lat = yMid / KM_PER_DEG_LAT;
        km2 += width * rowKm * Math.cos(lat * Math.PI / 180) / cosRef;
    }
    return km2;
}

/**
 * Serialize a heat grid to a compact array for caching: [[gx, gy, count], ...].
 */
function serializeHeatGrid(grid) {
    const cells = [];
    for (const [key, count] of grid) {
        const [gy, gx] = key.split('_');
        cells.push([Number(gx), Number(gy), count]);
    }
    return cells;
}

/**
 * Rebuild a heat grid Map from its cached [[gx, gy, count], ...] representation.
 */
function deserializeHeatGrid(cells) {
    const grid = new Map();
    if (!Array.isArray(cells)) return grid;
    for (const [gx, gy, count] of cells) {
        grid.set(gy + '_' + gx, count);
    }
    return grid;
}

/**
 * Render a frequency grid to the map as a Leaflet.heat layer. Each cell becomes a
 * heat point at its cell center, weighted by a logarithmic function of its count.
 * @param {Map<string, number>} grid - Grid keyed "gx_gy" with visit counts
 */
function renderHeatGrid(grid) {
    let start = Date.now();

    const cell = HEATMAP_CELL_DEG;

    // Logarithmic intensity scaling: a place visited 100+ times would otherwise
    // pin `max` so high that everywhere else collapses to a single faint shade.
    // log(count + 1) compresses that range so frequency differences spread across
    // the whole gradient (a once-driven road stays cool; a daily haunt goes hot).
    const heatData = [];
    const bounds = [];
    const intensities = [];
    for (const [key, count] of grid) {
        const [gy, gx] = key.split('_');
        const lat = Number(gy) * cell;
        const lng = Number(gx) * cell;
        const intensity = Math.log(count + 1);
        heatData.push([lat, lng, intensity]);
        bounds.push([lat, lng]);
        intensities.push(intensity);
    }

    // Scale to a high percentile of cell intensities rather than the absolute max,
    // so a single freak outlier cell doesn't compress the rest of the map. Cells
    // above this ceiling simply saturate to the hottest color.
    intensities.sort((a, b) => a - b);
    const pIdx = Math.floor(HEATMAP_SCALE_PERCENTILE * (intensities.length - 1));
    const maxIntensity = intensities.length ? intensities[pIdx] : 1;

    heatLayer = L.heatLayer(heatData, {
        radius: HEATMAP_RADIUS_PX,
        blur: HEATMAP_BLUR_PX,
        minOpacity: HEATMAP_MIN_OPACITY,
        maxZoom: HEATMAP_MAX_ZOOM,
        max: maxIntensity || 1,
        gradient: HEATMAP_GRADIENT
    }).addTo(map);

    if (bounds.length) {
        try {
            map.fitBounds(bounds);
        } catch (err) {
            console.log("No bounds found for heatmap, err: " + err);
        }
    }

    let timeTaken = Date.now() - start;
    completeTask("rendering heatmap", timeTaken);
}

/**
 * Render a visitor-frequency heatmap directly from raw data (no-cache path).
 * @param {Object} data - GeoJSON FeatureCollection from fetchLocations()
 */
function renderHeatmap(data) {
    renderHeatGrid(buildHeatGrid(data));
}

function addPopup(lat, lng, feature) {
    //Add marker to the map (recommended only for small datasets, quite laggy)
    L.marker([lat, lng]).addTo(map)
        .bindPopup(`<b>${feature.properties.name}</b><br>Velocity: ${feature.properties.vel} km/h` +
            `<br>Altitude: ${feature.properties.alt} m` +
            `<br>Acceleration: ${feature.properties.acc} m/s²` +
            `<br>Time: ${feature.properties.isotst}` +
            `<br>Accuracy: ${feature.properties.acc} m` +
            `<br>Latitude: ` + lat + `°` +
            `<br>Longitude: ` + lng + `°`);
}

/**
 * Clears and redraws map with new data
 * @param {*} user
 * @param {*} device
 * @returns
 */
function resetMap() {
    console.log("Resetting map");

    try {
        resetProgressBar();
        eraseLayers();
        resetCoverageStats();
        clearFlightIntervals();
    }
    catch (err) {
        console.log("No map data to erase, err: " + err);
    }

    addBaseLayer();

    // get new data
    runTasks();
}

// Function to erase all layers from the map
function eraseLayers() {
    // Remove all layers (includes the heatmap layer, if present)
    map.eachLayer((layer) => {
        layer.remove();
    });
    flightLayers = [];
    flightLines = [];
    exploredLayers = [];
    heatLayer = null;
}