import os
from pathlib import Path
from dotenv import load_dotenv

# Locate root .env
root_dir = Path(__file__).resolve().parent.parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Meta WhatsApp Cloud API credentials
META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", "").strip('"\' ')
META_PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID", "").strip('"\' ')
META_APP_SECRET = os.getenv("META_APP_SECRET", "").strip('"\' ')
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "").strip('"\' ')

# Groq Cloud
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip('"\' ')
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile").strip('"\' ')

# Supabase
raw_supabase_url = os.getenv("SUPABASE_URL", "").strip('"\' ')
# Strip /rest/v1 or /rest/v1/ suffix if present for client initialization
SUPABASE_URL = raw_supabase_url.split("/rest/v1")[0].rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", "")).strip('"\' ')

# Server Port
PORT = int(os.getenv("PORT", 8000))
