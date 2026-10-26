import os
import asyncio
import uvicorn
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import PORT, SUPABASE_URL, GROQ_CHAT_MODEL, META_PHONE_NUMBER_ID
from app.api.webhook import router as webhook_router
from app.api.desk import router as desk_router
from app.api.business import router as business_router
from app.services import notifications, local_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

ALLOWED_ORIGINS = [
    origin.strip() for origin in
    os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]


async def background_notification_worker():
    """Background task running every 60 seconds to process due notification message jobs."""
    logger.info("Durable notification queue background worker started.")
    while True:
        try:
            processed = await notifications.process_due_message_jobs(batch_size=10)
            if processed > 0:
                logger.info("Processed %d due notification jobs.", processed)
        except Exception as e:
            logger.error("Error in notification worker loop: %s", e)
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure local db schema and start worker
    local_db.init_local_db()
    worker_task = asyncio.create_task(background_notification_worker())
    yield
    # Shutdown
    worker_task.cancel()


app = FastAPI(
    title="DeskOS — Autonomous Multi-Tenant SaaS & AI Receptionist Engine",
    description="Universal appointment booking, AI receptionist, and WhatsApp coordinator for appointment-based businesses.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(webhook_router)
app.include_router(desk_router)
app.include_router(business_router)


@app.get("/")
async def root():
    return {
        "engine": "DeskOS — Multi-Tenant SaaS Engine",
        "status": "online",
        "version": "2.0.0",
        "endpoints": {
            "webhook_get": "/webhook/whatsapp",
            "webhook_post": "/webhook/whatsapp",
            "conversations": "/api/conversations",
            "messages": "/api/conversations/{conv_id}/messages",
            "manual_message": "/api/messages/manual",
            "toggle_ai": "/api/conversations/{conv_id}/toggle-ai",
            "bookings": "/api/bookings",
            "business_config": "/api/business/config",
            "business_staff": "/api/business/staff",
            "business_services": "/api/business/services",
            "business_preset": "/api/business/preset",
            "business_analytics": "/api/business/analytics",
            "simulator": "/api/simulate"
        }
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "groq_model": GROQ_CHAT_MODEL,
        "supabase_configured": bool(SUPABASE_URL),
        "meta_phone_id_configured": bool(META_PHONE_NUMBER_ID),
        "local_db_status": "active",
        "port": PORT
    }


@app.post("/api/jobs/process")
async def trigger_job_worker():
    """Manual trigger to process due message jobs immediately (useful for tests and cron)."""
    count = await notifications.process_due_message_jobs(batch_size=20)
    return {"status": "success", "processed_jobs": count}


if __name__ == "__main__":
    logger.info("Starting DeskOS FastAPI server on port %s...", PORT)
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
