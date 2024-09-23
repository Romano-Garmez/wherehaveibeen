//globals
var highestAltitude = 0;
var highestVelocity = 0;

/**
 * Handles OwnTracks GPS points pulled from server and cleans them up. Skips data points with inaccurate coordinates, and notes the highest altitude and velocity.
 * @param {*} data GPS data from OwnTracks
 * @returns 
 */
function filterData(data) {

    var latlngs = [];

    console.log(data.features[0]);

    data.features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            const [lng, lat] = feature.geometry.coordinates;
            // Add coordinates to the array

            //markers with velocity of zero and high acceleration tend to be very inaccurate, skip them
            if (feature.properties.acc < 100) { //feature.properties.vel > 5 || feature.properties.vel == 0 && feature.properties.acc < 100

                latlngs.push([lat, lng]);



                if (feature.properties.alt > highestAltitude) {
                    highestAltitude = feature.properties.alt;
                }
                if (feature.properties.vel > highestVelocity) {
                    highestVelocity = feature.properties.vel;
                }

                // Add marker to the map (recommended only for small datasets, quite laggy)
                // L.marker([lat, lng]).addTo(map)
                //     .bindPopup(`<b>${feature.properties.name}</b><br>Velocity: ${feature.properties.vel} km/h` +
                //         `<br>Altitude: ${feature.properties.alt} m` +
                //         `<br>Acceleration: ${feature.properties.acc} m/s²` +
                //         `<br>Time: ${feature.properties.isotst}`);
            } else {

                //console.log("Skipping inaccurate data point with velocity " + feature.properties.vel + " and acceleration " + feature.properties.acc);
            }

        }
    });

    return latlngs;

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
 * Contacts the OwnTracks server to see what users and devices have been uploading data
 * @param {*} data
 * @returns
 * 
 */
async function getUsersAndDevices() {
    return fetch('/usersdevices')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching users and devices. Are you logged in?`);
            }
            return response.json();  // Parse the JSON from the response
        })
        .then(data => {


            // Iterate through the data and populate the sets
            var select = document.getElementById("userBox");
            select.innerHTML = '';

            select = document.getElementById("deviceBox");
            select.innerHTML = '';

            var el;

            data.forEach(entry => {
                if (entry.username) {
                    select = document.getElementById("userBox");

                    el = document.createElement("option");
                    el.textContent = entry.username;
                    el.value = entry.username;
                    select.appendChild(el);
                }
                if (entry.device) {
                    select = document.getElementById("deviceBox");

                    el = document.createElement("option");
                    el.textContent = entry.device;
                    el.value = entry.device;
                    select.appendChild(el);
                }
            });

            return 0;

        })
        .catch(error => {
            console.error('Fetch users and devices error:', error);
            return -1;
        });

}

/**
 * Calculates total distance and area of the route and displays it on the page
 * @param {*} user
 * @param {*} device
 * @returns
 */
function getCoverageStats(buffered, lineString) {
    let start = Date.now();

    // Convert distance to kilometers
    var distanceKm = turf.length(lineString, { units: 'kilometers' }); // Total distance in kilometers

    document.getElementById('totalDist').innerHTML = "<p>" + Math.round(distanceKm * 100) / 100 + "km or " + Math.round((distanceKm / 1.609) * 100) / 100 + "mi</p>";

    // Calculate the total area of the route
    var area = turf.area(buffered) / 1e6; // Convert m² to km²

    document.getElementById('totalArea').innerHTML = "<p>" + Math.round(area * 100) / 100 + "km² or " + Math.round((area / 1.609) * 100) / 100 + "mi²</p>";

    document.getElementById('totalAreaPct').innerHTML = "<p>" + area / 863440 + "%" + "</p>";

    let timeTaken = Date.now() - start;
    console.log("Coverage stats time taken : " + timeTaken + " milliseconds");
}

function getOwntracksStats(datafeatures, highestAltitude, highestVelocity) {
    //start date
    console.log("Start date of OwnTracks data is " + datafeatures[0].properties.isotst.substring(0, 10));

    //total gps points
    console.log("Total number of OwnTracks data points is " + datafeatures.length);

    //highest altitude
    document.getElementById('highestAltitude').innerHTML = "<p>" + highestAltitude + "m or " + Math.round((highestAltitude * 3.281) * 100) / 100 + "ft</p>";

    //highest velocity
    document.getElementById('highestVelocity').innerHTML = "<p>" + highestVelocity + "kmh or " + Math.round((highestVelocity / 1.609) * 100) / 100 + "mph</p>";
}

/**
 * Clears and redraws map with new data
 * @param {*} user
 * @param {*} device
 * @returns
 */
function filterMap(map) {
    console.log("Filtering map");

    try {
        eraseRoute(map);
        eraseLayers(map);
    }
    catch (err) {
        console.log("No map data to erase");
    }


    //Remake route
    // Add a tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // get new data
    fetchLocations();
}

// Function to erase the route from the map
function eraseRoute(map) {
    map.removeControl(control);
}

// Function to erase all layers from the map
function eraseLayers(map) {
    map.eachLayer((layer) => {
        layer.remove();
    });
}

/**
 * Shows the login prompt
 */
function openForm() {
    document.getElementById("myForm").style.display = "block";
    document.getElementById("sign_out").style.display = "none"
}

/**
 * Closes the login prompt
 */
function closeForm() {
    document.getElementById("myForm").style.display = "none";
    document.getElementById("sign_out").style.display = "block";
}