import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"
session = requests.Session()

def print_result(name, res):
    print(f"--- {name} ---")
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.text[:500]}")
    print()

try:
    # 1. Register Consumer
    payload = {
        "email": "testconsumer2@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "phone": "09876543212",
        "name": "Test Consumer",
        "role": "Consumer"
    }
    res = session.post(f"{BASE_URL}/auth/register/", json=payload)
    print_result("Register Consumer", res)

    # 2. Login
    login_payload = {
        "email": "testconsumer2@example.com",
        "password": "Password123!"
    }
    res = session.post(f"{BASE_URL}/auth/login/", json=login_payload)
    print_result("Login Consumer", res)

    if res.status_code == 200:
        access_token = res.json().get("access")
        session.headers.update({"Authorization": f"Bearer {access_token}"})

    # 3. GET top-rated vendors
    res = session.get(f"{BASE_URL}/vendors/top-rated/")
    print_result("Top Rated Vendors", res)

    # 4. Search vendors
    res = session.get(f"{BASE_URL}/vendors/search/?location=Yangon")
    print_result("Search Vendors", res)
    
except Exception as e:
    print(f"Error: {e}")
