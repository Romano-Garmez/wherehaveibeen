from flask import Flask, make_response, redirect, render_template, jsonify, request
import requests
from requests.auth import HTTPBasicAuth

app = Flask(__name__)

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
Actually just set the cookie to expire immediately
"""


@app.route("/sign_out")
def sign_out():
    resp = make_response(redirect("/"))

    resp.set_cookie("username", expires=0)
    resp.set_cookie("password", expires=0)
    resp.set_cookie("serverurl", expires=0)

    return resp


"""Create cookie with OwnTracks login info and URL

"""


@app.route("/setcookie", methods=["POST", "GET"])
def setcookie():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        serverurl = request.form["serverurl"]

        resp = make_response(redirect("/"))

        cookie_expiration = 60 * 60 * 24 * 30  # 30 days

        resp.set_cookie("username", username, max_age=cookie_expiration)
        resp.set_cookie("password", password, max_age=cookie_expiration)
        resp.set_cookie("serverurl", serverurl, max_age=cookie_expiration)

        return resp


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
            request.cookies.get("serverurl") + "/api/0/locations",
            auth=HTTPBasicAuth(
                request.cookies.get("username"), request.cookies.get("password")
            ),
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        # print(data)  # Print data to console
        return jsonify(data)
    except requests.HTTPError as http_err:
        print(f"Locations: HTTP error occurred: {http_err}")
        return jsonify({"error": str(http_err)}), 500
    except Exception as err:
        print(f"Locations: Other error occurred: {err}")
        return jsonify({"error": str(err)}), 500


@app.route("/usersdevices")
def get_users_devices():
    try:

        # go make the request with login info from cookie
        response = requests.get(
            request.cookies.get("serverurl") + "/api/0/last",
            auth=HTTPBasicAuth(
                request.cookies.get("username"), request.cookies.get("password")
            ),
        )
        response.raise_for_status()
        data = response.json()
        # print(data)  # Print data to console
        return jsonify(data)
    except requests.HTTPError as http_err:
        print(f"UsersAndDevices: HTTP error occurred: {http_err}")
        return jsonify({"error": str(http_err)}), 500
    except Exception as err:
        print(f"UsersAndDevices: Other error occurred: {err}")
        return jsonify({"error": str(err)}), 500


"""Proxy all insecure requests to the insecure server

Unfortunately, the insecure server does not support HTTPS. 
This means that we cannot make requests to it from the 
client browser without mixed content errors
This route makes the server handle insecure requests so 
we don't have to
"""


@app.route("/proxy/<path:url>", methods=["GET"])
def proxy_route(url):
    print("Proxying request to insecure server")

    # Construct the URL you want to forward the request to
    target_url = f"http://mini.romangarms.com:5001/route/v1/{url}"

    print("target_url is ", target_url)

    # Forward the request to the insecure server
    response = requests.get(target_url)

    print("response is ", response)

    # Return the response back to the client
    return jsonify(response.json())


if __name__ == "__main__":

    # app.run(host='0.0.0.0', port=5000)

    from waitress import serve

    if macDebugMode:
        print("Server running on http://127.0.0.1:5001")
        serve(app, host="0.0.0.0", port=5001)
    else:
        print("Server running on http://127.0.0.1:5000")
        serve(app, host="0.0.0.0", port=5000)
