//settings

//skip points withing .5 km of the previous point
const minDistanceFilter = .5; // Adjust the distance threshold in kilometers (10 meters for example)
const drivingFlyingThresholdKMH = 200; // If above threshold, assume flying, else driving

//stats
let highestAltitude = 0;
let highestVelocity = 0;
let distanceKm = 0;
let area = 0;

let firstLoad = true;

function debuggingTest() {
    const point1 = { lat: 36.983253, lng: -121.970049 };
    const point2 = { lat: 36.983237, lng: -121.969948 };

    const dist = getDistanceFromLatLonInKm(point1.lat, point1.lng, point2.lat, point2.lng);
    console.log(`Distance between points: ${dist} km`);
}

/**
     * Fetch the users and devices from the server. This function is called after get user and device data succeeds. It attempts to pull the GPS data from the OwnTracks server and calls other methods to draw and handle extra details.
     */
async function fetchLocations() {
    let start = Date.now();

    try {
        // Build the query parameters
        const queryParams = new URLSearchParams({
            startdate: document.getElementById('startBox').value,
            enddate: document.getElementById('endBox').value,
            user: document.getElementById('userBox').value,
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

        //start date
        console.log("Start date of OwnTracks data is " + data.features[0].properties.isotst.substring(0, 10));

        //set start date filter to the first date in the data
        document.getElementById('startBox').value = data.features[0].properties.isotst.substring(0, 10);

        if (firstLoad) {
            document.getElementById('endBox').value = new Date().toLocaleDateString('en-CA');
            firstLoad = false;
        }

        //total gps points
        console.log("Total number of OwnTracks data points is " + data.features.length);


        let timeTaken = Date.now() - start;
        completeTask("fetching locations", timeTaken);

        // Return the fetched data
        return data;
    } catch (error) {
        setProgressBarError();  // Update progress bar with error state
        console.error('Fetch location error:', error);
    }
}

function changeDateRange(timeframe) {
    let start;
    let end;

    switch (timeframe) {
        case "month":
            start = new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('en-CA');
            end = new Date().toLocaleDateString('en-CA');
            break;
        case "week":
            start = new Date(new Date().setDate(new Date().getDate() - 7)).toLocaleDateString('en-CA');
            end = new Date().toLocaleDateString('en-CA');
            break;
        case "day":
            start = new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('en-CA');
            end = new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('en-CA');
            break;
        case "today":
            start = new Date().toLocaleDateString('en-CA');
            end = new Date().toLocaleDateString('en-CA');
            break;
    }
    document.getElementById('endBox').value = end;
    document.getElementById('startBox').value = start;

    console.log(`Start date: ${start}, End date: ${end}`);

    resetMap();
}

/**
 * Handles OwnTracks GPS points pulled from server and cleans them up. Skips data points with inaccurate coordinates, and notes the highest altitude and velocity.
 * @param {*} data GPS data from OwnTracks
 * @returns 
 */
async function filterData(data) {
    let start = Date.now();

    let drivingLatlngs = []; // Array to hold driving coordinates
    let flyingLatlngs = []; // Array to hold flying coordinates

    let currentMode = null; // Tracks the current mode: 'driving' or 'flying'
    let currentSegment = []; // Holds the current segment of points

    console.log(data.features[0]);

    data.features.forEach(feature => {
        if (feature.geometry?.coordinates) {
            const [lng, lat] = feature.geometry.coordinates;
            // Add coordinates to the array

            //markers with velocity of zero and high acceleration tend to be very inaccurate, skip them
            if (feature.properties.acc < 100) { //feature.properties.vel > 5 || feature.properties.vel == 0 && feature.properties.acc < 100


                if (currentSegment.length > 0) {
                    const lastPoint = currentSegment[currentSegment.length - 1];
                    const dist = getDistanceFromLatLonInKm(lastPoint[0], lastPoint[1], lat, lng);

                    // Only add the point if it's farther than the minimum distance
                    if (dist > minDistanceFilter) {
                        const isFlying = feature.properties.vel > drivingFlyingThresholdKMH;

                        // Check if the mode has changed
                        if (
                            (isFlying && currentMode !== 'flying') ||
                            (!isFlying && currentMode !== 'driving')
                        ) {
                            // Save the current segment to the appropriate array
                            if (currentMode === 'flying') {
                                flyingLatlngs.push(currentSegment);
                            } else if (currentMode === 'driving') {
                                console.log("Driving segment: " + currentSegment);
                                drivingLatlngs.push(currentSegment);
                            }

                            // Start a new segment
                            currentSegment = [];
                            currentMode = isFlying ? 'flying' : 'driving';
                        }

                        // Add the point to the current segment
                        currentSegment.push([lat, lng]);
                    }
                } else {
                    // Always add the first point
                    currentSegment.push([lat, lng]);
                    currentMode = feature.properties.vel > drivingFlyingThresholdKMH ? 'flying' : 'driving';
                }
            }
        }
    });

    // Save the last segment to the appropriate array
    if (currentSegment.length > 0) {
        if (currentMode === 'flying') {
            flyingLatlngs.push(currentSegment);
        } else if (currentMode === 'driving') {
            drivingLatlngs.push(currentSegment);
        }
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
 * Calculates total distance and area of the route and displays it on the page
 * @param {*} user
 * @param {*} device
 * @returns
 */
function getCoverageStats(buffered, lineString) {
    //TODO: fix this to handle multiple linestrings (add to vars rather than overwrite)
    let start = Date.now();

    // Convert distance to kilometers
    distanceKm += turf.length(lineString, { units: 'kilometers' }); // Total distance in kilometers

    document.getElementById('totalDist').innerHTML = "<p>" + Math.round(distanceKm * 100) / 100 + "km or " + Math.round((distanceKm / 1.609) * 100) / 100 + "mi</p>";

    // Calculate the total area of the route
    area += turf.area(buffered) / 1e6; // Convert m² to km²

    document.getElementById('totalArea').innerHTML = "<p>" + Math.round(area * 100) / 100 + "km² or " + Math.round((area / 1.609) * 100) / 100 + "mi²</p>";

    document.getElementById('totalAreaPct').innerHTML = "<p>" + area / 863428 + "%" + "</p>";

    let timeTaken = Date.now() - start;
    completeTask("coverage stats", timeTaken);
}

function resetCoverageStats() {
    distanceKm = 0;
    area = 0;
    document.getElementById('totalDist').innerHTML = "<p>0km or 0mi</p>";
    document.getElementById('totalArea').innerHTML = "<p>0km² or 0mi²</p>";
    document.getElementById('totalAreaPct').innerHTML = "<p>0%</p>";
}


function getOwntracksStats(data) {
    let start = Date.now();

    let highestAltitude = 0;
    let highestVelocity = 0;

    data.features.forEach(feature => {
        if (feature.properties.alt > highestAltitude) {
            highestAltitude = feature.properties.alt;
        }
        if (feature.properties.vel > highestVelocity) {
            highestVelocity = feature.properties.vel;
        }
    });


    //highest altitude
    document.getElementById('highestAltitude').innerHTML = "<p>" + highestAltitude + "m or " + Math.round((highestAltitude * 3.281) * 100) / 100 + "ft</p>";

    //highest velocity
    document.getElementById('highestVelocity').innerHTML = "<p>" + highestVelocity + "kmh or " + Math.round((highestVelocity / 1.609) * 100) / 100 + "mph</p>";

    let timeTaken = Date.now() - start;
    completeTask("OwnTracks stats", timeTaken);
}