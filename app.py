from flask import Flask, make_response, redirect, render_template, jsonify, request
import requests
from requests.auth import HTTPBasicAuth
import sys
import os

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/navbar")
def navbar():
    return render_template("navbar.html")


@app.route("/sign_out")
def sign_out():
    resp = make_response(redirect("/"))

    resp.set_cookie("username", expires=0)
    resp.set_cookie("password", expires=0)
    resp.set_cookie("serverurl", expires=0)

    return resp


@app.route("/setcookie", methods=["POST", "GET"])
def setcookie():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        serverurl = request.form["serverurl"]

        resp = make_response(redirect("/"))

        resp.set_cookie("username", username)
        resp.set_cookie("password", password)
        resp.set_cookie("serverurl", serverurl)

        return resp


@app.route("/locations")
def get_locations():
    try:
        params = {
            "from": "2015-01-01T01:00:00.0002Z",
            "to": "2099-12-31T23:59:59.000Z",
            "format": "geojson",
            "user": "user",
            "device": "userdevice",
        }

        startDate = request.args.get("startdate")
        endDate = request.args.get("enddate")
        user = request.args.get("user")
        device = request.args.get("device")

        if startDate:
            params["from"] = startDate + "T01:00:00.000Z"
            print(params["from"])
        if endDate:
            params["to"] = endDate + "T23:59:59.000Z"
            print(params["to"])
        if user:
            params["user"] = user
            print(params["user"])
        if device:
            params["device"] = device
            print(params["device"])

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
        print(f"HTTP error occurred: {http_err}")
        return jsonify({"error": str(http_err)}), 500
    except Exception as err:
        print(f"Other error occurred: {err}")
        return jsonify({"error": str(err)}), 500


@app.route("/proxy/<path:url>", methods=["GET"])
def proxy_route(url):
    print("Proxying request to insecure server")



    # Construct the URL you want to forward the request to
    target_url = f'http://mini.romangarms.com:5001/route/v1/{url}'

    print("target_url is ", target_url)

    # Forward the request to the insecure server
    response = requests.get(target_url)


    print("response is ", response)

    # Return the response back to the client
    return jsonify(response.json())


if __name__ == "__main__":

    # app.run(host='0.0.0.0', port=5000)

    from waitress import serve

    serve(app, host="0.0.0.0", port=5000)
