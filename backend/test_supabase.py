import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load root .env
load_dotenv(dotenv_path="d:/Projects/Whatsapp-lead-engine/.env")

url = os.getenv("SUPABASE_URL", "")
# Strip /rest/v1 or /rest/v1/ if present
clean_url = url.split("/rest/v1")[0].rstrip("/")
key = os.getenv("SUPABASE_KEY", "")

print(f"Original URL: {url}")
print(f"Clean URL: {clean_url}")

try:
    client = create_client(clean_url, key)
    print("Supabase client initialized successfully.")
    
    # Check conversations
    try:
        conv_res = client.table("conversations").select("*").limit(1).execute()
        print("Table 'conversations' exists. Count or sample:", conv_res.data)
    except Exception as e:
        print("Table 'conversations' query failed:", e)

    # Check chat_messages
    try:
        msg_res = client.table("chat_messages").select("*").limit(1).execute()
        print("Table 'chat_messages' exists. Count or sample:", msg_res.data)
    except Exception as e:
        print("Table 'chat_messages' query failed:", e)

    # Check bookings
    try:
        book_res = client.table("bookings").select("*").limit(1).execute()
        print("Table 'bookings' exists. Count or sample:", book_res.data)
    except Exception as e:
        print("Table 'bookings' query failed:", e)

except Exception as err:
    print(f"Initialization error: {err}")
