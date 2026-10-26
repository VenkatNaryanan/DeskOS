import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from groq import Groq
from app.config import GROQ_API_KEY, GROQ_CHAT_MODEL
from app.services import supabase_client, scheduler
from app.agent.tools import AGENT_TOOLS_SPEC, execute_tool_call

logger = logging.getLogger("agent_core")

# Reliable Groq models supported on Groq LPUs
MODEL_CANDIDATES = [
    GROQ_CHAT_MODEL,
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768"
]


def generate_dynamic_system_prompt(business_id: str = "default_business") -> str:
    """
    Composes the Universal Multi-Industry System Prompt by querying business config
    and injecting live timezone-aware temporal context and dynamic terminology.
    """
    config = supabase_client.get_universal_business(business_id)
    bus_tz = scheduler.get_business_timezone(config.get("timezone"))
    now = datetime.now(bus_tz)
    current_datetime_str = now.strftime("%A, %d %B %Y, %I:%M %p %Z")
    current_day = now.strftime("%A")

    business_name = config.get("business_name") or "DeskOS Business"
    industry = config.get("industry") or "service"
    client_label = config.get("client_label") or "Client"
    provider_label = config.get("provider_label") or "Specialist"
    tone = config.get("tone") or "Friendly, efficient, and professional"
    currency = config.get("currency") or "₹"

    # Real-time Broadcast Notice (Holiday / Closure / Alert)
    notice_obj = config.get("broadcast_notice") or config.get("emergency_notice") or {}
    if isinstance(notice_obj, dict) and notice_obj.get("is_active"):
        notice_text = notice_obj.get("notice_text", "").strip()
        effective_dates = notice_obj.get("effective_dates", "").strip()
        broadcast_notice_str = f"📢 [ACTIVE ANNOUNCEMENT / CLOSURE NOTICE]: {notice_text} (Effective: {effective_dates})"
    else:
        broadcast_notice_str = f"None. {business_name} is operating normally on its standard schedule."

    # Weekly Operating Hours
    hours_obj = config.get("operating_hours") or {}
    hours_lines = []
    days_order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for day in days_order:
        day_info = hours_obj.get(day, {})
        day_title = day.capitalize()
        if day_info.get("is_closed"):
            hours_lines.append(f"- {day_title}: CLOSED")
        else:
            open_t = day_info.get("open", "09:00")
            close_t = day_info.get("close", "20:00")
            hours_lines.append(f"- {day_title}: {open_t} - {close_t}")
    operating_hours_str = "\n".join(hours_lines) if hours_lines else "Monday - Saturday: 09:00 - 20:00, Sunday: CLOSED"

    # Services Catalog
    services_list = config.get("services") or []
    service_lines = []
    for s in services_list:
        s_name = s.get("name", "Service")
        s_price = s.get("price", "TBD")
        s_dur = s.get("duration", "30 mins")
        s_cat = s.get("category", "General")
        service_lines.append(f"- **{s_name}**: {currency}{s_price} (Duration: {s_dur}, Category: {s_cat})")
    services_str = "\n".join(service_lines) if service_lines else f"- Standard Consultation: {currency}500\n- Primary Service: {currency}1500"

    # FAQs & Knowledge Base
    faqs_list = config.get("faqs") or []
    faq_lines = []
    for f in faqs_list:
        q = f.get("question", "")
        a = f.get("answer", "")
        if q and a:
            faq_lines.append(f"**Q: {q}**\nA: {a}")
    faqs_str = "\n\n".join(faq_lines) if faq_lines else "Q: Where are you located?\nA: Contact our office for directions."

    # Escalation Triggers
    escalation_triggers = config.get("escalation_rules") or ["emergency", "refund", "complaint", "human", "manager"]
    triggers_str = ", ".join(escalation_triggers)

    prompt = f"""You are the 24/7 Autonomous AI Receptionist & Appointment Coordinator for {business_name} ({industry.upper()} INDUSTRY).
You communicate via WhatsApp.

### Identity, Persona & Terminology:
- **Business Name**: {business_name}
- **Industry**: {industry}
- **Persona Tone**: {tone}
- **Client Term**: Refer to customers/callers as "{client_label}" (e.g., "{client_label}").
- **Provider Term**: Refer to staff/professionals as "{provider_label}" (e.g., "{provider_label}").
- **Currency**: When discussing or quoting prices, use "{currency}".

### Live Temporal Context:
- **Current Live Date & Time**: {current_datetime_str}
- **Today**: {current_day}

### Active Broadcast Notice / Schedule Alert:
{broadcast_notice_str}

### Weekly Operating Schedule:
{operating_hours_str}

### Official Services, Prices & Duration Catalog:
{services_str}

### Knowledge Base & FAQs:
{faqs_str}

### Escalation Trigger Keywords:
{triggers_str}

### Strict Guardrail Rules:
1. **Operating Hours & Broadcast Notice Enforcement**:
   - Always resolve relative dates ("today", "tomorrow", "this weekend") strictly relative to live date: {current_datetime_str}.
   - If a {client_label} requests an appointment on a day marked CLOSED in the schedule, or on dates covered by an ACTIVE Broadcast Notice:
     * Politely refuse the slot.
     * Cite the exact reason verbatim: "{broadcast_notice_str}".
     * Propose the nearest open alternative slot.
     * Never confirm a booking during closed hours.

2. **Multilingual Fluency**:
   - Natively converse in English, Hindi (हिंदी), Tamil (தமிழ்), and Hinglish.
   - Match the {client_label}'s language and tone with warm cultural greetings.

3. **Autonomous Appointment Booking (`check_and_book_appointment`)**:
   - Verify: 1) {client_label} Name, 2) Phone Number, 3) Desired Date & Time, 4) Requested Service.
   - Once all 4 details are confirmed, invoke the `check_and_book_appointment` tool.
   - If the tool reports an overlap (slot already taken), politely explain that the slot is booked and propose alternative times. Never claim a failed booking was successful!

4. **Appointment Management (`check_available_slots`, `cancel_booking`, `reschedule_booking`)**:
   - When a user asks about open times, invoke `check_available_slots`.
   - When a user wants to cancel or reschedule, invoke the respective tool.

5. **Human Escalation (`escalate_to_human`)**:
   - If the {client_label} demands a human, expresses anger, requests refunds, mentions acute safety issues, or uses any trigger keyword ({triggers_str}), call `escalate_to_human` immediately!

6. **WhatsApp Conciseness**:
   - Keep messages tidy, clean, using bullet points and relevant emojis.
"""
    return prompt


def _get_groq_client() -> Groq:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set.")
    return Groq(api_key=GROQ_API_KEY)


def build_messages_history(conversation_id: str, current_user_message: str, business_id: str = "default_business") -> List[Dict[str, Any]]:
    system_prompt = generate_dynamic_system_prompt(business_id)
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": system_prompt}
    ]

    recent_db_messages = supabase_client.get_recent_messages(conversation_id, limit=6)
    for m in recent_db_messages:
        s = m.get("sender")
        c = m.get("content")
        if not c:
            continue
        if s == "user":
            messages.append({"role": "user", "content": c})
        elif s == "assistant":
            messages.append({"role": "assistant", "content": c})
        elif s == "operator":
            messages.append({"role": "assistant", "content": f"[Human Staff Coordinator]: {c}"})

    # Ensure the latest user message is at the end if not already in recent history
    if not messages or messages[-1].get("content") != current_user_message:
        messages.append({"role": "user", "content": current_user_message})

    return messages


async def run_agent_workflow(
    conversation_id: str,
    wa_user_id: str,
    user_text: str,
    business_id: str = "default_business"
) -> Dict[str, Any]:
    """
    Executes autonomous multi-industry Groq AI reasoning turn with truthfulness guarantees.
    """
    conv = supabase_client.get_conversation(conversation_id)
    if not conv:
        conv = supabase_client.get_or_create_conversation(wa_user_id, business_id=business_id)

    if not conv.get("is_ai_active", True):
        logger.info("AI is paused for conv %s. Skipping autonomous generation.", conversation_id)
        return {
            "reply_text": None,
            "tool_calls_executed": [],
            "model_used": None,
            "is_ai_active": False
        }

    # Fast-path keyword trigger check for escalation
    config = supabase_client.get_universal_business(business_id)
    escalation_triggers = config.get("escalation_rules") or ["emergency", "refund", "complaint", "human", "manager"]
    lower_user = user_text.lower()
    if any(trigger in lower_user for trigger in escalation_triggers):
        logger.info("Escalation trigger detected in user message: %s", user_text)
        supabase_client.set_ai_status(conversation_id, is_active=False)
        supabase_client.update_conversation_state(conversation_id, "escalated")
        return {
            "reply_text": "🚨 I have notified our management coordinator right away. A human staff member will take over this chat momentarily.",
            "tool_calls_executed": [{"name": "escalate_to_human", "result": {"success": True}}],
            "model_used": "fast_path_escalation",
            "is_ai_active": False
        }

    try:
        client = _get_groq_client()
    except Exception as e:
        logger.error("Groq client initialization error: %s", e)
        return {
            "reply_text": "Thank you for contacting us. Our reception coordinator is reviewing your message and will respond shortly.",
            "tool_calls_executed": [],
            "model_used": None,
            "is_ai_active": True
        }

    messages = build_messages_history(conversation_id, user_text, business_id=business_id)

    response_message = None
    chosen_model = None
    last_error = None

    for model_name in MODEL_CANDIDATES:
        if not model_name:
            continue
        try:
            logger.info("Invoking Groq model '%s' for conv %s...", model_name, conversation_id)
            completion = client.chat.completions.create(
                model=model_name,
                messages=messages,
                tools=AGENT_TOOLS_SPEC,
                tool_choice="auto",
                temperature=0.2,
                max_tokens=600
            )
            response_message = completion.choices[0].message
            chosen_model = model_name
            break
        except Exception as e:
            logger.warning("Groq model '%s' failed: %s. Trying fallback candidate.", model_name, e)
            last_error = e

    if not response_message:
        logger.error("All Groq model candidates failed for conv %s: %s", conversation_id, last_error)
        return {
            "reply_text": "Thank you for messaging us. Our reception desk has received your request and will follow up with you shortly.",
            "tool_calls_executed": [],
            "model_used": None,
            "is_ai_active": True
        }

    tool_calls = response_message.tool_calls
    executed_tools: List[Dict[str, Any]] = []
    final_reply = ""

    if tool_calls:
        assistant_turn = {
            "role": "assistant",
            "content": response_message.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                }
                for tc in tool_calls
            ]
        }
        messages.append(assistant_turn)

        for tc in tool_calls:
            func_name = tc.function.name
            func_args = tc.function.arguments
            logger.info("Agent executing tool '%s' with args: %s", func_name, func_args)
            result = execute_tool_call(func_name, func_args, conversation_id, business_id=business_id)
            executed_tools.append({
                "name": func_name,
                "arguments": func_args,
                "result": result
            })

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": func_name,
                "content": json.dumps(result)
            })

        # Get final response from the model after tool execution
        try:
            second_resp = client.chat.completions.create(
                model=chosen_model,
                messages=messages,
                temperature=0.3,
                max_tokens=600
            )
            final_reply = second_resp.choices[0].message.content or ""
        except Exception as e:
            logger.error("Failed to generate post-tool response: %s", e)
            # Truthful fallback strictly reflecting the actual tool outcome:
            booking_tool = next((t for t in executed_tools if t["name"] in ("check_and_book_appointment", "book_appointment")), None)
            if booking_tool:
                tool_res = booking_tool.get("result", {})
                if tool_res.get("success"):
                    b_info = tool_res.get("booking", {})
                    final_reply = f"✅ Your appointment has been confirmed for *{b_info.get('slot_time')}* for *{b_info.get('service_name', 'your service')}*!"
                elif tool_res.get("overlap"):
                    final_reply = f"I apologize, but that appointment slot is already booked. {tool_res.get('message', 'Please select an alternative open time.')}"
                else:
                    final_reply = f"We could not complete your booking: {tool_res.get('message', 'Please select another time.')}"
            else:
                final_reply = "Thank you. Your request has been noted and our staff coordinator has been alerted."
    else:
        final_reply = response_message.content or ""

    updated_conv = supabase_client.get_conversation(conversation_id)
    is_active = updated_conv.get("is_ai_active", True) if updated_conv else True

    if not is_active and not final_reply:
        final_reply = "🚨 I have alerted our team right away. A human operator is taking over this chat immediately."

    return {
        "reply_text": final_reply.strip(),
        "tool_calls_executed": executed_tools,
        "model_used": chosen_model,
        "is_ai_active": is_active
    }
