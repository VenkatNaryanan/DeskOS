import os
import sys
import unittest
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.services import local_db, scheduler, supabase_client, notifications
from app.agent import tools, core


class TestDeskOSCore(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Initialize schema
        local_db.init_local_db()

    def test_timezone_and_natural_slot_parsing(self):
        """Validates natural language date and time parsing in business IANA timezone."""
        bus_tz = scheduler.get_business_timezone("Asia/Kolkata")
        start_dt, end_dt = scheduler.parse_natural_slot_time("Tomorrow at 10:30 AM", bus_tz, default_duration_minutes=45)
        
        self.assertIsNotNone(start_dt.tzinfo)
        self.assertEqual(start_dt.hour, 10)
        self.assertEqual(start_dt.minute, 30)
        self.assertEqual(end_dt - start_dt, timedelta(minutes=45))

        # Test ISO parse
        iso_str = "2026-11-01T15:00:00"
        s_dt, e_dt = scheduler.parse_natural_slot_time(iso_str, bus_tz, default_duration_minutes=30)
        self.assertEqual(s_dt.hour, 15)
        self.assertEqual(s_dt.minute, 0)
        self.assertEqual(e_dt - s_dt, timedelta(minutes=30))

    def test_operating_hours_validation(self):
        """Validates that slots outside business hours or on closed days are rejected."""
        bus_tz = scheduler.get_business_timezone("Asia/Kolkata")
        hours = {
            "monday": {"is_closed": False, "open": "09:00", "close": "20:00"},
            "sunday": {"is_closed": True, "open": "10:00", "close": "14:00"}
        }

        # Monday 11:00 AM (Valid)
        # Find next Monday
        now = datetime.now(bus_tz)
        days_ahead = (0 - now.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        mon_dt = (now + timedelta(days=days_ahead)).replace(hour=11, minute=0, second=0, microsecond=0)
        is_open, reason = scheduler.validate_slot_within_operating_hours(mon_dt, hours)
        self.assertTrue(is_open)
        self.assertIsNone(reason)

        # Sunday (Closed)
        days_to_sun = (6 - now.weekday()) % 7
        if days_to_sun == 0:
            days_to_sun = 7
        sun_dt = (now + timedelta(days=days_to_sun)).replace(hour=11, minute=0, second=0, microsecond=0)
        is_open_sun, sun_reason = scheduler.validate_slot_within_operating_hours(sun_dt, hours)
        self.assertFalse(is_open_sun)
        self.assertIn("closed", sun_reason.lower())

        # Monday 05:00 AM (Outside operating hours)
        early_mon = mon_dt.replace(hour=5, minute=0)
        is_open_early, early_reason = scheduler.validate_slot_within_operating_hours(early_mon, hours)
        self.assertFalse(is_open_early)
        self.assertIn("outside operating hours", early_reason.lower())

    def test_booking_conflict_prevention_and_cancellation(self):
        """Validates that overlapping bookings are blocked, and cancellation releases the slot."""
        test_biz = f"test_biz_{uuid.uuid4().hex[:8]}"
        supabase_client.apply_industry_preset("healthcare", business_id=test_biz)

        slot = "Tomorrow at 11:00 AM"

        # 1. First booking succeeds
        b1 = supabase_client.create_universal_booking(
            client_name="Test Patient One",
            phone="+919876543001",
            slot_time=slot,
            service="Dental Consultation & Exam",
            business_id=test_biz
        )
        self.assertIsNotNone(b1.get("id"))
        self.assertEqual(b1.get("status"), "confirmed")

        # 2. Second overlapping booking for same business & pooled resource FAILS with ValueError
        with self.assertRaises(ValueError) as ctx:
            supabase_client.create_universal_booking(
                client_name="Test Patient Two",
                phone="+919876543002",
                slot_time=slot,
                service="Dental Consultation & Exam",
                business_id=test_biz
            )
        self.assertIn("already booked", str(ctx.exception).lower())

        # 3. Cancel the first booking
        cancelled = supabase_client.cancel_booking(b1["id"], reason="Patient reschedule")
        self.assertEqual(cancelled["status"], "cancelled")

        # 4. Now the second booking on the released slot SUCCEEDS
        b2 = supabase_client.create_universal_booking(
            client_name="Test Patient Two",
            phone="+919876543002",
            slot_time=slot,
            service="Dental Consultation & Exam",
            business_id=test_biz
        )
        self.assertIsNotNone(b2.get("id"))
        self.assertEqual(b2.get("status"), "confirmed")

    def test_multi_staff_concurrent_bookings(self):
        """Validates that independent staff members CAN book overlapping times simultaneously."""
        test_biz = f"test_staff_biz_{uuid.uuid4().hex[:8]}"
        supabase_client.apply_industry_preset("salon", business_id=test_biz)

        # Create two distinct staff members
        s1 = supabase_client.create_staff(test_biz, {"name": "Stylist Alice", "role": "Senior Stylist"})
        s2 = supabase_client.create_staff(test_biz, {"name": "Stylist Bob", "role": "Master Colorist"})

        slot = "Tomorrow at 02:00 PM"

        # Book Stylist Alice at 2:00 PM
        b1 = supabase_client.create_universal_booking(
            client_name="Client A",
            phone="+919876543011",
            slot_time=slot,
            service="Signature Haircut & Styling",
            provider_name="Stylist Alice",
            business_id=test_biz
        )
        self.assertEqual(b1["status"], "confirmed")

        # Book Stylist Bob at the EXACT SAME TIME (2:00 PM) -> Should SUCCEED!
        b2 = supabase_client.create_universal_booking(
            client_name="Client B",
            phone="+919876543012",
            slot_time=slot,
            service="Signature Haircut & Styling",
            provider_name="Stylist Bob",
            business_id=test_biz
        )
        self.assertEqual(b2["status"], "confirmed")

        # Attempt to double-book Stylist Alice at 2:00 PM -> Should FAIL!
        with self.assertRaises(ValueError):
            supabase_client.create_universal_booking(
                client_name="Client C",
                phone="+919876543013",
                slot_time=slot,
                service="Signature Haircut & Styling",
                provider_name="Stylist Alice",
                business_id=test_biz
            )

    def test_safe_industry_preset_application(self):
        """Validates that applying a preset with preserve_custom=True does not wipe custom services."""
        test_biz = f"test_safe_{uuid.uuid4().hex[:8]}"
        supabase_client.apply_industry_preset("healthcare", business_id=test_biz)

        # Add a custom service
        custom_srv = supabase_client.create_service(test_biz, {
            "name": "Custom VIP Laser Treatment",
            "price": 12500.0,
            "duration_minutes": 60,
            "category": "VIP"
        })

        # Apply salon preset safely (preserve_custom=True)
        updated = supabase_client.apply_industry_preset_safe("salon", business_id=test_biz, preserve_custom=True)
        self.assertEqual(updated["industry"], "salon")
        self.assertEqual(updated["client_label"], "Guest")

        # Verify that custom service still exists!
        services = supabase_client.list_services(test_biz)
        srv_names = [s["name"] for s in services]
        self.assertIn("Custom VIP Laser Treatment", srv_names)

    def test_truthful_analytics_zero_fabrication(self):
        """Validates that analytics returns true metrics and empty service array when bookings are 0."""
        empty_biz = f"empty_biz_{uuid.uuid4().hex[:8]}"
        supabase_client.apply_industry_preset("custom", business_id=empty_biz)

        analytics = supabase_client.calculate_analytics(business_id=empty_biz)
        self.assertEqual(analytics["total_leads"], 0)
        self.assertEqual(analytics["booked_count"], 0)
        self.assertEqual(analytics["conversion_rate"], 0.0)
        self.assertEqual(analytics["top_services"], [])

    def test_ai_tool_truthfulness_on_booking_failure(self):
        """Validates that AI tool execution does not report success when a booking fails."""
        test_biz = f"ai_tool_biz_{uuid.uuid4().hex[:8]}"
        supabase_client.apply_industry_preset("healthcare", business_id=test_biz)

        conv = supabase_client.get_or_create_conversation("919999999999", business_id=test_biz)
        slot = "Tomorrow at 10:00 AM"

        # First booking succeeds
        res1 = tools.execute_check_and_book_appointment(
            client_name="First Patient",
            phone="919999999999",
            slot_time=slot,
            service="Dental Consultation & Exam",
            conversation_id=conv["id"],
            business_id=test_biz
        )
        self.assertTrue(res1["success"])

        # Second conflicting booking attempt returns success: False
        res2 = tools.execute_check_and_book_appointment(
            client_name="Second Patient",
            phone="919888888888",
            slot_time=slot,
            service="Dental Consultation & Exam",
            conversation_id=conv["id"],
            business_id=test_biz
        )
        self.assertFalse(res2["success"])
        self.assertTrue(res2["overlap"])
        self.assertIn("already booked", res2["message"].lower())


if __name__ == "__main__":
    unittest.main()
