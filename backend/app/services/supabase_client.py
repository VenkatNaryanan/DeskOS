import os
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_KEY
from app.services import local_db, scheduler, notifications

logger = logging.getLogger("supabase_service")

# Initialize remote Supabase client if configured
supabase: Optional[Client] = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized with %s", SUPABASE_URL)
    else:
        logger.info("Remote Supabase credentials missing. Local database active.")
except Exception as e:
    logger.warning("Failed to initialize Supabase client: %s. Using persistent local engine.", e)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ==============================================================================
# Industry Presets
# ==============================================================================

INDUSTRY_PRESETS: Dict[str, Dict[str, Any]] = {
    "healthcare": {
        "business_name": "Apex Healthcare & Dental Clinic",
        "industry": "healthcare",
        "client_label": "Patient",
        "provider_label": "Doctor",
        "tone": "Empathetic, clinical, reassuring, precise",
        "currency": "₹",
        "broadcast_notice": {
            "is_active": False,
            "notice_text": "",
            "effective_dates": ""
        },
        "operating_hours": {
            "monday": {"is_closed": False, "open": "09:00", "close": "20:00"},
            "tuesday": {"is_closed": False, "open": "09:00", "close": "20:00"},
            "wednesday": {"is_closed": False, "open": "09:00", "close": "20:00"},
            "thursday": {"is_closed": False, "open": "09:00", "close": "20:00"},
            "friday": {"is_closed": False, "open": "09:00", "close": "20:00"},
            "saturday": {"is_closed": False, "open": "10:00", "close": "18:00"},
            "sunday": {"is_closed": True, "open": "10:00", "close": "14:00"}
        },
        "services": [
            {"name": "Dental Consultation & Exam", "price": 500.0, "duration": "30 mins", "category": "General"},
            {"name": "Teeth Cleaning & Scaling", "price": 1500.0, "duration": "45 mins", "category": "Preventive"},
            {"name": "Root Canal Treatment (RCT)", "price": 4500.0, "duration": "60 mins", "category": "Endodontics"},
            {"name": "Teeth Whitening", "price": 6000.0, "duration": "45 mins", "category": "Cosmetic"},
            {"name": "Dental Crown / Cap", "price": 3500.0, "duration": "45 mins", "category": "Prosthodontics"}
        ],
        "faqs": [
            {"question": "Where is Apex Dental Clinic located?", "answer": "12th Floor, Green Tower, MG Road, Bengaluru."},
            {"question": "What payment methods do you accept?", "answer": "UPI, Credit/Debit cards, Cash, and Net Banking."},
            {"question": "How do I handle an emergency toothache?", "answer": "Call +91 98765 43210 immediately for priority emergency assistance."}
        ],
        "escalation_rules": ["emergency", "severe pain", "bleeding", "refund", "complaint", "human", "manager"]
    },
    "salon": {
        "business_name": "Lumière Salon & Wellness Spa",
        "industry": "salon",
        "client_label": "Guest",
        "provider_label": "Stylist",
        "tone": "Warm, luxurious, stylish, welcoming",
        "currency": "₹",
        "broadcast_notice": {
            "is_active": False,
            "notice_text": "",
            "effective_dates": ""
        },
        "operating_hours": {
            "monday": {"is_closed": True, "open": "10:00", "close": "21:00"},
            "tuesday": {"is_closed": False, "open": "10:00", "close": "21:00"},
            "wednesday": {"is_closed": False, "open": "10:00", "close": "21:00"},
            "thursday": {"is_closed": False, "open": "10:00", "close": "21:00"},
            "friday": {"is_closed": False, "open": "10:00", "close": "21:00"},
            "saturday": {"is_closed": False, "open": "09:00", "close": "21:00"},
            "sunday": {"is_closed": False, "open": "09:00", "close": "20:00"}
        },
        "services": [
            {"name": "Signature Haircut & Styling", "price": 1200.0, "duration": "45 mins", "category": "Hair"},
            {"name": "Balayage & Global Color", "price": 4500.0, "duration": "120 mins", "category": "Color"},
            {"name": "Deep Tissue Aromatherapy Spa", "price": 2800.0, "duration": "60 mins", "category": "Spa"},
            {"name": "Hydra Facial Glow", "price": 3200.0, "duration": "60 mins", "category": "Skin"},
            {"name": "Luxury Manicure & Pedicure", "price": 1800.0, "duration": "60 mins", "category": "Nails"}
        ],
        "faqs": [
            {"question": "Do you accept walk-ins?", "answer": "Walk-ins are welcomed subject to stylist availability, though booking ahead is advised."},
            {"question": "What products do you use for hair coloring?", "answer": "We use premium ammonia-free L'Oréal Professionnel and Olaplex treatments."},
            {"question": "Can I choose my preferred stylist?", "answer": "Yes! You can specify your preferred stylist when booking."}
        ],
        "escalation_rules": ["manager", "refund", "allergic reaction", "complaint", "human"]
    },
    "legal": {
        "business_name": "Vanguard Legal Advisors & Partners",
        "industry": "legal",
        "client_label": "Client",
        "provider_label": "Attorney",
        "tone": "Authoritative, discreet, formal, professional",
        "currency": "₹",
        "broadcast_notice": {
            "is_active": False,
            "notice_text": "",
            "effective_dates": ""
        },
        "operating_hours": {
            "monday": {"is_closed": False, "open": "09:30", "close": "18:30"},
            "tuesday": {"is_closed": False, "open": "09:30", "close": "18:30"},
            "wednesday": {"is_closed": False, "open": "09:30", "close": "18:30"},
            "thursday": {"is_closed": False, "open": "09:30", "close": "18:30"},
            "friday": {"is_closed": False, "open": "09:30", "close": "18:30"},
            "saturday": {"is_closed": True, "open": "10:00", "close": "14:00"},
            "sunday": {"is_closed": True, "open": "10:00", "close": "14:00"}
        },
        "services": [
            {"name": "Initial Legal Consultation", "price": 3000.0, "duration": "45 mins", "category": "Advisory"},
            {"name": "Corporate Contract Drafting & Review", "price": 8500.0, "duration": "60 mins", "category": "Corporate"},
            {"name": "Property Title & Due Diligence", "price": 12000.0, "duration": "90 mins", "category": "Real Estate"},
            {"name": "Intellectual Property & Trademark Filing", "price": 7500.0, "duration": "60 mins", "category": "IP"}
        ],
        "faqs": [
            {"question": "Is the initial consultation confidential?", "answer": "Yes, all consultations are protected under strict attorney-client privilege."},
            {"question": "Do you provide representation in High Court?", "answer": "Yes, our partners practice before the High Court and district tribunals."}
        ],
        "escalation_rules": ["urgent court hearing", "police", "arrest", "arbitration", "human", "partner"]
    },
    "auto": {
        "business_name": "Apex Precision Auto Care & Diagnostics",
        "industry": "auto",
        "client_label": "Vehicle Owner",
        "provider_label": "Master Technician",
        "tone": "Direct, technical, honest, dependable",
        "currency": "₹",
        "broadcast_notice": {
            "is_active": False,
            "notice_text": "",
            "effective_dates": ""
        },
        "operating_hours": {
            "monday": {"is_closed": False, "open": "08:30", "close": "19:00"},
            "tuesday": {"is_closed": False, "open": "08:30", "close": "19:00"},
            "wednesday": {"is_closed": False, "open": "08:30", "close": "19:00"},
            "thursday": {"is_closed": False, "open": "08:30", "close": "19:00"},
            "friday": {"is_closed": False, "open": "08:30", "close": "19:00"},
            "saturday": {"is_closed": False, "open": "08:30", "close": "18:00"},
            "sunday": {"is_closed": True, "open": "10:00", "close": "14:00"}
        },
        "services": [
            {"name": "Comprehensive 60-Point Vehicle Inspection", "price": 1500.0, "duration": "60 mins", "category": "Inspection"},
            {"name": "Engine Oil & Filter Service", "price": 2800.0, "duration": "45 mins", "category": "Maintenance"},
            {"name": "Brake Pad Replacement & Rotor Skimming", "price": 3800.0, "duration": "60 mins", "category": "Brakes"},
            {"name": "OBD2 Computerized Diagnostics", "price": 1200.0, "duration": "30 mins", "category": "Diagnostics"},
            {"name": "AC Cooling Coil Deep Clean & Gas Recharge", "price": 2500.0, "duration": "60 mins", "category": "HVAC"}
        ],
        "faqs": [
            {"question": "Do you offer doorstep pickup and drop?", "answer": "Yes, complimentary vehicle pickup is available within a 10km radius."},
            {"question": "Do you use OEM genuine parts?", "answer": "We strictly install OEM certified parts backed by a 6-month warranty."}
        ],
        "escalation_rules": ["breakdown", "towing", "accident", "refund", "complaint", "human", "manager"]
    },
    "custom": {
        "business_name": "Apex Appointment Studio",
        "industry": "custom",
        "client_label": "Client",
        "provider_label": "Specialist",
        "tone": "Helpful, adaptable, efficient",
        "currency": "₹",
        "broadcast_notice": {
            "is_active": False,
            "notice_text": "",
            "effective_dates": ""
        },
        "operating_hours": {
            "monday": {"is_closed": False, "open": "09:00", "close": "18:00"},
            "tuesday": {"is_closed": False, "open": "09:00", "close": "18:00"},
            "wednesday": {"is_closed": False, "open": "09:00", "close": "18:00"},
            "thursday": {"is_closed": False, "open": "09:00", "close": "18:00"},
            "friday": {"is_closed": False, "open": "09:00", "close": "18:00"},
            "saturday": {"is_closed": False, "open": "10:00", "close": "16:00"},
            "sunday": {"is_closed": True, "open": "10:00", "close": "14:00"}
        },
        "services": [
            {"name": "General Service Consultation", "price": 500.0, "duration": "30 mins", "category": "General"},
            {"name": "Standard Session", "price": 1500.0, "duration": "60 mins", "category": "Service"}
        ],
        "faqs": [
            {"question": "How do I schedule an appointment?", "answer": "Simply tell our assistant what time and date suits you best!"}
        ],
        "escalation_rules": ["human", "manager", "complaint", "refund", "urgent"]
    }
}


# ==============================================================================
# Conversations & Chat Messages Persistence
# ==============================================================================

def get_or_create_conversation(wa_user_id: str, business_id: str = "default_business") -> Dict[str, Any]:
    """
    Fetches an existing conversation for wa_user_id or creates a new one with real persistence.
    """
    conn = local_db.get_connection()
    cursor = conn.cursor()

    # Resolve business UUID
    cursor.execute("SELECT id FROM businesses WHERE slug = ? OR id = ? LIMIT 1", (business_id, business_id))
    b_row = cursor.fetchone()
    b_id = b_row["id"] if b_row else "00000000-0000-0000-0000-000000000001"

    cursor.execute("""
    SELECT * FROM conversations WHERE (business_id = ? OR business_id = ?) AND wa_user_id = ? LIMIT 1
    """, (b_id, business_id, wa_user_id))
    row = cursor.fetchone()

    if row:
        conv = dict(row)
        conv["is_ai_active"] = bool(conv.get("is_ai_active", 1))
        conn.close()
        return conv

    # Create new conversation
    new_id = str(uuid.uuid4())
    now = _now_iso()
    cursor.execute("""
    INSERT INTO conversations (id, business_id, wa_user_id, current_state, is_ai_active, created_at, updated_at)
    VALUES (?, ?, ?, 'initial', 1, ?, ?)
    """, (new_id, b_id, wa_user_id, now, now))
    conn.commit()

    cursor.execute("SELECT * FROM conversations WHERE id = ?", (new_id,))
    created = dict(cursor.fetchone())
    created["is_ai_active"] = bool(created.get("is_ai_active", 1))
    conn.close()

    # Mirror to Supabase if available
    if supabase:
        try:
            supabase.table("conversations").insert({
                "id": new_id,
                "wa_user_id": wa_user_id,
                "current_state": "initial",
                "is_ai_active": True,
                "created_at": now,
                "updated_at": now
            }).execute()
        except Exception as e:
            logger.debug("Remote supabase conversation mirror note: %s", e)

    return created


def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    conv = dict(row)
    conv["is_ai_active"] = bool(conv.get("is_ai_active", 1))
    return conv


def list_conversations(business_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    if business_id:
        cursor.execute("""
        SELECT * FROM conversations
        WHERE business_id = ? OR business_id = (SELECT id FROM businesses WHERE slug = ?)
        ORDER BY updated_at DESC
        """, (business_id, business_id))
    else:
        cursor.execute("SELECT * FROM conversations ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        c = dict(r)
        c["is_ai_active"] = bool(c.get("is_ai_active", 1))
        result.append(c)
    return result


def update_conversation_state(conversation_id: str, current_state: str) -> None:
    now = _now_iso()
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE conversations SET current_state = ?, updated_at = ? WHERE id = ?", (current_state, now, conversation_id))
    conn.commit()
    conn.close()

    if supabase:
        try:
            supabase.table("conversations").update({"current_state": current_state, "updated_at": now}).eq("id", conversation_id).execute()
        except Exception as e:
            logger.debug("Remote supabase update_state note: %s", e)


def set_ai_status(conversation_id: str, is_active: bool) -> None:
    now = _now_iso()
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE conversations SET is_ai_active = ?, updated_at = ? WHERE id = ?", (1 if is_active else 0, now, conversation_id))
    conn.commit()
    conn.close()

    if supabase:
        try:
            supabase.table("conversations").update({"is_ai_active": is_active, "updated_at": now}).eq("id", conversation_id).execute()
        except Exception as e:
            logger.debug("Remote supabase set_ai note: %s", e)


def check_message_exists(meta_message_id: Optional[str]) -> bool:
    if not meta_message_id:
        return False
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM chat_messages WHERE meta_message_id = ? LIMIT 1", (meta_message_id,))
    row = cursor.fetchone()
    conn.close()
    return bool(row)


def save_message(
    conversation_id: str,
    sender: str,
    content: str,
    meta_message_id: Optional[str] = None
) -> Dict[str, Any]:
    now = _now_iso()
    msg_id = str(uuid.uuid4())
    conn = local_db.get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO chat_messages (id, conversation_id, sender, content, meta_message_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (msg_id, conversation_id, sender, content, meta_message_id, now))
    cursor.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
    conn.commit()

    cursor.execute("SELECT * FROM chat_messages WHERE id = ?", (msg_id,))
    saved = dict(cursor.fetchone())
    conn.close()

    if supabase:
        try:
            supabase.table("chat_messages").insert({
                "id": msg_id,
                "conversation_id": conversation_id,
                "sender": sender,
                "content": content,
                "meta_message_id": meta_message_id,
                "created_at": now
            }).execute()
        except Exception as e:
            logger.debug("Remote supabase save_message note: %s", e)

    return saved


def get_recent_messages(conversation_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM chat_messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
    LIMIT ?
    """, (conversation_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ==============================================================================
# Business Configuration & Multi-Industry Engine
# ==============================================================================

def _get_or_create_business_id(business_id: str) -> str:
    """Resolves or creates a business tenant ID for a slug/id."""
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM businesses WHERE slug = ? OR id = ? LIMIT 1", (business_id, business_id))
    row = cursor.fetchone()
    if row:
        b_id = row["id"]
        conn.close()
        return b_id

    # If it is default alias, check default-business
    if business_id in ("default_business", "default-business", "default_clinic"):
        cursor.execute("SELECT id FROM businesses WHERE slug = 'default-business' OR slug = 'default_business' LIMIT 1")
        d_row = cursor.fetchone()
        if d_row:
            b_id = d_row["id"]
            conn.close()
            return b_id

    # Create new business record for this slug
    new_id = str(uuid.uuid4())
    now = _now_iso()
    cursor.execute("""
    INSERT INTO businesses (id, slug, name, industry, timezone, currency, client_label, provider_label, tone, created_at, updated_at)
    VALUES (?, ?, ?, 'general', 'Asia/Kolkata', '₹', 'Client', 'Specialist', 'Professional', ?, ?)
    """, (new_id, business_id, business_id.replace("_", " ").title(), now, now))
    conn.commit()
    conn.close()
    return new_id


def get_universal_business(business_id: str = "default_business") -> Dict[str, Any]:
    """
    Returns full normalized business configuration with services, FAQs, and hours.
    """
    conn = local_db.get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT * FROM businesses WHERE slug = ? OR id = ? LIMIT 1
    """, (business_id, business_id))
    b_row = cursor.fetchone()

    if not b_row and business_id in ("default_business", "default-business", "default_clinic"):
        cursor.execute("SELECT * FROM businesses WHERE slug = 'default-business' OR slug = 'default_business' LIMIT 1")
        b_row = cursor.fetchone()

    if not b_row:
        conn.close()
        b_id = _get_or_create_business_id(business_id)
        conn = local_db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM businesses WHERE id = ?", (b_id,))
        b_row = cursor.fetchone()

    bus = dict(b_row)
    bus_id = bus["id"]

    # Parse JSON fields
    try:
        bus["broadcast_notice"] = json.loads(bus["broadcast_notice"]) if isinstance(bus.get("broadcast_notice"), str) else bus.get("broadcast_notice", {})
    except Exception:
        bus["broadcast_notice"] = {"is_active": False, "notice_text": "", "effective_dates": ""}

    try:
        bus["operating_hours"] = json.loads(bus["operating_hours"]) if isinstance(bus.get("operating_hours"), str) else bus.get("operating_hours", {})
    except Exception:
        bus["operating_hours"] = {}

    try:
        bus["escalation_rules"] = json.loads(bus["escalation_rules"]) if isinstance(bus.get("escalation_rules"), str) else bus.get("escalation_rules", [])
    except Exception:
        bus["escalation_rules"] = ["human", "manager"]

    # Fetch services
    cursor.execute("SELECT * FROM services WHERE business_id = ? AND is_active = 1 ORDER BY created_at ASC", (bus_id,))
    services = []
    for s in cursor.fetchall():
        s_dict = dict(s)
        services.append({
            "id": s_dict["id"],
            "name": s_dict["name"],
            "description": s_dict.get("description", ""),
            "price": float(s_dict["price"]),
            "duration": f"{s_dict['duration_minutes']} mins",
            "category": s_dict.get("category", "General")
        })

    # Fetch FAQs
    cursor.execute("SELECT * FROM faqs WHERE business_id = ? ORDER BY display_order ASC, created_at ASC", (bus_id,))
    faqs = []
    for f in cursor.fetchall():
        f_dict = dict(f)
        faqs.append({
            "id": f_dict["id"],
            "question": f_dict["question"],
            "answer": f_dict["answer"],
            "category": f_dict.get("category", "General")
        })

    conn.close()

    return {
        "business_id": bus.get("slug") or business_id,
        "tenant_id": bus_id,
        "business_name": bus.get("name", "Apex Studio"),
        "industry": bus.get("industry", "general"),
        "client_label": bus.get("client_label", "Client"),
        "provider_label": bus.get("provider_label", "Specialist"),
        "tone": bus.get("tone", "Friendly and professional"),
        "currency": bus.get("currency", "₹"),
        "broadcast_notice": bus["broadcast_notice"],
        "emergency_notice": bus["broadcast_notice"],
        "operating_hours": bus["operating_hours"],
        "services": services,
        "faqs": faqs,
        "escalation_rules": bus["escalation_rules"],
        "updated_at": bus.get("updated_at")
    }


def update_universal_business(config_data: Dict[str, Any], business_id: str = "default_business") -> Dict[str, Any]:
    """
    Updates business configuration fields transactionally without destroying unmentioned records.
    """
    conn = local_db.get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM businesses WHERE slug = ? OR id = ? LIMIT 1", (business_id, business_id))
    b_row = cursor.fetchone()
    if not b_row:
        bus_id = str(uuid.uuid4())
        now = _now_iso()
        cursor.execute("""
        INSERT INTO businesses (id, slug, name, industry, timezone, currency, client_label, provider_label, tone, created_at, updated_at)
        VALUES (?, ?, ?, 'general', 'Asia/Kolkata', '₹', 'Client', 'Specialist', 'Professional', ?, ?)
        """, (bus_id, business_id, config_data.get("business_name", "DeskOS Business"), now, now))
    else:
        bus_id = b_row["id"]

    now = _now_iso()
    updates = []
    params = []

    if "business_name" in config_data and config_data["business_name"] is not None:
        updates.append("name = ?")
        params.append(config_data["business_name"])
    if "industry" in config_data and config_data["industry"] is not None:
        updates.append("industry = ?")
        params.append(config_data["industry"])
    if "client_label" in config_data and config_data["client_label"] is not None:
        updates.append("client_label = ?")
        params.append(config_data["client_label"])
    if "provider_label" in config_data and config_data["provider_label"] is not None:
        updates.append("provider_label = ?")
        params.append(config_data["provider_label"])
    if "tone" in config_data and config_data["tone"] is not None:
        updates.append("tone = ?")
        params.append(config_data["tone"])
    if "currency" in config_data and config_data["currency"] is not None:
        updates.append("currency = ?")
        params.append(config_data["currency"])

    notice = config_data.get("broadcast_notice") or config_data.get("emergency_notice")
    if notice is not None:
        updates.append("broadcast_notice = ?")
        params.append(json.dumps(notice))

    if "operating_hours" in config_data and config_data["operating_hours"] is not None:
        updates.append("operating_hours = ?")
        params.append(json.dumps(config_data["operating_hours"]))

    if "escalation_rules" in config_data and config_data["escalation_rules"] is not None:
        updates.append("escalation_rules = ?")
        params.append(json.dumps(config_data["escalation_rules"]))

    if updates:
        updates.append("updated_at = ?")
        params.append(now)
        params.append(bus_id)
        sql = f"UPDATE businesses SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(sql, tuple(params))

    # Update services if explicitly supplied
    if "services" in config_data and config_data["services"] is not None:
        cursor.execute("DELETE FROM services WHERE business_id = ?", (bus_id,))
        for s in config_data["services"]:
            dur_mins = 30
            raw_dur = str(s.get("duration", "30 mins"))
            import re
            m = re.search(r'\d+', raw_dur)
            if m:
                dur_mins = int(m.group(0))
            cursor.execute("""
            INSERT INTO services (id, business_id, name, description, price, duration_minutes, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), bus_id, s.get("name", "Service"), s.get("description", ""), float(s.get("price", 0)), dur_mins, s.get("category", "General"), now, now))

    # Update FAQs if explicitly supplied
    if "faqs" in config_data and config_data["faqs"] is not None:
        cursor.execute("DELETE FROM faqs WHERE business_id = ?", (bus_id,))
        for idx, f in enumerate(config_data["faqs"]):
            cursor.execute("""
            INSERT INTO faqs (id, business_id, question, answer, category, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), bus_id, f.get("question", ""), f.get("answer", ""), f.get("category", "General"), idx + 1, now, now))

    conn.commit()
    conn.close()

    return get_universal_business(business_id)


def apply_industry_preset_safe(preset_key: str, business_id: str = "default_business", preserve_custom: bool = True) -> Dict[str, Any]:
    """
    Template Engine:
    Applies industry presets safely. When preserve_custom=True, it updates identity terms,
    and only seeds missing default services, hours, or FAQs without destroying custom ones.
    """
    preset = INDUSTRY_PRESETS.get(preset_key.lower())
    if not preset:
        raise ValueError(f"Unknown industry preset: {preset_key}. Choose from {list(INDUSTRY_PRESETS.keys())}")

    current = get_universal_business(business_id)
    update_data = {
        "business_name": preset["business_name"] if not current.get("business_name") or "Apex" in current.get("business_name", "") else current["business_name"],
        "industry": preset["industry"],
        "client_label": preset["client_label"],
        "provider_label": preset["provider_label"],
        "tone": preset["tone"],
        "currency": preset["currency"],
        "escalation_rules": preset["escalation_rules"]
    }

    if not preserve_custom or not current.get("services"):
        update_data["services"] = preset["services"]
    if not preserve_custom or not current.get("faqs"):
        update_data["faqs"] = preset["faqs"]
    if not preserve_custom or not current.get("operating_hours"):
        update_data["operating_hours"] = preset["operating_hours"]

    return update_universal_business(update_data, business_id)


def apply_industry_preset(preset_key: str, business_id: str = "default_business") -> Dict[str, Any]:
    return apply_industry_preset_safe(preset_key, business_id, preserve_custom=False)


# ==============================================================================
# Appointment Booking Engine with Overlap Protection
# ==============================================================================

def check_slot_available(
    slot_time: str,
    business_id: str = "default_business",
    staff_id: Optional[str] = None
) -> bool:
    """
    Checks if a slot is available for booking, validating both business opening hours
    and checking for overlapping active appointments.
    """
    config = get_universal_business(business_id)
    bus_tz = scheduler.get_business_timezone(config.get("timezone"))
    start_dt, end_dt = scheduler.parse_natural_slot_time(slot_time, bus_tz)

    # 1. Opening hours and closure validation
    is_valid_hours, reason = scheduler.validate_slot_within_operating_hours(
        start_dt, config.get("operating_hours", {}), config.get("broadcast_notice")
    )
    if not is_valid_hours:
        logger.info("Slot %s outside open hours: %s", slot_time, reason)
        return False

    # 2. Database collision check
    conn = local_db.get_connection()
    cursor = conn.cursor()

    # Expire old holds first
    now_iso = _now_iso()
    cursor.execute("""
    UPDATE appointments SET status = 'cancelled', updated_at = ?
    WHERE status = 'hold' AND hold_expires_at <= ?
    """, (now_iso, now_iso))
    conn.commit()

    start_iso = start_dt.isoformat()
    end_iso = end_dt.isoformat()

    # Check overlaps: (start_A < end_B) AND (end_A > start_B)
    if staff_id:
        cursor.execute("""
        SELECT id FROM appointments
        WHERE (business_id = ? OR business_id = (SELECT id FROM businesses WHERE slug = ?))
          AND staff_id = ?
          AND status IN ('confirmed', 'in_progress', 'hold')
          AND start_time < ? AND end_time > ?
        LIMIT 1
        """, (business_id, business_id, staff_id, end_iso, start_iso))
    else:
        cursor.execute("""
        SELECT id FROM appointments
        WHERE (business_id = ? OR business_id = (SELECT id FROM businesses WHERE slug = ?))
          AND status IN ('confirmed', 'in_progress', 'hold')
          AND start_time < ? AND end_time > ?
        LIMIT 1
        """, (business_id, business_id, end_iso, start_iso))

    row = cursor.fetchone()
    conn.close()
    return row is None


def create_universal_booking(
    client_name: str,
    phone: str,
    slot_time: str,
    service: str,
    provider_name: Optional[str] = None,
    notes: Optional[str] = None,
    conversation_id: Optional[str] = None,
    business_id: str = "default_business",
    force: bool = False
) -> Dict[str, Any]:
    """
    Creates an appointment booking with overlap protection, automatic duration calculation,
    and enqueues confirmation and reminder message jobs.
    """
    config = get_universal_business(business_id)
    bus_tz = scheduler.get_business_timezone(config.get("timezone"))

    # Determine service duration
    duration_mins = 30
    for s in config.get("services", []):
        if s["name"].lower() in service.lower() or service.lower() in s["name"].lower():
            import re
            m = re.search(r'\d+', str(s.get("duration", "30")))
            if m:
                duration_mins = int(m.group(0))
            break

    start_dt, end_dt = scheduler.parse_natural_slot_time(slot_time, bus_tz, default_duration_minutes=duration_mins)

    # Validate opening hours
    is_open, closed_reason = scheduler.validate_slot_within_operating_hours(
        start_dt, config.get("operating_hours", {}), config.get("broadcast_notice")
    )
    if not is_open and not force:
        alternatives = scheduler.generate_suggested_slots(start_dt, config.get("operating_hours", {}))
        alt_str = ", ".join(alternatives)
        raise ValueError(f"Cannot book: {closed_reason} Available alternative slots: {alt_str}")

    # Resolve staff if provider_name given
    staff_id = None
    conn = local_db.get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM businesses WHERE slug = ? OR id = ? LIMIT 1", (business_id, business_id))
    b_row = cursor.fetchone()
    b_id = b_row["id"] if b_row else "00000000-0000-0000-0000-000000000001"

    if provider_name:
        cursor.execute("SELECT id FROM staff_resources WHERE business_id = ? AND name LIKE ? LIMIT 1", (b_id, f"%{provider_name}%"))
        st_row = cursor.fetchone()
        if st_row:
            staff_id = st_row["id"]

    # Overlap protection check
    start_iso = start_dt.isoformat()
    end_iso = end_dt.isoformat()

    if not force:
        if staff_id:
            cursor.execute("""
            SELECT id FROM appointments
            WHERE business_id = ? AND staff_id = ? AND status IN ('confirmed', 'in_progress', 'hold')
              AND start_time < ? AND end_time > ?
            LIMIT 1
            """, (b_id, staff_id, end_iso, start_iso))
        else:
            cursor.execute("""
            SELECT id FROM appointments
            WHERE business_id = ? AND status IN ('confirmed', 'in_progress', 'hold')
              AND start_time < ? AND end_time > ?
            LIMIT 1
            """, (b_id, end_iso, start_iso))

        collision = cursor.fetchone()
        if collision:
            conn.close()
            alternatives = scheduler.generate_suggested_slots(start_dt, config.get("operating_hours", {}))
            alt_str = ", ".join(alternatives)
            raise ValueError(f"Requested slot '{slot_time}' is already booked. Alternative open times: {alt_str}")

    booking_id = str(uuid.uuid4())
    now_iso = _now_iso()

    cursor.execute("""
    INSERT INTO appointments (
        id, business_id, client_name, phone, service_name, staff_id, conversation_id,
        start_time, end_time, slot_time, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
    """, (booking_id, b_id, client_name, phone, service, staff_id, conversation_id, start_iso, end_iso, slot_time, notes, now_iso, now_iso))

    # Log analytics event
    cursor.execute("""
    INSERT INTO analytics_events (id, business_id, event_type, entity_id, properties, created_at)
    VALUES (?, ?, 'appointment_booked', ?, ?, ?)
    """, (str(uuid.uuid4()), b_id, booking_id, json.dumps({"service": service, "slot_time": slot_time}), now_iso))

    conn.commit()
    conn.close()

    # Enqueue durable notifications
    try:
        notifications.queue_booking_notifications(
            business_id=b_id,
            appointment_id=booking_id,
            recipient_phone=phone,
            client_name=client_name,
            service_name=service,
            slot_time=slot_time,
            start_time_iso=start_iso,
            business_name=config.get("business_name", "DeskOS")
        )
    except Exception as e:
        logger.warning("Failed to queue booking notifications: %s", e)

    # Mirror to Supabase if available
    if supabase:
        try:
            supabase.table("bookings").insert({
                "id": booking_id,
                "conversation_id": conversation_id,
                "patient_name": client_name,
                "phone": phone,
                "slot_time": slot_time,
                "service": service,
                "service_type": service,
                "status": "confirmed",
                "created_at": now_iso
            }).execute()
        except Exception as e:
            logger.debug("Remote supabase bookings insert note: %s", e)

    return {
        "id": booking_id,
        "business_id": business_id,
        "client_name": client_name,
        "patient_name": client_name,
        "phone": phone,
        "slot_time": slot_time,
        "start_time": start_iso,
        "end_time": end_iso,
        "service": service,
        "service_name": service,
        "provider_name": provider_name,
        "status": "confirmed",
        "notes": notes,
        "created_at": now_iso
    }


def cancel_booking(booking_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
    """Cancels an appointment and immediately releases the time slot."""
    now_iso = _now_iso()
    conn = local_db.get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM appointments WHERE id = ?", (booking_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError(f"Appointment with ID '{booking_id}' not found.")

    booking = dict(row)
    cursor.execute("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?", (now_iso, booking_id))

    # Log analytics event
    cursor.execute("""
    INSERT INTO analytics_events (id, business_id, event_type, entity_id, properties, created_at)
    VALUES (?, ?, 'appointment_cancelled', ?, ?, ?)
    """, (str(uuid.uuid4()), booking["business_id"], booking_id, json.dumps({"reason": reason}), now_iso))

    conn.commit()
    conn.close()

    # Queue cancellation notice
    try:
        notifications.queue_cancellation_notification(
            business_id=booking["business_id"],
            appointment_id=booking_id,
            recipient_phone=booking["phone"],
            client_name=booking["client_name"],
            service_name=booking["service_name"],
            slot_time=booking["slot_time"],
            reason=reason
        )
    except Exception as e:
        logger.warning("Failed to queue cancellation notice: %s", e)

    booking["status"] = "cancelled"
    booking["updated_at"] = now_iso
    return booking


def reschedule_booking(booking_id: str, new_slot_time: str) -> Dict[str, Any]:
    """Reschedules an appointment transactionally to a new time slot with conflict checking."""
    conn = local_db.get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM appointments WHERE id = ?", (booking_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError(f"Appointment with ID '{booking_id}' not found.")

    booking = dict(row)
    b_id = booking["business_id"]

    config = get_universal_business(b_id)
    bus_tz = scheduler.get_business_timezone(config.get("timezone"))
    start_dt, end_dt = scheduler.parse_natural_slot_time(new_slot_time, bus_tz)

    start_iso = start_dt.isoformat()
    end_iso = end_dt.isoformat()

    # Check collision excluding current booking
    cursor.execute("""
    SELECT id FROM appointments
    WHERE business_id = ? AND id != ? AND status IN ('confirmed', 'in_progress', 'hold')
      AND start_time < ? AND end_time > ?
    LIMIT 1
    """, (b_id, booking_id, end_iso, start_iso))
    collision = cursor.fetchone()
    if collision:
        conn.close()
        alternatives = scheduler.generate_suggested_slots(start_dt, config.get("operating_hours", {}))
        alt_str = ", ".join(alternatives)
        raise ValueError(f"New slot '{new_slot_time}' is already booked. Alternative open times: {alt_str}")

    now_iso = _now_iso()
    cursor.execute("""
    UPDATE appointments
    SET slot_time = ?, start_time = ?, end_time = ?, updated_at = ?
    WHERE id = ?
    """, (new_slot_time, start_iso, end_iso, now_iso, booking_id))
    conn.commit()
    conn.close()

    booking["slot_time"] = new_slot_time
    booking["start_time"] = start_iso
    booking["end_time"] = end_iso
    booking["updated_at"] = now_iso
    return booking


def list_universal_bookings(business_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns all appointment bookings from real persistent database."""
    conn = local_db.get_connection()
    cursor = conn.cursor()

    if business_id:
        cursor.execute("""
        SELECT a.*, sr.name AS provider_name
        FROM appointments a
        LEFT JOIN staff_resources sr ON a.staff_id = sr.id
        WHERE a.business_id = ? OR a.business_id = (SELECT id FROM businesses WHERE slug = ?)
        ORDER BY a.created_at DESC
        """, (business_id, business_id))
    else:
        cursor.execute("""
        SELECT a.*, sr.name AS provider_name
        FROM appointments a
        LEFT JOIN staff_resources sr ON a.staff_id = sr.id
        ORDER BY a.created_at DESC
        """)

    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        b = dict(r)
        b["patient_name"] = b["client_name"]
        b["service"] = b["service_name"]
        result.append(b)
    return result


def list_bookings() -> List[Dict[str, Any]]:
    return list_universal_bookings()


# ==============================================================================
# Staff Resources Management
# ==============================================================================

def list_staff(business_id: str = "default_business") -> List[Dict[str, Any]]:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM staff_resources
    WHERE business_id = ? OR business_id = (SELECT id FROM businesses WHERE slug = ?)
    ORDER BY created_at ASC
    """, (business_id, business_id))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_staff(business_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    b_id = _get_or_create_business_id(business_id)
    conn = local_db.get_connection()
    cursor = conn.cursor()

    staff_id = str(uuid.uuid4())
    now = _now_iso()
    cursor.execute("""
    INSERT INTO staff_resources (id, business_id, name, role, email, phone, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    """, (staff_id, b_id, data.get("name", "Staff Member"), data.get("role", "Specialist"), data.get("email"), data.get("phone"), now, now))
    conn.commit()

    cursor.execute("SELECT * FROM staff_resources WHERE id = ?", (staff_id,))
    created = dict(cursor.fetchone())
    conn.close()
    return created


def update_staff(staff_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    now = _now_iso()
    cursor.execute("""
    UPDATE staff_resources
    SET name = COALESCE(?, name), role = COALESCE(?, role), email = COALESCE(?, email), phone = COALESCE(?, phone), updated_at = ?
    WHERE id = ?
    """, (data.get("name"), data.get("role"), data.get("email"), data.get("phone"), now, staff_id))
    conn.commit()
    cursor.execute("SELECT * FROM staff_resources WHERE id = ?", (staff_id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return updated


def delete_staff(staff_id: str) -> bool:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM staff_resources WHERE id = ?", (staff_id,))
    conn.commit()
    conn.close()
    return True


# ==============================================================================
# Services Management
# ==============================================================================

def list_services(business_id: str = "default_business") -> List[Dict[str, Any]]:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM services
    WHERE (business_id = ? OR business_id = (SELECT id FROM businesses WHERE slug = ?)) AND is_active = 1
    ORDER BY created_at ASC
    """, (business_id, business_id))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_service(business_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    b_id = _get_or_create_business_id(business_id)
    conn = local_db.get_connection()
    cursor = conn.cursor()

    srv_id = str(uuid.uuid4())
    now = _now_iso()
    dur = int(data.get("duration_minutes", 30))
    cursor.execute("""
    INSERT INTO services (id, business_id, name, description, price, duration_minutes, category, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    """, (srv_id, b_id, data.get("name", "Service"), data.get("description", ""), float(data.get("price", 0)), dur, data.get("category", "General"), now, now))
    conn.commit()

    cursor.execute("SELECT * FROM services WHERE id = ?", (srv_id,))
    created = dict(cursor.fetchone())
    conn.close()
    return created


def update_service(service_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    now = _now_iso()
    cursor.execute("""
    UPDATE services
    SET name = COALESCE(?, name), price = COALESCE(?, price), duration_minutes = COALESCE(?, duration_minutes), category = COALESCE(?, category), updated_at = ?
    WHERE id = ?
    """, (data.get("name"), data.get("price"), data.get("duration_minutes"), data.get("category"), now, service_id))
    conn.commit()
    cursor.execute("SELECT * FROM services WHERE id = ?", (service_id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return updated


def delete_service(service_id: str) -> bool:
    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE services SET is_active = 0 WHERE id = ?", (service_id,))
    conn.commit()
    conn.close()
    return True


# ==============================================================================
# True Persisted Analytics (Zero Fabrications)
# ==============================================================================

def calculate_analytics(business_id: str = "default_business") -> Dict[str, Any]:
    """
    Computes real, non-fabricated metrics from persisted records:
    - total_leads: count of real unique conversations
    - booked_count: count of confirmed/completed appointments
    - conversion_rate: (booked_count / total_leads * 100) or 0
    - active_ai_count: count of conversations with is_ai_active = true
    - escalated_count: count of conversations escalated to human
    - top_services: service breakdown from actual bookings (empty list if 0 bookings)
    """
    convs = list_conversations(business_id)
    bookings = list_universal_bookings(business_id)
    config = get_universal_business(business_id)

    total_leads = len(convs)
    confirmed_bookings = [b for b in bookings if b.get("status") in ("confirmed", "completed", "in_progress")]
    booked_count = len(confirmed_bookings)
    conversion_rate = round((booked_count / total_leads * 100), 1) if total_leads > 0 else 0.0

    active_ai_count = sum(1 for c in convs if c.get("is_ai_active") is not False)
    escalated_count = sum(1 for c in convs if c.get("is_ai_active") is False or c.get("current_state") == "escalated")

    # Service distribution strictly from actual bookings
    service_counts: Dict[str, int] = {}
    for b in confirmed_bookings:
        srv_name = b.get("service_name") or b.get("service") or "Consultation"
        service_counts[srv_name] = service_counts.get(srv_name, 0) + 1

    sorted_services = sorted(service_counts.items(), key=lambda x: x[1], reverse=True)
    top_services = []
    if sorted_services:
        total_inquiries = sum(service_counts.values())
        for name, count in sorted_services[:5]:
            top_services.append({
                "name": name,
                "count": count,
                "percentage": round((count / total_inquiries) * 100, 1)
            })

    broadcast = config.get("broadcast_notice", {})

    return {
        "total_leads": total_leads,
        "booked_count": booked_count,
        "conversion_rate": conversion_rate,
        "active_ai_count": active_ai_count,
        "escalated_count": escalated_count,
        "top_services": top_services,
        "business_name": config.get("business_name", "Apex Universal Studio"),
        "industry": config.get("industry", "healthcare"),
        "client_label": config.get("client_label", "Client"),
        "provider_label": config.get("provider_label", "Provider"),
        "currency": config.get("currency", "₹"),
        "broadcast_notice_active": bool(broadcast.get("is_active", False)),
        "broadcast_notice": broadcast
    }
