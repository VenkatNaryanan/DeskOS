import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, Depends
from app.services import supabase_client
from app.services.auth import get_current_tenant_user

logger = logging.getLogger("business_api")
router = APIRouter(prefix="/api/business", tags=["business_portal"])


class BroadcastNoticeModel(BaseModel):
    is_active: bool = False
    notice_text: str = ""
    effective_dates: str = ""


class DayHoursModel(BaseModel):
    is_closed: bool = False
    open: str = "09:00"
    close: str = "20:00"


class OperatingHoursModel(BaseModel):
    monday: DayHoursModel = Field(default_factory=DayHoursModel)
    tuesday: DayHoursModel = Field(default_factory=DayHoursModel)
    wednesday: DayHoursModel = Field(default_factory=DayHoursModel)
    thursday: DayHoursModel = Field(default_factory=DayHoursModel)
    friday: DayHoursModel = Field(default_factory=DayHoursModel)
    saturday: DayHoursModel = Field(default_factory=lambda: DayHoursModel(open="10:00", close="18:00"))
    sunday: DayHoursModel = Field(default_factory=lambda: DayHoursModel(is_closed=True, open="10:00", close="14:00"))


class ServiceItemModel(BaseModel):
    id: Optional[str] = None
    name: str
    price: float
    duration: Optional[str] = "30 mins"
    duration_minutes: Optional[int] = 30
    category: str = "General"
    description: Optional[str] = ""


class FaqItemModel(BaseModel):
    id: Optional[str] = None
    question: str
    answer: str
    category: Optional[str] = "General"


class StaffResourceModel(BaseModel):
    id: Optional[str] = None
    name: str
    role: Optional[str] = "Specialist"
    email: Optional[str] = None
    phone: Optional[str] = None


class BusinessConfigUpdateModel(BaseModel):
    business_name: Optional[str] = None
    industry: Optional[str] = None
    client_label: Optional[str] = None
    provider_label: Optional[str] = None
    tone: Optional[str] = None
    currency: Optional[str] = None
    broadcast_notice: Optional[BroadcastNoticeModel] = None
    emergency_notice: Optional[BroadcastNoticeModel] = None
    operating_hours: Optional[OperatingHoursModel] = None
    services: Optional[List[ServiceItemModel]] = None
    faqs: Optional[List[FaqItemModel]] = None
    escalation_rules: Optional[List[str]] = None


class ApplyPresetRequest(BaseModel):
    preset: str = Field(..., description="Preset key: healthcare, salon, legal, auto, custom")
    business_id: Optional[str] = "default_business"
    preserve_custom: Optional[bool] = True


# ==============================================================================
# Business Config Endpoints
# ==============================================================================

@router.get("/config")
async def get_business_config(
    business_id: str = Query("default_business")
):
    """Returns current business configuration."""
    return supabase_client.get_universal_business(business_id)


@router.put("/config")
async def update_business_config(
    body: BusinessConfigUpdateModel,
    business_id: str = Query("default_business"),
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Updates multi-industry business configuration with tenant verification."""
    update_dict: Dict[str, Any] = {}
    if body.business_name is not None:
        update_dict["business_name"] = body.business_name
    if body.industry is not None:
        update_dict["industry"] = body.industry
    if body.client_label is not None:
        update_dict["client_label"] = body.client_label
    if body.provider_label is not None:
        update_dict["provider_label"] = body.provider_label
    if body.tone is not None:
        update_dict["tone"] = body.tone
    if body.currency is not None:
        update_dict["currency"] = body.currency

    notice = body.broadcast_notice or body.emergency_notice
    if notice is not None:
        update_dict["broadcast_notice"] = notice.model_dump()
        update_dict["emergency_notice"] = notice.model_dump()

    if body.operating_hours is not None:
        update_dict["operating_hours"] = body.operating_hours.model_dump()
    if body.services is not None:
        update_dict["services"] = [s.model_dump() for s in body.services]
    if body.faqs is not None:
        update_dict["faqs"] = [f.model_dump() for f in body.faqs]
    if body.escalation_rules is not None:
        update_dict["escalation_rules"] = body.escalation_rules

    updated = supabase_client.update_universal_business(update_dict, business_id)
    return {
        "status": "success",
        "message": "Business configuration updated successfully",
        "config": updated
    }


@router.post("/preset")
async def apply_preset(
    body: ApplyPresetRequest,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """
    Applies industry template. By default preserve_custom=True prevents overwriting custom services and hours.
    """
    try:
        updated = supabase_client.apply_industry_preset_safe(
            body.preset,
            body.business_id or "default_business",
            preserve_custom=body.preserve_custom is not False
        )
        return {
            "status": "success",
            "message": f"Applied {body.preset.upper()} industry preset successfully",
            "config": updated
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/analytics")
async def get_business_analytics(business_id: str = Query("default_business")):
    """Returns true persisted business analytics with non-fabricated metrics."""
    return supabase_client.calculate_analytics(business_id)


# ==============================================================================
# Staff Resources Endpoints
# ==============================================================================

@router.get("/staff")
async def get_staff(business_id: str = Query("default_business")):
    """Returns active staff resources for the business."""
    return supabase_client.list_staff(business_id)


@router.post("/staff")
async def create_staff(
    body: StaffResourceModel,
    business_id: str = Query("default_business"),
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Creates a new staff member."""
    created = supabase_client.create_staff(business_id, body.model_dump())
    return {"status": "success", "staff": created}


@router.put("/staff/{staff_id}")
async def update_staff(
    staff_id: str,
    body: StaffResourceModel,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Updates staff details."""
    updated = supabase_client.update_staff(staff_id, body.model_dump())
    return {"status": "success", "staff": updated}


@router.delete("/staff/{staff_id}")
async def delete_staff(
    staff_id: str,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Deletes staff member."""
    supabase_client.delete_staff(staff_id)
    return {"status": "success", "message": "Staff member removed"}


# ==============================================================================
# Services Management Endpoints
# ==============================================================================

@router.get("/services")
async def get_services(business_id: str = Query("default_business")):
    """Returns catalog of services for the business."""
    return supabase_client.list_services(business_id)


@router.post("/services")
async def create_service(
    body: ServiceItemModel,
    business_id: str = Query("default_business"),
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Creates a new service in the catalog."""
    created = supabase_client.create_service(business_id, body.model_dump())
    return {"status": "success", "service": created}


@router.put("/services/{service_id}")
async def update_service(
    service_id: str,
    body: ServiceItemModel,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Updates existing service details."""
    updated = supabase_client.update_service(service_id, body.model_dump())
    return {"status": "success", "service": updated}


@router.delete("/services/{service_id}")
async def delete_service(
    service_id: str,
    user: Dict[str, Any] = Depends(get_current_tenant_user)
):
    """Deactivates a service."""
    supabase_client.delete_service(service_id)
    return {"status": "success", "message": "Service deactivated"}
