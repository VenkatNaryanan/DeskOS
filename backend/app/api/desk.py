import uuid
import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form, Query, Depends
from app.services import supabase_client, meta, audio
from app.agent import core
from app.services.auth import get_current_tenant_user

logger = logging.getLogger("desk_api")
router = APIRouter(prefix="/api", tags=["support_desk"])


class ToggleAiRequest(BaseModel):
    is_ai_active: bool = Field(..., description="Enable or disable autonomous AI mode")


class ManualMessageRequest(BaseModel):
    conversation_id: str
    wa_user_id: str
    message: str


class CreateBookingRequest(BaseModel):
    client_name: Optional[str] = None
    patient_name: Optional[str] = None
    phone: str
    slot_time: str
    service: str
    provider_name: Optional[str] = None
    notes: Optional[str] = None
    conversation_id: Optional[str] = None
    business_id: Optional[str] = "default_business"


class CancelBookingRequest(BaseModel):
    reason: Optional[str] = None


class RescheduleBookingRequest(BaseModel):
    new_slot_time: str


class SimulateMessageRequest(BaseModel):
    wa_user_id: str = "919876543210"
    message_text: str = "Hello, I want to book an appointment tomorrow afternoon."
    sender_name: Optional[str] = "Test Client"
    business_id: Optional[str] = "default_business"


# ==============================================================================
# Conversations & Messaging Endpoints
# ==============================================================================

@router.get("/conversations")
async def get_conversations(business_id: Optional[str] = Query(None)):
    """
    Returns list of active conversations from real persistent database,
    augmented with their most recent message preview.
    """
    conversations = supabase_client.list_conversations(business_id)
    augmented = []
    for c in conversations:
        conv_id = c["id"]
        recent = supabase_client.get_recent_messages(conv_id, limit=1)
        last_msg = recent[-1] if recent else None
        augmented.append({
            **c,
            "last_message": last_msg.get("content") if last_msg else None,
            "last_message_sender": last_msg.get("sender") if last_msg else None,
            "last_message_time": last_msg.get("created_at") if last_msg else c.get("updated_at")
        })
    return augmented


@router.get("/conversations/{conv_id}/messages")
async def get_conversation_messages(conv_id: str):
    """Returns chronological message history for a specific conversation."""
    return supabase_client.get_recent_messages(conv_id, limit=50)


@router.post("/conversations/{conv_id}/toggle-ai")
async def toggle_conversation_ai(
    conv_id: str,
    body: ToggleAiRequest,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Toggles is_ai_active flag for a conversation."""
    conv = supabase_client.get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    supabase_client.set_ai_status(conv_id, is_active=body.is_ai_active)
    updated = supabase_client.get_conversation(conv_id)
    return {
        "status": "success",
        "conversation_id": conv_id,
        "is_ai_active": updated.get("is_ai_active") if updated else body.is_ai_active
    }


@router.post("/messages/manual")
async def send_manual_operator_message(
    body: ManualMessageRequest,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """
    Action Header operator manual message sender:
    1. Sends outbound message via Meta Graph API to the user's WhatsApp.
    2. Logs message in chat_messages table with sender = 'operator'.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be blank")

    conv = supabase_client.get_conversation(body.conversation_id)
    if not conv:
        conv = supabase_client.get_or_create_conversation(body.wa_user_id)

    # 1. Save in database as 'operator'
    saved = supabase_client.save_message(
        conversation_id=body.conversation_id,
        sender="operator",
        content=body.message.strip()
    )

    # 2. Dispatch outbound WhatsApp message via Meta
    meta_result = await meta.send_whatsapp_message(
        to_number=body.wa_user_id,
        text=body.message.strip()
    )

    return {
        "status": "sent",
        "message": saved,
        "meta_response": meta_result
    }


# ==============================================================================
# Appointments & Bookings Endpoints
# ==============================================================================

@router.get("/bookings")
async def get_all_bookings(business_id: Optional[str] = None):
    """Returns all appointment bookings from real persistent database."""
    return supabase_client.list_universal_bookings(business_id)


@router.post("/bookings")
async def create_booking_endpoint(body: CreateBookingRequest):
    """Creates a new appointment booking with overlap protection."""
    c_name = body.client_name or body.patient_name or "Client"
    try:
        res = supabase_client.create_universal_booking(
            client_name=c_name,
            phone=body.phone,
            slot_time=body.slot_time,
            service=body.service,
            provider_name=body.provider_name,
            notes=body.notes,
            conversation_id=body.conversation_id,
            business_id=body.business_id or "default_business"
        )
        return {"status": "success", "booking": res}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking_endpoint(
    booking_id: str,
    body: Optional[CancelBookingRequest] = None,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Cancels an appointment and releases the slot."""
    reason = body.reason if body else None
    try:
        cancelled = supabase_client.cancel_booking(booking_id, reason=reason)
        return {"status": "success", "message": "Appointment cancelled successfully", "booking": cancelled}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/bookings/{booking_id}/reschedule")
async def reschedule_booking_endpoint(
    booking_id: str,
    body: RescheduleBookingRequest,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Reschedules an appointment transactionally to a new time slot."""
    try:
        rescheduled = supabase_client.reschedule_booking(booking_id, new_slot_time=body.new_slot_time)
        return {"status": "success", "message": "Appointment rescheduled successfully", "booking": rescheduled}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


# ==============================================================================
# Simulator & Test Bench
# ==============================================================================

@router.post("/simulate")
async def simulate_incoming_message(body: SimulateMessageRequest):
    """
    Simulates incoming WhatsApp message, runs multi-industry AI workflow,
    logs turns to persistent database, and returns truthful agent output.
    """
    conv = supabase_client.get_or_create_conversation(body.wa_user_id, business_id=body.business_id or "default_business")
    conv_id = conv["id"]
    simulated_meta_id = f"sim_{uuid.uuid4().hex[:12]}"

    # Save user message
    user_msg = supabase_client.save_message(
        conversation_id=conv_id,
        sender="user",
        content=body.message_text,
        meta_message_id=simulated_meta_id
    )

    # Check if AI is active
    if not conv.get("is_ai_active", True):
        return {
            "status": "ai_paused",
            "conversation_id": conv_id,
            "user_message": user_msg,
            "reply_text": None,
            "note": "AI Autonomous Mode is currently OFF for this conversation."
        }

    # Run multi-industry agent workflow
    agent_res = await core.run_agent_workflow(
        conversation_id=conv_id,
        wa_user_id=body.wa_user_id,
        user_text=body.message_text,
        business_id=body.business_id or "default_business"
    )

    reply_text = agent_res.get("reply_text", "")
    assistant_msg = None
    if reply_text:
        assistant_msg = supabase_client.save_message(
            conversation_id=conv_id,
            sender="assistant",
            content=reply_text
        )

    return {
        "status": "success",
        "conversation_id": conv_id,
        "user_message": user_msg,
        "assistant_message": assistant_msg,
        "reply_text": reply_text,
        "tool_calls": agent_res.get("tool_calls_executed", []),
        "model_used": agent_res.get("model_used")
    }


@router.post("/simulate/voice")
async def simulate_voice_message(
    wa_user_id: str = Form("919876543210"),
    business_id: str = Form("default_business"),
    file: UploadFile = File(...)
):
    """Simulates a voice note upload: transcribes via Groq Whisper and runs agent workflow."""
    content = await file.read()
    transcribed_text = audio.transcribe_audio_buffer(content, filename=file.filename or "voice.ogg")
    
    sim_req = SimulateMessageRequest(
        wa_user_id=wa_user_id,
        message_text=f"[Voice Note Transcribed]: {transcribed_text}",
        business_id=business_id
    )
    res = await simulate_incoming_message(sim_req)
    res["transcription"] = transcribed_text
    return res
