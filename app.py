import sys
from flask import (
    Flask,
    redirect,
    render_template,
    jsonify,
    request,
    session,
)
import requests
from requests.auth import HTTPBasicAuth
from datetime import timedelta
import os

debug = False
INTERNAL_ERROR_MESSAGE = "An internal error has occurred."

if debug:
    # Load environment variables from .env file
    from dotenv import load_dotenv

    load_dotenv()  # take environment variables from .env.

app = Flask(__name__)

app.secret_key = os.getenv("WHIB_FLASK_SECRET_KEY")
app.permanent_session_lifetime = timedelta(days=30)

macDebugMode = False


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/about")
def guide():
    return render_template("about.html")


@app.route("/setup")
def setup():
    return render_template("setup.html")


"""Sign out by deleting cookie
"""


@app.route("/sign_out")
def sign_out():
    # Clear the session data
    session.clear()
    return redirect("/")


"""Create cookie with OwnTracks login info and URL

"""


@app.route("/login", methods=["POST", "GET"])
def login():
    if request.method == "POST":
        # Retrieve user inputs from the form
        username = request.form["username"]
        password = request.form["password"]
        serverurl = request.form["serverurl"]

        session.permanent = True  # Make the session permanent

        # Store information in the session
        session["username"] = username
        session["password"] = password
        session["serverurl"] = serverurl

        return redirect("/")


"""Get OwnTracks data from server and return to client


"""


@app.route("/locations")
def get_locations():
    try:
        # these were reasonable defaults, probably don't need them
        params = {
            "from": "2015-01-01T01:00:00.0002Z",
            "to": "2099-12-31T23:59:59.000Z",
            "format": "geojson",
            "user": "user",
            "device": "userdevice",
        }

        # get filters from query
        start_date = request.args.get("startdate")
        end_date = request.args.get("enddate")
        user = request.args.get("user")
        device = request.args.get("device")

        if start_date:
            params["from"] = start_date + "T01:00:00.000Z"
        if end_date:
            params["to"] = end_date + "T23:59:59.000Z"
        if user:
            params["user"] = user
        if device:
            params["device"] = device

        # go make the request with login info from cookie
        response = requests.get(
            session.get("serverurl") + "/api/0/locations",
            auth=HTTPBasicAuth(session.get("username"), session.get("password")),
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        # print(data)  # Print data to console
        return jsonify(data)
    except requests.HTTPError:
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500
    except Exception as err:
        app.logger.error(f"Locations: Other error occurred: {err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500


@app.route("/usersdevices")
def get_users_devices():
    try:

        # go make the request with login info from cookie
        response = requests.get(
            session.get("serverurl") + "/api/0/last",
            auth=HTTPBasicAuth(session.get("username"), session.get("password")),
        )
        response.raise_for_status()
        data = response.json()
        # print(data)  # Print data to console
        return jsonify(data)
    except requests.HTTPError as http_err:
        app.logger.error(f"UsersAndDevices: HTTP error occurred: {http_err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500
    except Exception as err:
        app.logger.error(f"UsersAndDevices: Other error occurred: {err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500


"""Proxy all insecure requests to the insecure server

Unfortunately, the insecure server does not support HTTPS. 
This means that we cannot make requests to it from the 
client browser without mixed content errors
This route makes the server handle insecure requests so 
we don't have to
"""


@app.route("/proxy", methods=["GET"])
def proxy_route():
    print("Proxying request to insecure server")

    osrm_url = request.args.get('osrmURL')
    coords = request.args.get('coords') 
    coords = coords[1:]


    print("coords: ", coords)

    target_url = ""
    # Construct the URL you want to forward the request to
    if osrm_url:
        target_url = f"{osrm_url}/route/v1/{coords}"
        print("using custom osrm url")
    else:
        target_url = f"http://mini.romangarms.com:5001/route/v1/{coords}"
        print("using default osrm url")

    print("target_url is ", target_url)

    # Forward the request to the insecure server
    response = requests.get(target_url)

    print("response status code: ", response.status_code)
    print("response content: ", response.content)

    # Return the response back to the client
    return jsonify(response.json())


if __name__ == "__main__":
    if os.getenv("WHIB_FLASK_SECRET_KEY") == None:
        sys.exit("Missing Environment Variable: WHIB_FLASK_SECRET_KEY")

    # app.run(host='0.0.0.0', port=5000)

    from waitress import serve

    print("Server running on http://127.0.0.1:5000")
    serve(app, host="0.0.0.0", port=5000, threads=10)
