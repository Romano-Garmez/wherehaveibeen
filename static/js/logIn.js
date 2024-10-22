let loggedIn = false;

function checkIfLoggedIn() {
    if (loggedIn) {
        completeTask("logged in", 0);
    }
    return loggedIn;
}

/**
 * Contacts the OwnTracks server to see what users and devices have been uploading data
 * @param {*} data
 * @returns
 * 
 */
async function getUsersAndDevices() {
    try {
        const response = await fetch('/usersdevices');

        if (!response.ok) {
            loggedIn = false;
            throw new Error('Error fetching users and devices. Are you logged in?');
        }

        const data = await response.json(); // Parse the JSON from the response

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
        loggedIn = true;

        return 0;  // Return 0 if everything is successful

    } catch (error) {
        console.error('Fetch users and devices error:', error);
        loggedIn = false;
        return -1; // Return -1 in case of an error
    }
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