import json
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from app.services import local_db, meta

logger = logging.getLogger("notifications")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def queue_booking_notifications(
    business_id: str,
    appointment_id: str,
    recipient_phone: str,
    client_name: str,
    service_name: str,
    slot_time: str,
    start_time_iso: str,
    business_name: str = "DeskOS"
) -> List[str]:
    """
    Durable Queue Dispatcher:
    Queues:
    1. Immediate booking confirmation job.
    2. 24-hour advance appointment reminder job.
    3. 2-hour day-of appointment reminder job.
    """
    job_ids: List[str] = []
    conn = local_db.get_connection()
    cursor = conn.cursor()

    try:
        start_dt = datetime.fromisoformat(start_time_iso.replace("Z", "+00:00"))
    except Exception:
        start_dt = datetime.now(timezone.utc) + timedelta(days=1)

    now = datetime.now(timezone.utc)
    now_str = _now_iso()

    # 1. Immediate confirmation job
    conf_id = str(uuid.uuid4())
    conf_payload = json.dumps({
        "type": "booking_confirmation",
        "client_name": client_name,
        "service_name": service_name,
        "slot_time": slot_time,
        "business_name": business_name,
        "text": f"✅ *Appointment Confirmed!*\n\nHello {client_name},\nYour appointment for *{service_name}* at *{business_name}* is booked for *{slot_time}*.\n\nReply to this message if you need to reschedule or cancel."
    })
    cursor.execute("""
    INSERT INTO message_jobs (id, business_id, appointment_id, recipient_phone, job_type, scheduled_at, status, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'booking_confirmation', ?, 'pending', ?, ?, ?)
    """, (conf_id, business_id, appointment_id, recipient_phone, now_str, conf_payload, now_str, now_str))
    job_ids.append(conf_id)

    # 2. 24-hour reminder job (if appointment is more than 24h away)
    reminder_24h_time = start_dt - timedelta(hours=24)
    if reminder_24h_time > now:
        rem24_id = str(uuid.uuid4())
        rem24_payload = json.dumps({
            "type": "reminder_24h",
            "client_name": client_name,
            "service_name": service_name,
            "slot_time": slot_time,
            "business_name": business_name,
            "text": f"⏰ *Appointment Reminder (Tomorrow)*\n\nHello {client_name},\nThis is a friendly reminder for your upcoming *{service_name}* appointment tomorrow at *{slot_time}* with *{business_name}*.\n\nWe look forward to seeing you!"
        })
        cursor.execute("""
        INSERT INTO message_jobs (id, business_id, appointment_id, recipient_phone, job_type, scheduled_at, status, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'reminder_24h', ?, 'pending', ?, ?, ?)
        """, (rem24_id, business_id, appointment_id, recipient_phone, reminder_24h_time.isoformat(), rem24_payload, now_str, now_str))
        job_ids.append(rem24_id)

    # 3. 2-hour reminder job (if appointment is more than 2h away)
    reminder_2h_time = start_dt - timedelta(hours=2)
    if reminder_2h_time > now:
        rem2_id = str(uuid.uuid4())
        rem2_payload = json.dumps({
            "type": "reminder_2h",
            "client_name": client_name,
            "service_name": service_name,
            "slot_time": slot_time,
            "business_name": business_name,
            "text": f"🔔 *Appointment Starting Soon*\n\nHello {client_name},\nYour appointment for *{service_name}* at *{business_name}* begins in 2 hours at *{slot_time}*.\n\nPlease arrive 5 minutes early."
        })
        cursor.execute("""
        INSERT INTO message_jobs (id, business_id, appointment_id, recipient_phone, job_type, scheduled_at, status, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'reminder_2h', ?, 'pending', ?, ?, ?)
        """, (rem2_id, business_id, appointment_id, recipient_phone, reminder_2h_time.isoformat(), rem2_payload, now_str, now_str))
        job_ids.append(rem2_id)

    conn.commit()
    conn.close()
    logger.info("Queued %d notification jobs for appointment %s", len(job_ids), appointment_id)
    return job_ids


def queue_cancellation_notification(
    business_id: str,
    appointment_id: str,
    recipient_phone: str,
    client_name: str,
    service_name: str,
    slot_time: str,
    reason: Optional[str] = None
) -> str:
    """Queues a cancellation notice to the customer."""
    job_id = str(uuid.uuid4())
    now_str = _now_iso()
    text = f"❌ *Appointment Cancelled*\n\nHello {client_name},\nYour appointment for *{service_name}* on *{slot_time}* has been cancelled"
    if reason:
        text += f" (Reason: {reason})"
    text += ".\n\nFeel free to reach out anytime to schedule a new appointment."

    payload = json.dumps({
        "type": "cancellation_notice",
        "client_name": client_name,
        "service_name": service_name,
        "slot_time": slot_time,
        "reason": reason,
        "text": text
    })

    conn = local_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO message_jobs (id, business_id, appointment_id, recipient_phone, job_type, scheduled_at, status, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'cancellation_notice', ?, 'pending', ?, ?, ?)
    """, (job_id, business_id, appointment_id, recipient_phone, now_str, payload, now_str, now_str))

    # Also cancel any pending reminder jobs for this appointment
    cursor.execute("""
    UPDATE message_jobs SET status = 'cancelled', updated_at = ?
    WHERE appointment_id = ? AND status = 'pending' AND job_type LIKE 'reminder_%'
    """, (now_str, appointment_id))

    conn.commit()
    conn.close()
    return job_id


async def process_due_message_jobs(batch_size: int = 10) -> int:
    """
    Worker runner:
    Claims and dispatches message_jobs where scheduled_at <= now() and status == 'pending'.
    Returns number of jobs processed.
    """
    now_str = _now_iso()
    conn = local_db.get_connection()
    cursor = conn.cursor()

    # Claim jobs with optimistic locking / status update
    cursor.execute("""
    SELECT id, recipient_phone, payload, attempts, max_attempts
    FROM message_jobs
    WHERE status = 'pending' AND scheduled_at <= ?
    ORDER BY scheduled_at ASC
    LIMIT ?
    """, (now_str, batch_size))
    due_jobs = cursor.fetchall()

    if not due_jobs:
        conn.close()
        return 0

    processed = 0
    for job in due_jobs:
        job_id = job["id"]
        phone = job["recipient_phone"]
        attempts = job["attempts"] + 1
        max_attempts = job["max_attempts"]

        cursor.execute("UPDATE message_jobs SET status = 'processing', attempts = ?, last_attempt_at = ? WHERE id = ?", (attempts, now_str, job_id))
        conn.commit()

        try:
            payload = json.loads(job["payload"]) if job["payload"] else {}
            text = payload.get("text", "")
            if text and phone:
                await meta.send_whatsapp_message(to_number=phone, text=text)

            cursor.execute("UPDATE message_jobs SET status = 'sent', updated_at = ? WHERE id = ?", (now_str, job_id))
            conn.commit()
            processed += 1
            logger.info("Successfully dispatched message_job %s to %s", job_id, phone)
        except Exception as e:
            logger.error("Failed to dispatch message_job %s: %s", job_id, e)
            new_status = 'failed' if attempts >= max_attempts else 'pending'
            cursor.execute("UPDATE message_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?", (new_status, str(e), now_str, job_id))
            conn.commit()

    conn.close()
    return processed
