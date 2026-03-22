import json
import urllib.request
import urllib.error

data = json.dumps({
    "email": "testnew@example.com",
    "password": "password123",
    "confirm_password": "password123",
    "name": "Test User",
    "phone": ""
}).encode('utf-8')

req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/register/',
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as response:
        print("SUCCESS:", response.read().decode())
except urllib.error.HTTPError as e:
    print("ERROR:", e.code)
    print("BODY:", e.read().decode())
except Exception as e:
    print("FATAL:", str(e))
