/**
     * Draw the route on the map and buffer it using the simple route method. The simple route method uses Turf.js to buffer the route without calculating the route.
     * @param {Object} data - The data to filter
     * @returns {Array} - The filtered data
     */
async function calculateNoRoute(latlngs, minDistBetweenPoints=0.1) { //0.01 is 10m
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
 * Draw the route on the map using Leaflet Routing Machine.
 * @param {Array} latlngs - The gps points to draw the route with
 */
async function calculateComplexRoute(latlngs) {
    let start = Date.now();
    const osrmRouter = document.getElementById('osrmURL').value;

    if (osrmRouter != "") {
        console.log("Using custom OSRM router: " + osrmRouter);
    }else{
        console.log("Using default OSRM router");
    }

    // Construct the service URL
    const serviceUrl = `/proxy?osrmURL=${encodeURIComponent(osrmRouter)}&coords=`;

    console.log("Service URL: ", serviceUrl);

    return new Promise((resolve, reject) => {
        let control = L.routing.control({
            waypoints: latlngs
                .map(function (latlng) {
                    return L.latLng(latlng[0], latlng[1]);
                }),
            router: L.Routing.osrmv1({
                serviceUrl: serviceUrl,
                profile: 'car', // or 'bike', 'foot' depending on your needs
            }),
            routeWhileDragging: false,
            createMarker: function () { return null; }, // Disable default marker
        }).addTo(map);

        control.hide(); // hide top right panel

        control.on('routesfound', function (e) {
            let routes = e.routes;

            // Create a lineString for buffering based on the actual route
            let routeCoords = routes[0].coordinates.map(coord => [coord.lng, coord.lat]);
            let lineString = turf.lineString(routeCoords);

            let timeTaken = Date.now() - start;
            completeTask("complex route calculation", timeTaken);

            // Resolve the promise with the lineString
            resolve(lineString);
        });

        // Handle errors if needed
        control.on('routingerror', function (error) {
            reject(new Error("Routing failed: " + error.message));
        });
    });
}

/**
 * Draw a buffer around the route using Turf.js.
 * @param {Object} lineString - The lineString to buffer
 * @returns {Object} - The buffer layer
 */
async function drawBuffer(lineString, tolerance) {
    let start = Date.now();

    // Get the circle size from the UI
    const circleSize = document.getElementById('circleSize').value;

    // Simplify the route in chunks to avoid freezing the UI
    let simplifiedLineString = turf.simplify(lineString, { tolerance: tolerance, highQuality: false });

    // Add a short pause to ensure the UI updates before buffering
    await new Promise(resolve => setTimeout(resolve, 0));

    //THIS IS THE LONG TASK
    // Buffer the simplified route with Turf.js in chunks
    let buffered;
    await new Promise(resolve => setTimeout(() => {
        buffered = turf.buffer(simplifiedLineString, circleSize, { units: 'kilometers', steps: 3 }); // 1 km buffer
        resolve();
    }, 0));

    // Convert the buffer to GeoJSON and add it to the map
    let bufferLayer = L.geoJSON(buffered, {
        style: function () {
            return { color: 'rgba(0, 0, 255, 0.4)', weight: 2 };
        }
    }).addTo(map);

    let timeTaken = Date.now() - start;
    completeTask("buffer drawing", timeTaken);

    // Adjust the map to fit the new buffer bounds
    const bounds = bufferLayer.getBounds();
    map.fitBounds(bounds);

    return buffered;
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
        resetCoverageStats()
    }
    catch (err) {
        console.log("No map data to erase, err: " + err);
    }


    //Remake route
    // Add a tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // get new data
    runTasks();
}

// Function to erase the route from the map
function eraseRoute() {
    map.removeControl(control);
}

// Function to erase all layers from the map
function eraseLayers() {
    map.eachLayer((layer) => {
        layer.remove();
    });
}