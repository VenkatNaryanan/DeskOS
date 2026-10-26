import logging
from typing import Dict, Any, Optional
import httpx
from app.config import META_ACCESS_TOKEN, META_PHONE_NUMBER_ID

logger = logging.getLogger("meta_service")

GRAPH_API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


async def send_whatsapp_message(to_number: str, text: str) -> Dict[str, Any]:
    """
    Sends an outbound WhatsApp text message via Meta Graph API v21.0.
    """
    if not META_ACCESS_TOKEN or not META_PHONE_NUMBER_ID:
        logger.warning("Meta credentials missing. Skipping WhatsApp outbound dispatch.")
        return {"status": "skipped", "reason": "missing_credentials"}

    clean_phone = "".join(filter(str.isdigit, to_number))
    url = f"{BASE_URL}/{META_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_phone,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": text
        }
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                logger.info("Successfully sent WhatsApp message to %s", clean_phone)
                return resp.json()
            else:
                logger.error(
                    "Meta API error (%s) when sending to %s: %s",
                    resp.status_code, clean_phone, resp.text
                )
                return {
                    "status": "error",
                    "status_code": resp.status_code,
                    "error": resp.text
                }
        except Exception as e:
            logger.error("Exception sending WhatsApp message to %s: %s", clean_phone, e)
            return {"status": "exception", "error": str(e)}


async def download_whatsapp_media(media_id: str) -> bytes:
    """
    Exchanges media_id for download URL and streams binary content.
    Returns binary bytes.
    """
    if not META_ACCESS_TOKEN:
        raise ValueError("META_ACCESS_TOKEN is required to download WhatsApp media")

    media_url_endpoint = f"{BASE_URL}/{media_id}"
    auth_header = {"Authorization": f"Bearer {META_ACCESS_TOKEN}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Exchange media_id for media URL
        meta_resp = await client.get(media_url_endpoint, headers=auth_header)
        if meta_resp.status_code != 200:
            raise RuntimeError(
                f"Failed to fetch media metadata for {media_id}: status={meta_resp.status_code}, response={meta_resp.text}"
            )
        
        media_info = meta_resp.json()
        direct_url = media_info.get("url")
        if not direct_url:
            raise RuntimeError(f"No direct URL returned for media_id {media_id}")

        # Step 2: Stream binary content
        # Meta media downloads also require the Bearer token header
        download_resp = await client.get(direct_url, headers=auth_header)
        if download_resp.status_code != 200:
            raise RuntimeError(
                f"Failed to stream media binary from {direct_url}: status={download_resp.status_code}"
            )

        logger.info("Successfully downloaded WhatsApp media %s (%d bytes)", media_id, len(download_resp.content))
        return download_resp.content
