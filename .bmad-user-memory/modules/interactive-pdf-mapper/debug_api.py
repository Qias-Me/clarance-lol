import asyncio
import base64
import json
import os
import re
import sys
from pathlib import Path

current_dir = Path(__file__).parent
env_path = current_dir.parent.parent.parent / ".env.local"

if env_path.exists():
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)

import fitz
import httpx


async def debug_single_page():
    api_key = os.environ.get("GLM45V_API_KEY", "")
    api_endpoint = os.environ.get("GLM45V_ENDPOINT", "https://api.z.ai/api/paas/v4")
    model = os.environ.get("GLM45V_MODEL", "glm-4.6v")

    print(f"API Endpoint: {api_endpoint}")
    print(f"Model: {model}")
    print(f"API Key (first 10 chars): {api_key[:10]}...")
    print()

    pdf_path = r"C:\Users\TJ\Desktop\clarance-lol\samples\test-pdfs\clean.pdf"

    doc = fitz.open(pdf_path)
    print(f"PDF has {doc.page_count} pages")

    page = doc[0]
    mat = fitz.Matrix(1.5, 1.5)
    pix = page.get_pixmap(matrix=mat)
    image_data = pix.tobytes("png")
    print(f"Page 1 rendered: {len(image_data)} bytes")

    prompt = """Analyze this PDF page image and identify ALL form fields.

Detection Sensitivity: Detect clearly visible form fields.
Minimum Confidence: 0.5

For EACH field detected, provide a JSON object with:
- field_type: one of "text-input", "signature", "date", "checkbox"
- coordinates: object with x, y, width, height (in pixels from top-left)
- field_label: the label text near the field (if visible)
- section: the section name this field belongs to
- subsection: the subsection name (if applicable)
- entry: the entry identifier for repeating groups (if applicable)
- confidence: your confidence score between 0.0 and 1.0

Return ONLY a JSON array of field objects. No other text."""

    image_base64 = base64.b64encode(image_data).decode("utf-8")

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_base64}"
                        },
                    },
                    {
                        "type": "text",
                        "text": prompt,
                    },
                ],
            }
        ],
        "max_tokens": 4096,
    }

    endpoint = f"{api_endpoint}/chat/completions"
    print(f"\nCalling: {endpoint}")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=httpx.Timeout(60)) as client:
        try:
            response = await client.post(
                endpoint,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )

            print(f"Status Code: {response.status_code}")
            print()

            if response.status_code != 200:
                print(f"ERROR RESPONSE: {response.text[:1000]}")
                return

            data = response.json()
            print("RAW API RESPONSE:")
            print("=" * 60)
            print(json.dumps(data, indent=2, default=str)[:3000])

            if "choices" in data:
                content = data["choices"][0]["message"]["content"]
                print("\n\nCONTENT FROM API:")
                print("=" * 60)
                print(content[:2000])

                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    print("\n\nPARSED JSON ARRAY:")
                    print("=" * 60)
                    parsed = json.loads(json_match.group())
                    print(f"Found {len(parsed)} fields")
                    for i, field in enumerate(parsed[:5]):
                        print(f"\nField {i+1}: {json.dumps(field, indent=2)}")
                else:
                    print("\n\nNO JSON ARRAY FOUND IN RESPONSE!")

        except Exception as e:
            print(f"\nERROR: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

    doc.close()


if __name__ == "__main__":
    asyncio.run(debug_single_page())
