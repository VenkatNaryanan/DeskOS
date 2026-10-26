import hmac
import hashlib
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, Response, HTTPException, BackgroundTasks, Query
from app.config import META_APP_SECRET, META_VERIFY_TOKEN
from app.services import meta, audio, supabase_client, local_db
from app.agent import core

logger = logging.getLogger("webhook")
router = APIRouter()


def verify_meta_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """Verifies X-Hub-Signature-256 HMAC-SHA256 signature against META_APP_SECRET."""
    if not META_APP_SECRET:
        logger.warning("META_APP_SECRET not configured. Permitting in development mode.")
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        logger.warning("Invalid or missing X-Hub-Signature-256 header")
        return False

    expected_sig = signature_header.split("sha256=")[1]
    calculated_hmac = hmac.new(
        META_APP_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(calculated_hmac, expected_sig)


def resolve_business_by_phone_id(phone_number_id: Optional[str]) -> str:
    """Resolves business_id associated with incoming WhatsApp phone_number_id."""
    if not phone_number_id:
        return "default_business"
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT slug, id FROM businesses WHERE whatsapp_phone_number_id = ? LIMIT 1", (phone_number_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row["slug"] or row["id"]
    return "default_business"


async def process_incoming_whatsapp_message(message_data: Dict[str, Any], phone_number_id: Optional[str] = None) -> None:
    """Asynchronous background worker for processing WhatsApp incoming payload."""
    sender_phone = message_data.get("from")
    meta_message_id = message_data.get("id")
    msg_type = message_data.get("type", "text")

    if not sender_phone or not meta_message_id:
        logger.warning("Incomplete message payload: %s", message_data)
        return

    # Idempotency Guard: Deduplicate before processing
    if supabase_client.check_message_exists(meta_message_id):
        logger.info("Message %s already processed. Skipping duplicate.", meta_message_id)
        return

    business_id = resolve_business_by_phone_id(phone_number_id)

    # Fetch or create conversation record
    conv = supabase_client.get_or_create_conversation(sender_phone, business_id=business_id)
    conv_id = conv["id"]

    user_text = ""
    # Process text or voice message
    if msg_type == "text":
        user_text = message_data.get("text", {}).get("body", "").strip()
    elif msg_type in ("audio", "voice"):
        audio_info = message_data.get("audio") or message_data.get("voice") or {}
        media_id = audio_info.get("id")
        if media_id:
            try:
                logger.info("Downloading WhatsApp audio media_id=%s", media_id)
                audio_bytes = await meta.download_whatsapp_media(media_id)
                transcribed = audio.transcribe_audio_buffer(audio_bytes)
                user_text = f"[Voice Note Transcribed]: {transcribed}"
            except Exception as e:
                logger.error("Failed to transcribe audio %s: %s", media_id, e)
                user_text = "[Voice Note Received - Transcription failed]"
        else:
            user_text = "[Voice Note Received - Missing Media ID]"
    else:
        logger.info("Unsupported message type: %s", msg_type)
        user_text = f"[{msg_type.capitalize()} message received]"

    if not user_text:
        logger.warning("Empty message content for meta_message_id %s", meta_message_id)
        return

    # Save user turn into chat_messages
    supabase_client.save_message(
        conversation_id=conv_id,
        sender="user",
        content=user_text,
        meta_message_id=meta_message_id
    )

    # Check if AI autonomous mode is active
    if not conv.get("is_ai_active", True):
        logger.info("AI is paused for conversation %s. Message logged for human operator.", conv_id)
        return

    # Execute Autonomous Agent Reasoning & Tools
    try:
        agent_result = await core.run_agent_workflow(
            conversation_id=conv_id,
            wa_user_id=sender_phone,
            user_text=user_text,
            business_id=business_id
        )
        reply_text = agent_result.get("reply_text")

        if reply_text:
            supabase_client.save_message(
                conversation_id=conv_id,
                sender="assistant",
                content=reply_text
            )
            # Send outbound reply to user's WhatsApp
            await meta.send_whatsapp_message(to_number=sender_phone, text=reply_text)
    except Exception as e:
        logger.error("Error executing agent workflow for %s: %s", conv_id, e, exc_info=True)


@router.get("/webhook/whatsapp")
async def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """Validates hub.verify_token == META_VERIFY_TOKEN and returns challenge."""
    logger.info("Incoming Meta Webhook verification handshake: mode=%s, token=%s", hub_mode, hub_verify_token)
    if hub_mode == "subscribe" and hub_verify_token == META_VERIFY_TOKEN:
        if hub_challenge:
            try:
                return Response(content=str(int(hub_challenge)), media_type="text/plain", status_code=200)
            except ValueError:
                return Response(content=hub_challenge, media_type="text/plain", status_code=200)
        return Response(content="ok", media_type="text/plain", status_code=200)

    logger.warning("Webhook verification failed: token mismatch or invalid mode")
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/webhook/whatsapp")
async def handle_whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    1. Verifies X-Hub-Signature-256 HMAC-SHA256 signature against META_APP_SECRET.
    2. Extracts phone_number_id to route to tenant business.
    3. Idempotency guard: Deduplicates by meta_message_id before processing.
    4. Fast 200 response (<100ms).
    """
    raw_body = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256")

    if not verify_meta_signature(raw_body, signature_header):
        logger.error("Webhook signature verification failed")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ok"}

    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            messages = value.get("messages", [])
            for message in messages:
                background_tasks.add_task(process_incoming_whatsapp_message, message, phone_number_id)

    return {"status": "ok"}
