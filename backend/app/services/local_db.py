import os
import sqlite3
import json
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

logger = logging.getLogger("local_db")

DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "deskos.db"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_local_db():
    """Initializes local SQLite schema matching DeskOS canonical relational schema."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        industry TEXT NOT NULL DEFAULT 'general',
        timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        currency TEXT NOT NULL DEFAULT '₹',
        client_label TEXT NOT NULL DEFAULT 'Client',
        provider_label TEXT NOT NULL DEFAULT 'Specialist',
        tone TEXT NOT NULL DEFAULT 'Friendly, efficient, and professional',
        whatsapp_phone_number_id TEXT UNIQUE,
        whatsapp_display_number TEXT,
        broadcast_notice TEXT DEFAULT '{"is_active": false, "notice_text": "", "effective_dates": ""}',
        operating_hours TEXT DEFAULT '{"monday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "tuesday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "wednesday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "thursday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "friday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "saturday": {"is_closed": false, "open": "10:00", "close": "18:00"}, "sunday": {"is_closed": true, "open": "10:00", "close": "14:00"}}',
        escalation_rules TEXT DEFAULT '["human", "manager", "complaint", "refund", "emergency", "urgent"]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS business_memberships (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
        created_at TEXT NOT NULL,
        UNIQUE(business_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS staff_resources (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT,
        email TEXT,
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        working_hours TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL CHECK (price >= 0),
        duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
        buffer_minutes INTEGER NOT NULL DEFAULT 0,
        category TEXT DEFAULT 'General',
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faqs (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        display_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        phone TEXT NOT NULL,
        name TEXT,
        email TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(business_id, phone)
    );

    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        wa_user_id TEXT NOT NULL,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        current_state TEXT DEFAULT 'initial',
        is_ai_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(business_id, wa_user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'operator', 'system')),
        content TEXT NOT NULL,
        meta_message_id TEXT UNIQUE,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        client_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        service_id TEXT REFERENCES services(id) ON DELETE RESTRICT,
        service_name TEXT NOT NULL,
        staff_id TEXT REFERENCES staff_resources(id) ON DELETE SET NULL,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        slot_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('hold', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show')),
        hold_expires_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS message_jobs (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
        recipient_phone TEXT NOT NULL,
        job_type TEXT NOT NULL CHECK (job_type IN ('booking_confirmation', 'reminder_24h', 'reminder_2h', 'cancellation_notice', 'custom')),
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        last_attempt_at TEXT,
        error_message TEXT,
        payload TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        entity_id TEXT,
        properties TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
    );
    """)

    # Check if default business exists
    cursor.execute("SELECT id FROM businesses WHERE slug = 'default-business' OR slug = 'default_business'")
    row = cursor.fetchone()
    if not row:
        now = _now_iso()
        bus_id = "00000000-0000-0000-0000-000000000001"
        cursor.execute("""
        INSERT INTO businesses (
            id, slug, name, industry, timezone, currency, client_label, provider_label, tone,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            bus_id,
            "default-business",
            "Apex Healthcare & Dental Clinic",
            "healthcare",
            "Asia/Kolkata",
            "₹",
            "Patient",
            "Doctor",
            "Empathetic, clinical, reassuring, precise",
            now,
            now
        ))

        # Seed default services
        default_services = [
            ("Dental Consultation & Exam", "Comprehensive oral inspection and treatment planning", 500.0, 30, "General"),
            ("Teeth Cleaning & Scaling", "Ultrasonic tartar removal and polish", 1500.0, 45, "Preventive"),
            ("Root Canal Treatment (RCT)", "Complete single or multi-session root canal therapy", 4500.0, 60, "Endodontics"),
            ("Teeth Whitening", "Professional LED laser whitening session", 6000.0, 45, "Cosmetic"),
            ("Dental Crown / Cap", "Custom ceramic zirconium tooth crown fitment", 3500.0, 45, "Prosthodontics")
        ]
        for name, desc, price, dur, cat in default_services:
            cursor.execute("""
            INSERT INTO services (id, business_id, name, description, price, duration_minutes, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), bus_id, name, desc, price, dur, cat, now, now))

        # Seed default staff
        default_staff = [
            ("Dr. Sarah Khan", "Senior Endodontist", "sarah.khan@apexclinic.com", "+919876543201"),
            ("Dr. Arjun Patel", "Cosmetic Dental Surgeon", "arjun.patel@apexclinic.com", "+919876543202")
        ]
        for name, role, email, phone in default_staff:
            cursor.execute("""
            INSERT INTO staff_resources (id, business_id, name, role, email, phone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), bus_id, name, role, email, phone, now, now))

        # Seed default FAQs
        default_faqs = [
            ("Where is Apex Dental Clinic located?", "We are situated at 12th Floor, Green Tower, MG Road, Bengaluru, Karnataka.", "Location", 1),
            ("What payment modes do you accept?", "We accept UPI (Google Pay, PhonePe, Paytm), Visa/Mastercard credit/debit cards, and cash.", "Billing", 2),
            ("What should I do in case of acute toothache emergency?", "Please call our emergency helpline at +91 98765 43210 or visit our urgent-care room during open hours.", "Emergency", 3)
        ]
        for q, a, cat, order in default_faqs:
            cursor.execute("""
            INSERT INTO faqs (id, business_id, question, answer, category, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), bus_id, q, a, cat, order, now, now))

    conn.commit()
    conn.close()
    logger.info("Local SQLite persistent engine initialized at %s", DB_PATH)


# Initialize schema on module import
init_local_db()
