import os, httpx, json
from dotenv import load_dotenv

load_dotenv("d:/Projects/Whatsapp-lead-engine/.env")
key = os.getenv("SUPABASE_KEY")
url = os.getenv("SUPABASE_URL", "").split("/rest/v1")[0].rstrip("/")

r = httpx.get(
    f"{url}/rest/v1/",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/openapi+json"
    }
)

if r.status_code == 200:
    defs = r.json().get("definitions", {})
    for tbl in ["conversations", "chat_messages", "bookings"]:
        if tbl in defs:
            print(f"=== {tbl} ===")
            props = defs[tbl].get("properties", {})
            required = defs[tbl].get("required", [])
            for col, d in props.items():
                print(f"  {col}: type={d.get('type')}, format={d.get('format')}, default={d.get('default')}, req={col in required}")
else:
    print(f"Failed to fetch definitions: {r.status_code} {r.text}")
