import io
import logging
from groq import Groq
from app.config import GROQ_API_KEY

logger = logging.getLogger("audio_service")

# Initialize Groq client
_groq_client = None
if GROQ_API_KEY:
    try:
        _groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception as e:
        logger.error("Failed to initialize Groq client for audio: %s", e)


def transcribe_audio_buffer(audio_bytes: bytes, filename: str = "voice_note.ogg") -> str:
    """
    Passes binary buffer to Groq's whisper-large-v3 API endpoint to get instant text transcription.
    Returns the transcribed text string.
    """
    if not audio_bytes:
        return ""

    if not _groq_client:
        raise ValueError("Groq client not initialized. Please verify GROQ_API_KEY.")

    try:
        # Groq SDK accepts tuple: (filename, bytes, content_type)
        file_tuple = (filename, audio_bytes, "audio/ogg")
        logger.info("Sending %d bytes of audio to Groq Whisper...", len(audio_bytes))

        transcription = _groq_client.audio.transcriptions.create(
            file=file_tuple,
            model="whisper-large-v3",
            response_format="json"
        )
        result_text = transcription.text.strip()
        logger.info("Transcription completed: %s", result_text)
        return result_text
    except Exception as e:
        logger.warning("whisper-large-v3 failed: %s. Retrying with whisper-large-v3-turbo...", e)
        try:
            file_tuple = (filename, audio_bytes, "audio/ogg")
            transcription = _groq_client.audio.transcriptions.create(
                file=file_tuple,
                model="whisper-large-v3-turbo",
                response_format="json"
            )
            result_text = transcription.text.strip()
            logger.info("Transcription (turbo) completed: %s", result_text)
            return result_text
        except Exception as e2:
            logger.error("Groq Whisper transcription completely failed: %s", e2)
            raise RuntimeError(f"Audio transcription failed: {e2}")
