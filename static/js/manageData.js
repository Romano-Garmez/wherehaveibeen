//settings

//skip points withing .5 km of the previous point
const minDistanceFilter = .5; // Adjust the distance threshold in kilometers (10 meters for example)
const drivingFlyingThresholdMPH = 200; // If above threshold, assume flying, else driving
const drivingFlyingThresholdKMH = drivingFlyingThresholdMPH * KM_PER_MI;
const distanceBetweenPointsFlyingThreshold = 100; // If distance is greater than this, assume flying

//stats: driving and flight figures are accumulated separately so the Flights
//toggle can include or exclude them without recomputing anything
let highestAltitude = 0;
let highestVelocity = 0;
let distanceKm = 0;
let area = 0;
let flightHighestAltitude = 0;
let flightHighestVelocity = 0;
let flightDistanceKm = 0;
let flightArea = 0;

let firstLoad = true;

let activeTimeframe = 'all';

function debuggingTest() {
    const point1 = { lat: 36.983253, lng: -121.970049 };
    const point2 = { lat: 36.983237, lng: -121.969948 };

    const dist = getDistanceFromLatLonInKm(point1.lat, point1.lng, point2.lat, point2.lng);
    console.log(`Distance between points: ${dist} km`);
}

// Convert datetime-local value to ISO 8601 UTC string
function toUTCISOString(id) {
    const value = document.getElementById(id).value;
    return value ? new Date(value).toISOString() : '';
}

/**
 * Fetch the users and devices from the server. This function is called after get user and device data succeeds.
 * It attempts to pull the GPS data from the OwnTracks server and calls other methods to draw and handle extra details.
 * @param {Object} options - Optional parameters
 * @param {string} options.startDate - Optional ISO start date (for incremental loading from cache)
 * @param {string} options.endDate - Optional ISO end date
 * @param {string} options.taskName - Optional task name for progress bar
 */
async function fetchLocations(options = {}) {
    let start = Date.now();
    const taskName = options.taskName || "fetching locations";

    try {
        // Use provided dates or fall back to DOM values
        let startDate, endDate;

        if (options.startDate) {
            startDate = options.startDate;
        } else {
            startDate = toUTCISOString('startBox');
        }

        if (options.endDate) {
            endDate = options.endDate;
        } else {
            endDate = toUTCISOString('endBox');
        }

        // Build the query parameters
        const queryParams = new URLSearchParams({
            startdate: startDate,
            enddate: endDate,
            device: document.getElementById('deviceBox').value
        }).toString();

        // Make the fetch request
        const response = await fetch(`/locations?${queryParams}`);

        // Check if response is not OK
        if (!response.ok) {
            setProgressBarError();  // Update progress bar with error state
            throw new Error('Error fetching location data. Are you logged in?');
        }

        // Parse the response JSON
        const data = await response.json();

        // Handle empty data
        if (!data.features || data.features.length === 0) {
            console.log("No GPS data found for the specified time range");
            let timeTaken = Date.now() - start;
            completeTask(taskName, timeTaken);
            return { features: [], isEmpty: true };
        }

        //start date
        console.log("Start date of OwnTracks data is " + data.features[0].properties.isotst.substring(0, 10));


        // If it's the first load, set the end box to the current date & time (local), and set start date to the first timestamp in the data
        if (firstLoad) {
            // Set start date to first UTC timestamp in the data, converted to local
            const firstTimestamp = new Date(data.features[0].properties.isotst);
            document.getElementById('startBox').value = toLocalDatetimeInputValue(firstTimestamp);

            // Set end date to current time, converted to local
            const now = new Date();
            document.getElementById('endBox').value = toLocalDatetimeInputValue(now);

            firstLoad = false;
        }

        //total gps points
        console.log("Total number of OwnTracks data points is " + data.features.length);


        let timeTaken = Date.now() - start;
        completeTask(taskName, timeTaken);

        // Return the fetched data
        return data;
    } catch (error) {
        setProgressBarError();  // Update progress bar with error state
        console.error('Fetch location error:', error);
        return null;
    }
}

/**
 * Get the latest timestamp from GPS data features
 * @param {Object} data - GeoJSON data with features
 * @returns {string|null} ISO timestamp of the latest GPS point
 */
function getLatestTimestamp(data) {
    if (!data || !data.features || data.features.length === 0) {
        return null;
    }

    // Features are typically ordered chronologically, so the last one is the latest
    const lastFeature = data.features[data.features.length - 1];
    return lastFeature.properties.isotst;
}

/**
 * Get the earliest timestamp from GPS data features
 * @param {Object} data - GeoJSON data with features
 * @returns {string|null} ISO timestamp of the earliest GPS point
 */
function getEarliestTimestamp(data) {
    if (!data || !data.features || data.features.length === 0) {
        return null;
    }

    // Features are typically ordered chronologically, so the first one is the earliest
    const firstFeature = data.features[0];
    return firstFeature.properties.isotst;
}

// Helper: converts UTC Date to local time string suitable for datetime-local input
function toLocalDatetimeInputValue(utcDate) {
    const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}


function changeDateRange(timeframe) {
    let start;
    const now = new Date();

    let end = toLocalDatetimeInputValue(now);

    switch (timeframe) {
        case "month":
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setMonth(now.getMonth() - 1);
            start = toLocalDatetimeInputValue(oneMonthAgo);
            break;
        case "week":
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(now.getDate() - 7);
            start = toLocalDatetimeInputValue(oneWeekAgo);
            break;
        case "48hrs":
            start = toLocalDatetimeInputValue(new Date(now.getTime() - 48 * 60 * 60 * 1000));
            break;
        case "24hrs":
            start = toLocalDatetimeInputValue(new Date(now.getTime() - 24 * 60 * 60 * 1000));
            break;
    }
    document.getElementById('endBox').value = end;
    document.getElementById('startBox').value = start;

    console.log(`Start date: ${start}, End date: ${end}`);

    // Mark that user has applied a custom time filter (disables cache)
    if (typeof setCustomTimeFilter === 'function') {
        setCustomTimeFilter();
    }

    activeTimeframe = timeframe;
    if (typeof syncTimeframeUI === 'function') {
        syncTimeframeUI();
    }

    resetMap();
}

/**
 * Handles OwnTracks GPS points pulled from server and cleans them up. Skips data points with inaccurate coordinates, and notes the highest altitude and velocity.
 * @param {*} data GPS data from OwnTracks
 * @returns 
 */
// A plane is well below the entry speed on the take-off roll and on final
// approach, so a flight is detected as an episode rather than point by point:
// it opens on a fast point (or a >100 km jump), pulls in the still-fast points
// just before it, and only closes once speed falls to taxiing pace, which a car
// on a freeway does but a plane on approach never does.
const FLIGHT_EXIT_KMH = 100;
// Above the highest road on Earth (~5,600 m): a fix this high is airborne
// whatever its speed says.
const FLIGHT_ALTITUDE_M = 6000;
const FLIGHT_LOOKBACK_SECONDS = 30 * 60;
const FLIGHT_STALE_SECONDS = 30 * 60;

// [startSeconds, endSeconds] per detected flight from the last filterData run;
// null when no detection has run for the current data (heatmap mode).
let lastFlightIntervals = null;

function featureTime(feature) {
    const p = feature.properties;
    if (p.tst != null) return Number(p.tst);
    return Date.parse(p.isotst) / 1000;
}

function clearFlightIntervals() {
    lastFlightIntervals = null;
}

function isFlightFeature(feature) {
    if (lastFlightIntervals === null) {
        return feature.properties.vel > drivingFlyingThresholdKMH;
    }
    const t = featureTime(feature);
    return lastFlightIntervals.some(([from, to]) => t >= from && t <= to);
}

// Classifies every fix as flying or not and records the flight time windows
// used by the stats. Classification runs over ALL fixes: aircraft GPS often
// reports poor accuracy, and the accuracy/min-distance filters only apply to
// what gets drawn. Returns the drawable subset with its flags.
function detectFlights(data) {
    const all = [];
    let prev = null;
    data.features.forEach(feature => {
        if (!feature.geometry?.coordinates) return;
        const [lng, lat] = feature.geometry.coordinates;
        const jump = prev ? getDistanceFromLatLonInKm(prev.lat, prev.lng, lat, lng) : 0;
        const point = {
            lat, lng, jump,
            vel: feature.properties.vel || 0,
            alt: feature.properties.alt || 0,
            acc: feature.properties.acc,
            tst: featureTime(feature)
        };
        all.push(point);
        prev = point;
    });

    const flying = new Array(all.length).fill(false);
    let airborne = false;
    let lastSignalTime = null;
    all.forEach((point, i) => {
        const fast = point.vel > drivingFlyingThresholdKMH;
        const high = point.alt > FLIGHT_ALTITUDE_M;
        const jumped = point.jump > distanceBetweenPointsFlyingThreshold;
        const signal = fast || high || jumped;
        if (!airborne && signal) {
            airborne = true;
            // Pull the take-off roll into the flight. The point right before a
            // jump is exempt from the time window: it is the last fix the phone
            // sent before going quiet in the air, however long the flight was.
            let ref = point.tst;
            for (let j = i - 1; j >= 0 && !flying[j]; j--) {
                if (all[j].vel <= FLIGHT_EXIT_KMH) break;
                const beforeJump = jumped && j === i - 1;
                if (!beforeJump && ref - all[j].tst > FLIGHT_LOOKBACK_SECONDS) break;
                flying[j] = true;
                ref = all[j].tst;
            }
        } else if (airborne && !signal) {
            const stale = lastSignalTime !== null && point.tst - lastSignalTime > FLIGHT_STALE_SECONDS;
            if (point.vel < FLIGHT_EXIT_KMH || stale) airborne = false;
        }
        if (signal) lastSignalTime = point.tst;
        flying[i] = airborne;
    });

    const intervals = [];
    let i = 0;
    while (i < all.length) {
        let j = i;
        while (j < all.length && flying[j] === flying[i]) j++;
        if (flying[i]) intervals.push([all[i].tst, all[j - 1].tst]);
        i = j;
    }
    lastFlightIntervals = intervals;

    //markers with velocity of zero and high acceleration tend to be very inaccurate, skip them
    const kept = [];
    const keptFlying = [];
    let lastKept = null;
    all.forEach((point, idx) => {
        if (point.acc >= 100) return;
        const gap = lastKept ? getDistanceFromLatLonInKm(lastKept.lat, lastKept.lng, point.lat, point.lng) : 0;
        if (lastKept && gap <= minDistanceFilter) return;
        kept.push(point);
        // The fixes that carried the jump may have been dropped for accuracy,
        // so a long link between drawable fixes is a flight in its own right.
        keptFlying.push(flying[idx] || gap > distanceBetweenPointsFlyingThreshold);
        lastKept = point;
    });

    return { kept, flying: keptFlying };
}

async function filterData(data) {
    let start = Date.now();

    const { kept, flying } = detectFlights(data);

    const drivingLatlngs = [];
    const flyingLatlngs = [];
    let i = 0;
    while (i < kept.length) {
        const mode = flying[i];
        let j = i;
        while (j < kept.length && flying[j] === mode) j++;
        const group = kept.slice(i, j);
        if (mode) {
            // bridge to the road at both ends so the flight connects to the drives
            if (i > 0) group.unshift(kept[i - 1]);
            if (j < kept.length) group.push(kept[j]);
        }
        const latlngs = group.map(p => [p.lat, p.lng]);
        if (latlngs.length > 1) (mode ? flyingLatlngs : drivingLatlngs).push(latlngs);
        i = j;
    }

    let timeTaken = Date.now() - start;
    completeTask("filtering data", timeTaken);

    return { drivingLatlngs, flyingLatlngs };
}


// Haversine formula to calculate distance between two lat/lng points
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Returns the highest altitude from the OwnTracks data
 * 
 */
function getHighestAltitude() {
    return highestAltitude;
}

/**
 * Returns the highest velocity from the OwnTracks data
 * 
 */
function getHighestVelocity() {
    return highestVelocity;
}

/**
 * Adds the linestring's length to the running distance total. Flight segments
 * still count as a progress-bar task but are kept out of the total.
 */
function flightsIncluded() {
    return typeof getFlightsShown === 'function' && getFlightsShown();
}

function refreshStats() {
    const incl = flightsIncluded();
    showDistanceStat(distanceKm + (incl ? flightDistanceKm : 0), incl);
    showAreaStat(area + (incl ? flightArea : 0));
    showAltitudeStat(incl ? Math.max(highestAltitude, flightHighestAltitude) : highestAltitude);
    showSpeedStat(incl ? Math.max(highestVelocity, flightHighestVelocity) : highestVelocity, drivingFlyingThresholdKMH);
}

function getLinestringStats(lineString, isFlight = false) {
    let start = Date.now();

    const km = turf.length(lineString, { units: 'kilometers' });
    if (isFlight) {
        flightDistanceKm += km;
    } else {
        distanceKm += km;
    }
    refreshStats();

    let timeTaken = Date.now() - start;
    completeTask("linestring stats", timeTaken);
}

function getBufferStats(buffer, isFlight = false) {
    let start = Date.now();

    const km2 = turf.area(buffer) / 1e6;
    if (isFlight) {
        flightArea = km2;
    } else {
        area += km2;
    }
    refreshStats();

    let timeTaken = Date.now() - start;
    completeTask("buffer stats", timeTaken);
}

function recordFlightBuffer(buffer) {
    flightArea = buffer ? turf.area(buffer) / 1e6 : 0;
    refreshStats();
}

function resetAreaStats() {
    area = 0;
    flightArea = 0;
    refreshStats();
}

function resetCoverageStats() {
    distanceKm = 0;
    flightDistanceKm = 0;
    resetAreaStats();
}

function accumulatePointStats(data) {
    let fastestDrivingPoint = null;
    let highestDrivingPoint = null;
    data.features.forEach(feature => {
        const { alt, vel } = feature.properties;
        if (isFlightFeature(feature)) {
            if (alt > flightHighestAltitude) flightHighestAltitude = alt;
            if (vel > flightHighestVelocity) flightHighestVelocity = vel;
        } else {
            if (alt > highestAltitude) {
                highestAltitude = alt;
                highestDrivingPoint = feature;
            }
            if (vel > highestVelocity) {
                highestVelocity = vel;
                fastestDrivingPoint = feature;
            }
        }
    });
    if (fastestDrivingPoint) {
        const p = fastestDrivingPoint.properties;
        console.log(`Top driving speed ${p.vel} km/h at ${p.isotst}`, fastestDrivingPoint.geometry.coordinates);
    }
    if (highestDrivingPoint) {
        const p = highestDrivingPoint.properties;
        console.log(`Top driving altitude ${p.alt} m at ${p.isotst}`, highestDrivingPoint.geometry.coordinates);
    }
}

function getOwntracksStats(data) {
    let start = Date.now();

    highestAltitude = 0;
    highestVelocity = 0;
    flightHighestAltitude = 0;
    flightHighestVelocity = 0;
    accumulatePointStats(data);
    refreshStats();

    let timeTaken = Date.now() - start;
    completeTask("OwnTracks stats", timeTaken);
}

/**
 * Incremental stats calculation - compares against existing global values
 * Used when adding new data to cached data
 */
function getOwntracksStatsIncremental(data) {
    let start = Date.now();

    accumulatePointStats(data);
    refreshStats();

    let timeTaken = Date.now() - start;
    completeTask("OwnTracks stats (incremental)", timeTaken);
}

function currentMetrics() {
    return {
        highestAltitude,
        highestVelocity,
        totalDistance: distanceKm,
        flight: {
            highestAltitude: flightHighestAltitude,
            highestVelocity: flightHighestVelocity,
            totalDistance: flightDistanceKm
        }
    };
}

/**
 * Restore metrics from cache and update DOM
 */
function setCachedMetrics(metrics) {
    if (!metrics) return;
    const flight = metrics.flight || {};
    highestAltitude = metrics.highestAltitude || 0;
    highestVelocity = metrics.highestVelocity || 0;
    distanceKm = metrics.totalDistance || 0;
    flightHighestAltitude = flight.highestAltitude || 0;
    flightHighestVelocity = flight.highestVelocity || 0;
    flightDistanceKm = flight.totalDistance || 0;
    refreshStats();
}
