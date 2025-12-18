import base64
import json
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

import httpx

from ..core.config import GLMConfig
from ..core.exceptions import VisionAPIError
from ..core.types import (
    Coordinates,
    DetectedField,
    DetectionSensitivity,
    FieldHierarchy,
    FieldType,
    RetryParameters,
    ValidationStatus,
)
from .base import VisionProvider


class GLMVisionProvider(VisionProvider):
    """
    GLM4.6v vision model provider implementation.

    Handles communication with the GLM4.6v API for field detection
    and coordinate validation operations.
    """

    def __init__(self, config: GLMConfig):
        """
        Initialize GLM vision provider.

        Args:
            config: GLMConfig
                Configuration for GLM4.6v API access.
        """
        self._config = config
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """
        Get or create async HTTP client.

        Returns:
            httpx.AsyncClient
                Configured HTTP client for API calls.
        """
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self._config.timeout_seconds),
                headers={
                    "x-api-key": self._config.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    async def close(self):
        """
        Close the HTTP client connection.
        """
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _build_detection_prompt(self, parameters: RetryParameters) -> str:
        """
        Build the field detection prompt based on parameters.

        Args:
            parameters: RetryParameters
                Detection parameters for prompt customization.

        Returns:
            str
                Formatted detection prompt.
        """
        sensitivity_instructions = {
            DetectionSensitivity.NORMAL: "Detect clearly visible form fields.",
            DetectionSensitivity.HIGH: "Detect all form fields including subtle ones.",
            DetectionSensitivity.VERY_HIGH: "Detect all possible form fields, including faint or partially visible ones.",
            DetectionSensitivity.MAXIMUM: "Detect every possible form field region, even if uncertain.",
        }

        base_prompt = f"""Analyze this PDF page image and identify ALL form fields.

Detection Sensitivity: {sensitivity_instructions[parameters.detection_sensitivity]}
Minimum Confidence: {parameters.confidence_threshold}

For EACH field detected, provide a JSON object with:
- field_type: one of "text-input", "signature", "date", "checkbox"
- coordinates: object with x, y, width, height (in pixels from top-left)
- field_label: the label text near the field (if visible)
- section: the section name this field belongs to
- subsection: the subsection name (if applicable)
- entry: the entry identifier for repeating groups (if applicable)
- confidence: your confidence score between 0.0 and 1.0

Return ONLY a JSON array of field objects. No other text."""

        return base_prompt

    def _build_validation_prompt(
        self, field: DetectedField, parameters: RetryParameters
    ) -> str:
        """
        Build the coordinate validation prompt.

        Args:
            field: DetectedField
                Field to validate.
            parameters: RetryParameters
                Validation parameters.

        Returns:
            str
                Formatted validation prompt.
        """
        return f"""Verify the coordinates of a form field on this page.

Expected field location:
- Type: {field.field_type.value}
- X: {field.coordinates.x}
- Y: {field.coordinates.y}
- Width: {field.coordinates.width}
- Height: {field.coordinates.height}

Measure the ACTUAL boundaries of this field and report:
1. The measured coordinates (x, y, width, height in pixels)
2. Whether the field exists at approximately this location

Return ONLY a JSON object with:
- exists: boolean
- measured_x: number
- measured_y: number
- measured_width: number
- measured_height: number
- confidence: number between 0.0 and 1.0"""

    async def _call_api(
        self, image_data: bytes, prompt: str
    ) -> Dict[str, Any]:
        """
        Make API call to GLM4.6v using Anthropic-compatible endpoint.

        Args:
            image_data: bytes
                Image data to analyze.
            prompt: str
                Text prompt for the model.

        Returns:
            Dict[str, Any]
                Parsed API response.

        Raises:
            VisionAPIError
                If API call fails.
        """
        client = await self._get_client()

        image_base64 = base64.b64encode(image_data).decode("utf-8")

        payload = {
            "model": self._config.model,
            "max_tokens": self._config.max_tokens,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        }

        endpoint = f"{self._config.api_endpoint}/v1/messages"

        try:
            response = await client.post(endpoint, json=payload)

            if response.status_code != 200:
                raise VisionAPIError(
                    endpoint=endpoint,
                    status_code=response.status_code,
                    message=response.text,
                )

            return response.json()

        except httpx.TimeoutException:
            raise VisionAPIError(
                endpoint=endpoint,
                status_code=408,
                message="Request timed out",
            )
        except httpx.RequestError as e:
            raise VisionAPIError(
                endpoint=endpoint,
                status_code=0,
                message=str(e),
            )

    def _parse_detection_response(
        self, response: Dict[str, Any], page_number: int
    ) -> List[DetectedField]:
        """
        Parse API response into detected fields.

        Args:
            response: Dict[str, Any]
                Raw API response.
            page_number: int
                Page number for field assignment.

        Returns:
            List[DetectedField]
                Parsed field objects.
        """
        fields = []

        try:
            content = response["content"][0]["text"]

            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if not json_match:
                return fields

            field_data = json.loads(json_match.group())

            for item in field_data:
                field_type_map = {
                    "text-input": FieldType.TEXT_INPUT,
                    "signature": FieldType.SIGNATURE,
                    "date": FieldType.DATE,
                    "checkbox": FieldType.CHECKBOX,
                }

                field_type_str = item.get("field_type", "text-input")
                field_type = field_type_map.get(field_type_str, FieldType.TEXT_INPUT)

                coords = item.get("coordinates", {})
                coordinates = Coordinates(
                    x=float(coords.get("x", 0)),
                    y=float(coords.get("y", 0)),
                    width=float(coords.get("width", 0)),
                    height=float(coords.get("height", 0)),
                )

                hierarchy = FieldHierarchy(
                    section=item.get("section", "Unknown"),
                    subsection=item.get("subsection"),
                    entry=item.get("entry"),
                    field_label=item.get("field_label"),
                )

                field = DetectedField(
                    field_id=f"field_{uuid.uuid4().hex[:8]}",
                    field_type=field_type,
                    coordinates=coordinates,
                    hierarchy=hierarchy,
                    page_number=page_number,
                    confidence_score=float(item.get("confidence", 0.0)),
                    validation_status=ValidationStatus.PENDING,
                )

                fields.append(field)

        except (KeyError, json.JSONDecodeError, ValueError):
            pass

        return fields

    def _parse_validation_response(
        self, response: Dict[str, Any]
    ) -> Tuple[bool, Coordinates, float]:
        """
        Parse validation API response.

        Args:
            response: Dict[str, Any]
                Raw API response.

        Returns:
            Tuple[bool, Coordinates, float]
                Tuple of (exists, measured_coordinates, confidence).
        """
        try:
            content = response["content"][0]["text"]

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if not json_match:
                return False, Coordinates(0, 0, 0, 0), 0.0

            data = json.loads(json_match.group())

            exists = data.get("exists", False)
            measured = Coordinates(
                x=float(data.get("measured_x", 0)),
                y=float(data.get("measured_y", 0)),
                width=float(data.get("measured_width", 0)),
                height=float(data.get("measured_height", 0)),
            )
            confidence = float(data.get("confidence", 0.0))

            return exists, measured, confidence

        except (KeyError, json.JSONDecodeError, ValueError):
            return False, Coordinates(0, 0, 0, 0), 0.0

    async def detect_fields(
        self,
        image_data: bytes,
        page_number: int,
        parameters: RetryParameters,
    ) -> List[DetectedField]:
        """
        Detect form fields in a page image using GLM4.6v.

        Args:
            image_data: bytes
                Raw image data in PNG or JPEG format.
            page_number: int
                One-indexed page number for field assignment.
            parameters: RetryParameters
                Detection parameters including sensitivity and thresholds.

        Returns:
            List[DetectedField]
                List of detected fields with coordinates and metadata.
        """
        prompt = self._build_detection_prompt(parameters)
        response = await self._call_api(image_data, prompt)
        fields = self._parse_detection_response(response, page_number)

        return [f for f in fields if f.confidence_score >= parameters.confidence_threshold]

    async def validate_coordinates(
        self,
        image_data: bytes,
        field: DetectedField,
        parameters: RetryParameters,
    ) -> Tuple[bool, Coordinates, float]:
        """
        Validate field coordinates by re-measuring with GLM4.6v.

        Args:
            image_data: bytes
                Raw image data in PNG or JPEG format.
            field: DetectedField
                Field to validate with original coordinates.
            parameters: RetryParameters
                Validation parameters including tolerance.

        Returns:
            Tuple[bool, Coordinates, float]
                Tuple of (passed, measured_coordinates, difference).
        """
        prompt = self._build_validation_prompt(field, parameters)
        response = await self._call_api(image_data, prompt)
        exists, measured, confidence = self._parse_validation_response(response)

        if not exists:
            return False, measured, float('inf')

        diff_x = abs(field.coordinates.x - measured.x)
        diff_y = abs(field.coordinates.y - measured.y)
        diff_w = abs(field.coordinates.width - measured.width)
        diff_h = abs(field.coordinates.height - measured.height)

        max_difference = max(diff_x, diff_y, diff_w, diff_h)

        return max_difference <= 0.5, measured, max_difference

    async def health_check(self) -> bool:
        """
        Check if GLM4.6v API is available and responding.

        Returns:
            bool
                True if API is healthy, False otherwise.
        """
        try:
            client = await self._get_client()
            response = await client.get(f"{self._config.api_endpoint}/models")
            return response.status_code == 200
        except Exception:
            return False

    def get_model_version(self) -> str:
        """
        Get the current GLM model version string.

        Returns:
            str
                Model version identifier.
        """
        return self._config.model
