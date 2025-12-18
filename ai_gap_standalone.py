#!/usr/bin/env python3
"""
Standalone AI Gap Filler for Section 13
No dependencies on the interactive-pdf-mapper module
"""

import json
import base64
import asyncio
import httpx
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import os
import sys
import io
from PIL import Image, ImageEnhance

# Add required paths
sys.path.append(os.path.dirname(__file__))

try:
    import fitz  # PyMuPDF
except ImportError as e:
    print(f"Missing required dependencies: {e}")
    print("Please install: pip install pymupdf pillow")
    sys.exit(1)


class SimplePDFRenderer:
    """Simple PDF renderer for AI vision analysis"""

    def __init__(self, pdf_path: str):
        """
        Initialize renderer with PDF document.

        Args:
            pdf_path: str
                Path to PDF file
        """
        self.document = fitz.open(pdf_path)
        self.pdf_path = pdf_path

    def render_page_to_base64(self, page_number: int, dpi: int = 200) -> str:
        """
        Render page to base64 PNG.

        Args:
            page_number: int
                Page number (0-indexed)
            dpi: int
                DPI for rendering

        Returns:
            str
                Base64 encoded image
        """
        page = self.document[page_number]

        # Calculate zoom for target DPI
        zoom = dpi / 72

        # Render page
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, dpi=dpi)

        # Convert to PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Apply contrast enhancement
        if True:  # Always enhance for better AI analysis
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.5)

        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')

    def close(self):
        """Close the PDF document."""
        if self.document:
            self.document.close()


class AIGapFiller:
    """AI Vision Gap Filler for Section 13"""

    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize AI Gap Filler.
        """
        self.config = config or {
            "api_endpoint": "https://api.z.ai/api/anthropic",
            "api_key": "fe59fe5386d54d0d91a39965a81a8020.3qxmmEHbNt4g1igU",
            "model": "glm-4.6v",
            "timeout": 120
        }

    async def process_section_13(self, pdf_path: str, section_13_path: str):
        """
        Process Section 13 with AI vision enhancement.

        Args:
            pdf_path: str
                Path to PDF file
            section_13_path: str
                Path to Section 13 JSON file

        Returns:
            Dict
                Enhanced section data
        """
        print("\n AI Enhancement for Section 13")
        print("=" * 50)

        # Load Section 13 data
        with open(section_13_path, 'r') as f:
            section_data = json.load(f)

        print(f"Original fields: {len(section_data.get('fields', []))}")

        # Open PDF
        renderer = SimplePDFRenderer(pdf_path)

        try:
            # Get pages that might contain Section 13 (based on field page distribution)
            pages_with_fields = self._get_pages_with_fields(section_data)

            enhanced_fields = []
            total_verified = 0
            total_new = 0

            for page_num in pages_with_fields:
                print(f"\n📄 Page {page_num + 1}: Analyzing with AI vision...")

                try:
                    # Get fields on this page
                    page_fields = [f for f in section_data.get('fields', []) if f.get('page') == page_num + 1]

                    if not page_fields:
                        continue

                    # Render page to base64
                    image_base64 = renderer.render_page_to_base64(page_num)

                    # Build prompt for Section 13
                    prompt = self._build_section13_prompt(page_num + 1, page_fields)

                    # Call AI API
                    response = await self._call_ai_vision(image_base64, prompt)

                    # Parse response
                    new_fields = self._parse_ai_response(response, page_fields, page_num + 1)

                    # Count results
                    verified = len([f for f in new_fields if f.get('ai_verified')])
                    new = len([f for f in new_fields if f.get('ai_discovered')])

                    total_verified += verified
                    total_new += new

                    enhanced_fields.extend(new_fields)

                    print(f"  ✓ Verified: {verified} fields")
                    print(f"  ➕ Discovered: {new} new fields")

                except Exception as e:
                    print(f"  ❌ Error: {str(e)}")
                    # Use original fields
                    enhanced_fields.extend(page_fields)

            # Update section data
            section_data["fields"] = enhanced_fields

            # Add metadata
            section_data["metadata"]["ai_enhanced"] = True
            section_data["metadata"]["ai_enhancement_date"] = ""
            section_data["metadata"]["fields_verified"] = total_verified
            section_data["metadata"]["fields_discovered"] = total_new
            section_data["metadata"]["original_field_count"] = len(section_data.get("fields", []))
            section_data["metadata"]["ai_integrity_score"] = round((total_verified / len(enhanced_fields) * 100) if enhanced_fields else 0, 2)

            # Create summary
            print(f"\n📊 Section 13 Enhancement Summary:")
            print(f"  - Original fields: {section_data['metadata']['original_field_count']}")
            print(f"  - Final fields: {len(section_data['fields'])}")
            print(f"  - Verified by AI: {total_verified}")
            print(f"  - Discovered by AI: {total_new}")
            print(f"  - Integrity score: {section_data['metadata']['ai_integrity_score']}%")

            return section_data

        finally:
            renderer.close()

    def _get_pages_with_fields(self, section_data: Dict) -> List[int]:
        """
        Get unique page numbers that have fields in Section 13.

        Args:
            section_data: Dict
                Section 13 data

        Returns:
            List[int]
                Page numbers (0-indexed)
        """
        pages = set()
        for field in section_data.get('fields', []):
            if 'page' in field:
                pages.add(field['page'] - 1)  # Convert to 0-indexed

        return sorted(list(pages))

    def _build_section13_prompt(self, page_number: int, known_fields: List[Dict]) -> str:
        """
        Build specialized prompt for Section 13 employment fields.

        Args:
            page_number: int
                Page number (1-indexed)
            known_fields: List[Dict]
                Known fields on this page

        Returns:
            str
                Formatted prompt
        """
        prompt = f"""Analyze this PDF page ({page_number}) from Section 13 - Employment Activities.

This page contains employment information. Look for:

EMPLOYER INFORMATION:
- Company/Business Name
- Employer Address (street, city, state, zip)
- Position or Job Title
- Supervisor Name
- Phone Number
- Email Address

DATES AND SALARY:
- From Date (employment start)
- To Date (employment end)
- Salary or Compensation
- Pay Grade

REASON FOR LEAVING:
- Reason for leaving field or checkbox
- Additional explanation field

CURRENT EMPLOYMENT:
- Currently employed here checkbox
- Expected date of separation

FIELD SPECIFICS:
- Look for text input fields
- Dropdown selectors (state, country)
- Checkboxes
- Date fields
- Signature areas

COORDINATE SYSTEM:
- Return exact pixel coordinates from top-left (0,0)
- Include width and height of each field

Known fields with possible coordinate errors:
{chr(10).join([f"- {field['name']}: ({field.get('rect', {}).get('x', 0)}, {field.get('rect', {}).get('y', 0)})" for field in known_fields[:10]])}
{f"  ... and {len(known_fields)-10} more fields" if len(known_fields) > 10 else ""}

Please:
1. Verify coordinates of known fields
2. Identify any missing fields
3. Correct any obvious coordinate errors
4. Look for fields that might have been missed

Return ONLY JSON:
{
  "fields": [
    {
      "name": "EmployerName",
      "type": "text",
      "coordinates": {"x": 100, "y": 200, "width": 300, "height": 20},
      "label": "Employer Name",
      "required": true,
      "confidence": 0.95
    }
  ]
}

IMPORTANT: Return ONLY the JSON object, no other text or explanation."""

        return prompt

    async def _call_ai_vision(self, image_base64: str, prompt: str) -> Dict:
        """
        Call GLM-4.6v vision API.

        Args:
            image_base64: str
                Base64 encoded image
            prompt: str
                Analysis prompt

        Returns:
            Dict
                API response
        """
        payload = {
            "model": self.config["model"],
            "max_tokens": 4096,
            "messages": [{
                "role": "user",
                "content": [{
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": image_base64
                    }
                }, {
                    "type": "text",
                    "text": prompt
                }]
            }]
        }

        async with httpx.AsyncClient(timeout=self.config["timeout"]) as client:
            try:
                response = await client.post(
                    f"{self.config['api_endpoint']}/v1/messages",
                    headers={
                        "x-api-key": self.config["api_key"],
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )

                if response.status_code != 200:
                    print(f"API Error: {response.status_code} - {response.text}")
                    raise Exception(f"API error: {response.status_code}")

                return response.json()

            except httpx.TimeoutException:
                raise Exception("Request timed out")
            except Exception as e:
                print(f"Connection error: {str(e)}")
                raise Exception(f"API call failed: {str(e)}")

    def _parse_ai_response(self, ai_response: Dict, known_fields: List[Dict], page_number: int) -> List[Dict]:
        """
        Parse AI response and create enhanced field list.

        Args:
            ai_response: Dict
                Response from AI
            known_fields: List[Dict]
                Known fields from clarance-f
            page_number: int
                Page number

        Returns:
            List[Dict]
                Enhanced field list
        """
        try:
            # Extract content
            content = ai_response["content"][0]["text"]

            # Find JSON object
            start_idx = content.find('{')
            if start_idx < 0:
                print("Warning: No JSON found in AI response")
                return known_fields

            # Parse JSON
            ai_data = json.loads(content[start_idx:])
            ai_fields = ai_data.get("fields", [])

            enhanced_fields = []
            used_ai_fields = set()

            # Process known fields
            for known_field in known_fields:
                # Look for matching AI field
                matching_ai = None
                for ai_field in ai_fields:
                    if self._is_matching_field(ai_field, known_field) and str(hash(str(ai_field))) not in used_ai_fields:
                        matching_ai = ai_field
                        break

                if matching_ai:
                    # Create enhanced field
                    enhanced_field = known_field.copy()
                    enhanced_field.update({
                        "ai_verified": True,
                        "ai_corrected_coordinates": matching_ai["coordinates"],
                        "ai_confidence": matching_ai.get("confidence", 0.5),
                        "ai_label": matching_ai.get("label", ""),
                        "page": page_number
                    })
                    enhanced_fields.append(enhanced_field)
                    used_ai_fields.add(str(hash(str(matching_ai))))
                else:
                    # Keep original field but mark
                    enhanced_field = known_field.copy()
                    enhanced_field.update({
                        "ai_verified": False,
                        "ai_confidence": "unknown",
                        "page": page_number
                    })
                    enhanced_fields.append(enhanced_field)

            # Add newly discovered fields
            for ai_field in ai_fields:
                if str(hash(str(ai_field))) not in used_ai_fields:
                    enhanced_field = {
                        "id": f"ai_page{page_number}_{len(enhanced_fields)}",
                        "name": ai_field["name"],
                        "type": self._map_type(ai_field.get("type", "text")),
                        "rect": ai_field["coordinates"],
                        "label": ai_field.get("label", ""),
                        "value": "",
                        "page": page_number,
                        "section": 13,
                        "ai_discovered": True,
                        "ai_verified": True,
                        "confidence": ai_field.get("confidence", 1.0),
                        "required": ai_field.get("required", False),
                        "metadata": {
                            "source": "ai_discovered"
                        }
                    }
                    enhanced_fields.append(enhanced_field)

            return enhanced_fields

        except (json.JSONDecodeError, KeyError) as e:
            print(f"Warning: Failed to parse AI response: {e}")
            print("Using original fields")
            return known_fields

    def _is_matching_field(self, ai_field: Dict, known_field: Dict) -> bool:
        """
        Check if AI field matches known field.

        Args:
            ai_field: Dict
                Field from AI
            known_field: Dict
                Field from clarance-f

        Returns:
            bool
                True if fields match
        """
        try:
            # Check coordinates similarity
            ai_coords = ai_field.get("coordinates", {})
            known_rect = known_field.get("rect", {})

            # Calculate distance
            dx = abs(ai_coords.get("x", 0) - known_rect.get("x", 0))
            dy = abs(ai_coords.get("y", 0) - known_rect.get("y", 0))
            distance = (dx ** 2 + dy ** 2) ** 0.5

            # Check size similarity
            dw = abs(ai_coords.get("width", 0) - known_rect.get("width", 0))
            dh = abs(ai_coords.get("height", 0) - known_rect.get("height", 0))

            # Consider match if close enough
            return distance < 30 and dw < 15 and dh < 15

        except:
            return False

    def _map_type(self, ai_type: str) -> str:
        """Map AI field type to PDF field type."""
        type_map = {
            "text": "PDFTextField",
            "dropdown": "PDFDropdown",
            "select": "PDFDropdown",
            "checkbox": "PDFCheckBox",
            "radio": "PDFRadioButton",
            "signature": "PDFSignature"
        }
        return type_map.get(ai_type.lower(), "PDFTextField")


async def main():
    """Main function to enhance Section 13."""
    import io

    if len(sys.argv) > 2:
        section_id = int(sys.argv[1])
        pdf_path = sys.argv[2]
    else:
        section_id = 13
        pdf_path = "C:/Users/TJ/Desktop/clarance-lol/samples/test-pdfs/clean.pdf"

    print(f"\nAI Gap Filler for Section {section_id}")
    print("=" * 50)
    print(f"PDF: {pdf_path}")

    # Paths
    section_13_path = "C:/Users/TJ/Desktop/clarance-lol/clarance-f/api/sections-references/section-13.json"
    output_path = "C:/Users/TJ/Desktop/clarance-lol/enhanced-section-13.json"

    try:
        # Initialize AI Gap Filler
        filler = AIGapFiller()

        # Enhance Section 13
        enhanced_data = await filler.process_section_13(pdf_path, section_13_path)

        # Save enhanced data
        output_dir = Path(output_path).parent
        output_dir.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(enhanced_data, f, indent=2)

        print(f"\n✅ Success!")
        print(f"Enhanced data saved to: {output_path}")
        print(f"Total fields: {len(enhanced_data.get('fields', []))}")

        # Create summary report
        print(f"\n📊 Enhancement Report:")
        print(f"  - AI Enhanced: {enhanced_data.get('metadata', {}).get('ai_enhanced', False)}")
        print(f"  - Fields Verified: {enhanced_data.get('metadata', {}).get('fields_verified', 0)}")
        print(f"  - New Fields: {enhanced_data.get('metadata', {}).get('fields_discovered', 0)}")
        print(f"  - Integrity Score: {enhanced_data.get('metadata', {}).get('ai_integrity_score', 0)}%")

    except Exception as error:
        print(f"\n❌ Error: {str(error)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())