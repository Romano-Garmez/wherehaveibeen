from flask import Flask, make_response, redirect, render_template, jsonify, request
import requests
from requests.auth import HTTPBasicAuth
import sys
import os

app = Flask(__name__)

#replace with your OwnTracks URL
BASE_URL = 'https://mini.romangarms.com/api/0/locations'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/setcookie', methods = ['POST', 'GET'])
def setcookie():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        resp = make_response(redirect('/'))
   
        resp.set_cookie('username', username)
        resp.set_cookie('password', password)

        return resp

@app.route('/locations')
def get_locations():
    try:
        params = {
            'from': '2015-01-01T01:00:00.0002Z',
            'to': '2099-12-31T23:59:59.000Z',
            'format': 'geojson',
            'user': 'roman',
            'device': 'romaniphone'
        }

        startDate = request.args.get('startdate')
        endDate = request.args.get('enddate')
        user = request.args.get('user')
        device = request.args.get('device')

        if startDate:
            params['from'] = startDate + 'T01:00:00.000Z'
            print(params['from'])
        if endDate:
            params['to'] = endDate + 'T23:59:59.000Z'
            print(params['to'])
        if user:
            params['user'] = user
            print(params['user'])
        if device:
            params['device'] = device
            print(params['device'])


        response = requests.get(
            BASE_URL,
            auth=HTTPBasicAuth(request.cookies.get('username'), request.cookies.get('password')),
            params=params
        )
        response.raise_for_status()
        data = response.json()
        #print(data)  # Print data to console
        return jsonify(data)
    except requests.HTTPError as http_err:
        print(f'HTTP error occurred: {http_err}')
        return jsonify({"error": str(http_err)}), 500
    except Exception as err:
        print(f'Other error occurred: {err}')
        return jsonify({"error": str(err)}), 500

if __name__ == '__main__':

    app.run(debug=True)
