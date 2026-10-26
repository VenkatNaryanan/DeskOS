import os
import logging
from typing import Optional, Dict, Any
import jwt
from fastapi import Request, HTTPException, Security, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services import local_db

logger = logging.getLogger("auth_service")
security = HTTPBearer(auto_error=False)

# Optional Supabase JWT secret from environment
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "").strip('"\' ')
DEV_MODE = os.getenv("DEV_MODE", "true").lower() in ("true", "1", "yes")


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes Supabase JWT token."""
    try:
        if SUPABASE_JWT_SECRET:
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            return payload
        else:
            # Decode unverified in dev when secret is not configured
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(e)}")


def verify_business_membership(user_id: str, business_id: str, required_roles: Optional[list] = None) -> Dict[str, Any]:
    """Verifies that user_id has an active membership role in business_id."""
    conn = local_db.get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT role FROM business_memberships
    WHERE (business_id = ? OR business_id = (SELECT id FROM businesses WHERE slug = ?))
      AND user_id = ?
    """, (business_id, business_id, user_id))
    row = cursor.fetchone()
    conn.close()

    if not row:
        # Check if user is owner of default business in dev mode
        if DEV_MODE:
            return {"user_id": user_id, "business_id": business_id, "role": "owner"}
        raise HTTPException(status_code=403, detail="Access denied: You are not a member of this business.")

    role = row["role"]
    if required_roles and role not in required_roles:
        raise HTTPException(status_code=403, detail=f"Access denied: Role '{role}' lacks required permissions.")

    return {"user_id": user_id, "business_id": business_id, "role": role}


async def get_current_tenant_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    business_id: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """
    FastAPI Dependency:
    1. Extracts Bearer token from Authorization header.
    2. Validates identity.
    3. Verifies membership in target business_id.
    """
    bid = business_id or request.headers.get("X-Business-Id") or "default-business"

    if credentials and credentials.credentials:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub") or payload.get("id") or "authenticated_user"
        membership = verify_business_membership(user_id, bid)
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "business_id": bid,
            "role": membership.get("role", "staff")
        }

    # Dev mode fallback when no Bearer header is supplied
    if DEV_MODE:
        return {
            "user_id": "00000000-0000-0000-0000-000000000000",
            "email": "dev@deskos.local",
            "business_id": bid,
            "role": "owner"
        }

    raise HTTPException(status_code=401, detail="Authentication credentials required.")
