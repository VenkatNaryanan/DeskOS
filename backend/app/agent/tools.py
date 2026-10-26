import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from app.services import supabase_client, scheduler

logger = logging.getLogger("agent_tools")


# --- Pydantic Tool Schemas ---

class CheckAndBookAppointmentSchema(BaseModel):
    client_name: Optional[str] = Field(None, description="Full name of the client/customer")
    patient_name: Optional[str] = Field(None, description="Alternative field for client full name")
    phone: str = Field(..., description="Contact phone or WhatsApp number of the client")
    slot_time: str = Field(..., description="Desired appointment date and time (e.g. 'Tomorrow at 10:30 AM', 'Monday at 3:00 PM')")
    service: str = Field(..., description="Specific service or procedure requested from the business catalog")
    provider_name: Optional[str] = Field(None, description="Specific professional/stylist/advisor/specialist requested if any")
    notes: Optional[str] = Field(None, description="Special instructions, preferences, or details")


class CancelBookingSchema(BaseModel):
    booking_id: Optional[str] = Field(None, description="Appointment ID to cancel")
    phone: Optional[str] = Field(None, description="Client contact phone number")
    reason: Optional[str] = Field(None, description="Reason for cancellation")


class RescheduleBookingSchema(BaseModel):
    booking_id: Optional[str] = Field(None, description="Appointment ID to reschedule")
    phone: Optional[str] = Field(None, description="Client contact phone number")
    new_slot_time: str = Field(..., description="New requested appointment date and time")


class CheckAvailableSlotsSchema(BaseModel):
    date_or_time: str = Field(..., description="Date or time string to check availability for (e.g. 'Tomorrow', 'Monday afternoon')")


class EscalateToHumanSchema(BaseModel):
    reason: str = Field(..., description="Detailed clinical, emotional, complexity, or policy reason why human staff takeover is required")


# --- Groq / OpenAI Compatible Function Definitions ---

AGENT_TOOLS_SPEC: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "check_and_book_appointment",
            "description": "Check slot availability with overlap protection, and confirm an appointment slot into universal_bookings for the client.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {
                        "type": "string",
                        "description": "Full name of the client or customer"
                    },
                    "phone": {
                        "type": "string",
                        "description": "Contact phone/WhatsApp number of the client"
                    },
                    "slot_time": {
                        "type": "string",
                        "description": "Requested appointment date and time"
                    },
                    "service": {
                        "type": "string",
                        "description": "Requested service name from the catalog"
                    },
                    "provider_name": {
                        "type": "string",
                        "description": "Requested staff, stylist, doctor, advisor, or mechanic name if any"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Optional notes or requirements"
                    }
                },
                "required": ["phone", "slot_time", "service"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_available_slots",
            "description": "Check whether a particular date or time has open slots, or get suggested available times.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_or_time": {
                        "type": "string",
                        "description": "Date or time phrase to check (e.g. 'Tomorrow', 'Friday 10 AM')"
                    }
                },
                "required": ["date_or_time"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_booking",
            "description": "Cancel an existing appointment and release the slot.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {
                        "type": "string",
                        "description": "Optional appointment ID if known"
                    },
                    "phone": {
                        "type": "string",
                        "description": "Client contact phone number"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for cancellation"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reschedule_booking",
            "description": "Reschedule an existing appointment to a new date and time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {
                        "type": "string",
                        "description": "Optional appointment ID if known"
                    },
                    "phone": {
                        "type": "string",
                        "description": "Client contact phone number"
                    },
                    "new_slot_time": {
                        "type": "string",
                        "description": "New date and time requested"
                    }
                },
                "required": ["new_slot_time"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Immediately transfer the conversation to a human operator or manager. Pauses autonomous AI replies.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Reason for human escalation (e.g. emergency, refund demand, policy complaint, explicit request for human)"
                    }
                },
                "required": ["reason"]
            }
        }
    }
]


# --- Tool Implementation Handlers ---

def execute_check_and_book_appointment(
    client_name: str,
    phone: str,
    slot_time: str,
    service: str,
    conversation_id: str,
    provider_name: Optional[str] = None,
    notes: Optional[str] = None,
    business_id: str = "default_business"
) -> Dict[str, Any]:
    """
    Checks slot availability with overlap protection, inserts into universal_bookings,
    and updates conversation state to 'booked'.
    """
    logger.info("Executing check_and_book_appointment for %s on %s (service: %s)", client_name, slot_time, service)

    try:
        booking = supabase_client.create_universal_booking(
            client_name=client_name,
            phone=phone,
            slot_time=slot_time,
            service=service,
            provider_name=provider_name,
            notes=notes,
            conversation_id=conversation_id,
            business_id=business_id,
            force=False
        )
        supabase_client.update_conversation_state(conversation_id, "booked")

        return {
            "success": True,
            "message": f"Appointment confirmed successfully for {client_name} on {slot_time} for {service}.",
            "booking_id": booking.get("id"),
            "booking": booking
        }
    except ValueError as e:
        logger.warning("Booking creation error: %s", e)
        return {
            "success": False,
            "overlap": "already booked" in str(e).lower(),
            "message": str(e),
            "slot_time": slot_time
        }


def execute_check_available_slots(
    date_or_time: str,
    business_id: str = "default_business"
) -> Dict[str, Any]:
    """Checks availability and returns suggested open slots."""
    config = supabase_client.get_universal_business(business_id)
    bus_tz = scheduler.get_business_timezone(config.get("timezone"))
    start_dt, _ = scheduler.parse_natural_slot_time(date_or_time, bus_tz)
    
    is_open, reason = scheduler.validate_slot_within_operating_hours(
        start_dt, config.get("operating_hours", {}), config.get("broadcast_notice")
    )
    is_available = supabase_client.check_slot_available(date_or_time, business_id)

    suggestions = scheduler.generate_suggested_slots(start_dt, config.get("operating_hours", {}))

    return {
        "success": True,
        "is_open": is_open,
        "is_available": is_available,
        "checked_time": start_dt.strftime("%A, %d %B at %I:%M %p"),
        "closure_reason": reason,
        "suggested_slots": suggestions
    }


def execute_cancel_booking(
    booking_id: Optional[str] = None,
    phone: Optional[str] = None,
    reason: Optional[str] = None,
    business_id: str = "default_business"
) -> Dict[str, Any]:
    """Cancels booking by ID or by matching phone number."""
    target_id = booking_id
    if not target_id and phone:
        bookings = supabase_client.list_universal_bookings(business_id)
        active = [b for b in bookings if phone in b.get("phone", "") and b.get("status") == "confirmed"]
        if active:
            target_id = active[0]["id"]

    if not target_id:
        return {"success": False, "message": "Could not identify an active appointment to cancel."}

    try:
        cancelled = supabase_client.cancel_booking(target_id, reason=reason)
        return {
            "success": True,
            "message": f"Appointment on {cancelled.get('slot_time')} for {cancelled.get('client_name')} has been cancelled.",
            "booking": cancelled
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


def execute_reschedule_booking(
    new_slot_time: str,
    booking_id: Optional[str] = None,
    phone: Optional[str] = None,
    business_id: str = "default_business"
) -> Dict[str, Any]:
    """Reschedules booking by ID or matching phone number."""
    target_id = booking_id
    if not target_id and phone:
        bookings = supabase_client.list_universal_bookings(business_id)
        active = [b for b in bookings if phone in b.get("phone", "") and b.get("status") == "confirmed"]
        if active:
            target_id = active[0]["id"]

    if not target_id:
        return {"success": False, "message": "Could not identify an active appointment to reschedule."}

    try:
        rescheduled = supabase_client.reschedule_booking(target_id, new_slot_time=new_slot_time)
        return {
            "success": True,
            "message": f"Appointment successfully rescheduled to {new_slot_time} for {rescheduled.get('client_name')}.",
            "booking": rescheduled
        }
    except ValueError as e:
        return {"success": False, "message": str(e)}


def execute_escalate_to_human(
    reason: str,
    conversation_id: str
) -> Dict[str, Any]:
    """Updates is_ai_active = false in database and sets state to 'escalated'."""
    logger.info("Executing escalate_to_human for conv %s. Reason: %s", conversation_id, reason)
    supabase_client.set_ai_status(conversation_id, is_active=False)
    supabase_client.update_conversation_state(conversation_id, "escalated")
    return {
        "success": True,
        "message": f"Conversation escalated to human staff. Reason: {reason}. Autonomous AI replies paused.",
        "is_ai_active": False
    }


def execute_tool_call(
    tool_name: str,
    arguments_json: str,
    conversation_id: str,
    business_id: str = "default_business"
) -> Dict[str, Any]:
    """Parses arguments JSON and dispatches to appropriate tool handler."""
    try:
        args = json.loads(arguments_json) if isinstance(arguments_json, str) else arguments_json
    except Exception as e:
        logger.error("Failed to parse tool arguments: %s", e)
        return {"error": f"Invalid JSON arguments: {str(e)}"}

    if tool_name in ("check_and_book_appointment", "book_appointment"):
        validated = CheckAndBookAppointmentSchema(**args)
        c_name = validated.client_name or validated.patient_name or "Guest Client"
        return execute_check_and_book_appointment(
            client_name=c_name,
            phone=validated.phone,
            slot_time=validated.slot_time,
            service=validated.service,
            conversation_id=conversation_id,
            provider_name=validated.provider_name,
            notes=validated.notes,
            business_id=business_id
        )
    elif tool_name == "check_available_slots":
        validated = CheckAvailableSlotsSchema(**args)
        return execute_check_available_slots(
            date_or_time=validated.date_or_time,
            business_id=business_id
        )
    elif tool_name == "cancel_booking":
        validated = CancelBookingSchema(**args)
        return execute_cancel_booking(
            booking_id=validated.booking_id,
            phone=validated.phone,
            reason=validated.reason,
            business_id=business_id
        )
    elif tool_name == "reschedule_booking":
        validated = RescheduleBookingSchema(**args)
        return execute_reschedule_booking(
            new_slot_time=validated.new_slot_time,
            booking_id=validated.booking_id,
            phone=validated.phone,
            business_id=business_id
        )
    elif tool_name == "escalate_to_human":
        validated = EscalateToHumanSchema(**args)
        return execute_escalate_to_human(
            reason=validated.reason,
            conversation_id=conversation_id
        )
    else:
        return {"error": f"Unknown tool: {tool_name}"}
