import sys
import unittest
import uuid
from pathlib import Path
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app
from app.services import local_db


class TestDeskOSApi(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        local_db.init_local_db()
        cls.client = TestClient(app)

    def test_health_and_root(self):
        """Checks root and health endpoints."""
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")

        root_res = self.client.get("/")
        self.assertEqual(root_res.status_code, 200)
        self.assertEqual(root_res.json()["version"], "2.0.0")

    def test_business_config_crud(self):
        """Tests fetching and updating business configuration."""
        test_biz = f"api_biz_{uuid.uuid4().hex[:8]}"
        res = self.client.get(f"/api/business/config?business_id={test_biz}")
        self.assertEqual(res.status_code, 200)
        cfg = res.json()
        self.assertEqual(cfg["business_id"], test_biz)

        # Update business
        update_payload = {
            "business_name": "Updated Test Spa",
            "industry": "salon",
            "client_label": "Guest",
            "provider_label": "Stylist",
            "tone": "Luxurious and calming"
        }
        put_res = self.client.put(f"/api/business/config?business_id={test_biz}", json=update_payload)
        self.assertEqual(put_res.status_code, 200)
        updated_cfg = put_res.json()["config"]
        self.assertEqual(updated_cfg["business_name"], "Updated Test Spa")
        self.assertEqual(updated_cfg["client_label"], "Guest")

    def test_staff_management_endpoints(self):
        """Tests staff resources CRUD endpoints."""
        test_biz = f"staff_biz_{uuid.uuid4().hex[:8]}"
        
        # Create staff
        create_res = self.client.post(
            f"/api/business/staff?business_id={test_biz}",
            json={"name": "Dr. Elena Rostova", "role": "Senior Consultant", "email": "elena@test.com"}
        )
        self.assertEqual(create_res.status_code, 200)
        staff = create_res.json()["staff"]
        staff_id = staff["id"]

        # List staff
        list_res = self.client.get(f"/api/business/staff?business_id={test_biz}")
        self.assertEqual(list_res.status_code, 200)
        self.assertTrue(any(s["id"] == staff_id for s in list_res.json()))

        # Update staff
        update_res = self.client.put(
            f"/api/business/staff/{staff_id}",
            json={"name": "Dr. Elena Rostova (Director)", "role": "Managing Partner"}
        )
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["staff"]["role"], "Managing Partner")

        # Delete staff
        del_res = self.client.delete(f"/api/business/staff/{staff_id}")
        self.assertEqual(del_res.status_code, 200)

    def test_services_management_endpoints(self):
        """Tests services catalog CRUD endpoints."""
        test_biz = f"srv_biz_{uuid.uuid4().hex[:8]}"

        # Create service
        create_res = self.client.post(
            f"/api/business/services?business_id={test_biz}",
            json={"name": "Express Consultation", "price": 850.0, "duration_minutes": 25, "category": "Consulting"}
        )
        self.assertEqual(create_res.status_code, 200)
        srv = create_res.json()["service"]
        srv_id = srv["id"]

        # List services
        list_res = self.client.get(f"/api/business/services?business_id={test_biz}")
        self.assertEqual(list_res.status_code, 200)
        self.assertTrue(any(s["id"] == srv_id for s in list_res.json()))

        # Delete service
        del_res = self.client.delete(f"/api/business/services/{srv_id}")
        self.assertEqual(del_res.status_code, 200)

    def test_booking_lifecycle_and_conflict_http_409(self):
        """Tests booking creation, conflict HTTP 409 error, cancellation, and rescheduling."""
        test_biz = f"book_biz_{uuid.uuid4().hex[:8]}"
        self.client.post("/api/business/preset", json={"preset": "healthcare", "business_id": test_biz})

        slot = "Tomorrow at 03:00 PM"

        # 1. First booking succeeds
        res1 = self.client.post("/api/bookings", json={
            "client_name": "Alice Wonderland",
            "phone": "+919876543111",
            "slot_time": slot,
            "service": "Dental Consultation & Exam",
            "business_id": test_biz
        })
        self.assertEqual(res1.status_code, 200)
        booking = res1.json()["booking"]
        booking_id = booking["id"]

        # 2. Conflicting booking returns HTTP 409 Conflict
        res2 = self.client.post("/api/bookings", json={
            "client_name": "Bob Builder",
            "phone": "+919876543112",
            "slot_time": slot,
            "service": "Dental Consultation & Exam",
            "business_id": test_biz
        })
        self.assertEqual(res2.status_code, 409)
        self.assertIn("already booked", res2.json()["detail"].lower())

        # 3. Reschedule booking to another time
        new_slot = "Tomorrow at 05:00 PM"
        reschedule_res = self.client.post(f"/api/bookings/{booking_id}/reschedule", json={"new_slot_time": new_slot})
        self.assertEqual(reschedule_res.status_code, 200)
        self.assertEqual(reschedule_res.json()["booking"]["slot_time"], new_slot)

        # 4. Cancel booking
        cancel_res = self.client.post(f"/api/bookings/{booking_id}/cancel", json={"reason": "Customer request"})
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.json()["booking"]["status"], "cancelled")

    def test_webhook_verification(self):
        """Tests Meta WhatsApp webhook GET challenge verification handshake."""
        # Valid verify token
        res = self.client.get(
            "/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=Venkat10%4010&hub.challenge=11559955"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.text, "11559955")

        # Invalid token -> 403 Forbidden
        bad_res = self.client.get(
            "/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=11559955"
        )
        self.assertEqual(bad_res.status_code, 403)


if __name__ == "__main__":
    unittest.main()
