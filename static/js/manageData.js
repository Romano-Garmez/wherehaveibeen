//globals
let highestAltitude = 0;
let highestVelocity = 0;

let tasksDone = [];
let progressBarNumSteps = 5;
let progressBarError = false;

/**
 * Handles OwnTracks GPS points pulled from server and cleans them up. Skips data points with inaccurate coordinates, and notes the highest altitude and velocity.
 * @param {*} data GPS data from OwnTracks
 * @returns 
 */
function filterData(data) {
    let highestAltitude = 0;
    let highestVelocity = 0;

    let latlngs = [];

    console.log(data.features[0]);

    data.features.forEach(feature => {
        if (feature.geometry?.coordinates) {
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
            }
        }
    });

    setTimeout(() => {
        getOwntracksStats(highestAltitude, highestVelocity);
    }, 50);

    return latlngs;

}

/**
 * Mark a task complete and update the progress bar. Prints to console with what task finished and how long it took to complete.
 * @param {*} task 
 * @param {*} timeTaken 
 */
function completeTask(task, timeTaken) {
    tasksDone.push(task);
    console.log("Task " + task + " completed in " + timeTaken + " milliseconds");

    // Allow the browser to repaint after the task completes
    setTimeout(updateProgressBar, 0);
}

/**
 * Return num of completed tasks
 * @returns number of completed tasks
 */
function getNumTasksDone() {
    return tasksDone.length;
}

/**
 * Updates the progress bar based on the number of tasks completed
 * Changes color based on status
 */
function updateProgressBar() {
    console.log("Updating progress bar with value " + getNumTasksDone());

    let totalTasks = progressBarNumSteps;

    let progress = Math.round((getNumTasksDone() / totalTasks) * 100);

    document.getElementById("progressBarInner").style.width = progress + "%";

    if (progressBarError) {
        document.getElementById("progressBarInner").style.backgroundColor = "#FF0000";
    }
    else if (progress == 100) {
        document.getElementById("progressBarInner").style.backgroundColor = "#04AA6D";
    }
    else {
        document.getElementById("progressBarInner").style.backgroundColor = "#4870AF";
    }

}

/**
 * Set how many tasks are required for "complete" status of progress bar, so far it's 5 for simple route planner and 6 for complex. 
 * Complex has the extra step of drawing the route.
 * @param {*} num 
 */
function setProgressBarNumSteps(num) {
    progressBarNumSteps = num;
}

/**
 * Set the progress bar to error status
 */
function setProgressBarError() {
    progressBarError = true;
}

/**
 * Reset the progress bar to 0%
 */
function resetProgressBar() {
    tasksDone = [];
    progressBarError = false;
    updateProgressBar();
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
            let select = document.getElementById("userBox");
            select.innerHTML = '';

            select = document.getElementById("deviceBox");
            select.innerHTML = '';

            let el;

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
    let distanceKm = turf.length(lineString, { units: 'kilometers' }); // Total distance in kilometers

    document.getElementById('totalDist').innerHTML = "<p>" + Math.round(distanceKm * 100) / 100 + "km or " + Math.round((distanceKm / 1.609) * 100) / 100 + "mi</p>";

    // Calculate the total area of the route
    let area = turf.area(buffered) / 1e6; // Convert m² to km²

    document.getElementById('totalArea').innerHTML = "<p>" + Math.round(area * 100) / 100 + "km² or " + Math.round((area / 1.609) * 100) / 100 + "mi²</p>";

    document.getElementById('totalAreaPct').innerHTML = "<p>" + area / 863440 + "%" + "</p>";

    let timeTaken = Date.now() - start;
    completeTask("coverage stats", timeTaken);
}

function getOwntracksStats(highestAltitude, highestVelocity) {
    let start = Date.now();

    //highest altitude
    document.getElementById('highestAltitude').innerHTML = "<p>" + highestAltitude + "m or " + Math.round((highestAltitude * 3.281) * 100) / 100 + "ft</p>";

    //highest velocity
    document.getElementById('highestVelocity').innerHTML = "<p>" + highestVelocity + "kmh or " + Math.round((highestVelocity / 1.609) * 100) / 100 + "mph</p>";

    let timeTaken = Date.now() - start;
    completeTask("OwnTracks stats", timeTaken);
}

/**
 * Clears and redraws map with new data
 * @param {*} user
 * @param {*} device
 * @returns
 */
function filterMap() {
    console.log("Filtering map");

    try {
        resetProgressBar();
        eraseLayers();
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
    fetchLocations();
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