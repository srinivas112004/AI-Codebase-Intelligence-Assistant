import logging
from abc import ABC, abstractmethod
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

class LLMConfigurationError(Exception):
    """Raised when the LLM service is called without required credentials."""
    pass

class LLMGenerationError(Exception):
    """Raised when an error occurs during text generation."""
    pass

class LLMService(ABC):
    """
    Abstract Base Class for Large Language Model providers.
    Enforces a common interface for text generation with optional system instructions.
    """

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2
    ) -> str:
        """
        Generate a text response for the given prompt.
        
        Args:
            prompt: User or grounded RAG prompt text.
            system_instruction: Optional system instruction for grounding and behavior.
            temperature: Sampling temperature (lower = more deterministic/grounded).
        
        Returns:
            The generated string response.
        """
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Check whether the service has valid credentials configured."""
        pass


class GeminiService(LLMService):
    """
    Google Gemini implementation using the official google-genai SDK.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model_name = model_name or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        self._client = None

    def is_configured(self) -> bool:
        """Returns True if a non-placeholder API key is set."""
        key = (self.api_key or "").strip()
        placeholder_indicators = ["your_gemini_api_key_here", "dummy", "placeholder", "xxx"]
        return bool(key and key.lower() not in placeholder_indicators)

    def _get_client(self):
        """Lazy client initializer."""
        if not self.is_configured():
            raise LLMConfigurationError(
                "Google Gemini API key is not configured. "
                "Please set GEMINI_API_KEY in your .env file or environment variables."
            )
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2
    ) -> str:
        """
        Generate grounded content via Gemini generate_content API.
        """
        client = self._get_client()
        from google.genai import types

        try:
            config = types.GenerateContentConfig(
                temperature=temperature,
                system_instruction=system_instruction if system_instruction else None,
            )

            logger.info(f"Querying Gemini model '{self.model_name}' (temperature={temperature})...")
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config,
            )

            if not response or not response.text:
                logger.warning("Gemini returned an empty response.")
                return ""

            return response.text.strip()

        except Exception as e:
            error_str = str(e)
            logger.error(f"Gemini API generation error: {error_str}", exc_info=True)
            raise LLMGenerationError(f"Gemini generation failed: {error_str}") from e


class MockLLMService(LLMService):
    """
    Mock LLM service for testing, offline demos, and CI/CD validation.
    Generates deterministic grounded answers without external network calls.
    """

    def __init__(self, canned_response: Optional[str] = None):
        self.canned_response = canned_response
        self.last_prompt: Optional[str] = None
        self.last_system_instruction: Optional[str] = None

    def is_configured(self) -> bool:
        return True

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2
    ) -> str:
        self.last_prompt = prompt
        self.last_system_instruction = system_instruction

        if self.canned_response:
            return self.canned_response

        # Fallback pseudo-grounded answer for offline testing
        return (
            "Based on the provided codebase context, the relevant logic is implemented "
            "in the retrieved source files. See the cited references for exact line definitions."
        )


# Global singleton instance
_llm_service_instance: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    """Dependency getter returning the active LLMService singleton."""
    global _llm_service_instance
    if _llm_service_instance is None:
        _llm_service_instance = GeminiService()
    return _llm_service_instance

def set_llm_service(service: LLMService) -> None:
    """Override the active LLM service instance (e.g., during tests)."""
    global _llm_service_instance
    _llm_service_instance = service
