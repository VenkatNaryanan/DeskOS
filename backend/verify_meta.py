import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv("d:/Projects/Whatsapp-lead-engine/.env")

token = os.getenv("META_ACCESS_TOKEN", "").strip("\"' ")
phone_id = os.getenv("META_PHONE_NUMBER_ID", "").strip("\"' ")

print(f"Token snippet: {token[:15]}...{token[-10:]}")
print(f"Phone ID: {phone_id}")

headers = {"Authorization": f"Bearer {token}"}

# 1. Query Phone Number Details
phone_url = f"https://graph.facebook.com/v21.0/{phone_id}"
r_phone = httpx.get(phone_url, headers=headers)
print("\n=== Meta Phone Number Query ===")
print(f"Status Code: {r_phone.status_code}")
try:
    print("Response:", json.dumps(r_phone.json(), indent=2))
except Exception:
    print("Response:", r_phone.text)

# 2. Check token debug info
debug_url = f"https://graph.facebook.com/debug_token?input_token={token}&access_token={token}"
r_debug = httpx.get(debug_url)
print("\n=== Meta Token Inspection (debug_token) ===")
print(f"Status Code: {r_debug.status_code}")
try:
    debug_data = r_debug.json().get("data", {})
    is_valid = debug_data.get("is_valid")
    expires_at = debug_data.get("expires_at")
    scopes = debug_data.get("scopes")
    app_id = debug_data.get("app_id")
    print(f"Is Valid: {is_valid}")
    print(f"Expires At: {expires_at} (0 means never expires / permanent token)")
    print(f"Scopes: {scopes}")
    print(f"App ID: {app_id}")
except Exception:
    print("Response:", r_debug.text)

# 3. Test sending API payload structure validation (dry run or check messages endpoint)
msg_endpoint = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
r_options = httpx.options(msg_endpoint, headers=headers)
print("\n=== Messages Endpoint Options Check ===")
print(f"Status Code: {r_options.status_code}")
