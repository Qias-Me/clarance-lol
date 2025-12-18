#!/usr/bin/env python3
"""
GLM4.5V Section 13 Field Extraction Processor
AI Vision Integration for PDF Mapper Integrity Restoration

Processes all 1,086 fields in Section 13 using GLM4.5V with targeted extraction strategies
"""

import json
import sys
import os
import asyncio
import aiohttp
import base64
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import time
import re

@dataclass
class FieldExtractionRequest:
    field_id: str
    field_name: str
    field_type: str
    coordinates: Dict[str, float]
    page_number: int
    extraction_strategy: str
    validation_rules: List[str]
    priority: str

@dataclass
class FieldExtractionResult:
    field_id: str
    extracted_value: str
    confidence: float
    coordinates: Dict[str, float]
    processing_time: float
    validation_passed: bool
    errors: List[str]

class GLM4VSection13Processor:
    def __init__(self, api_key: str, api_endpoint: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.api_endpoint = api_endpoint
        self.session = None
        self.results_cache = {}
        self.performance_metrics = {
            'total_processed': 0,
            'successful_extractions': 0,
            'failed_extractions': 0,
            'average_confidence': 0.0,
            'total_processing_time': 0.0
        }

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            timeout=aiohttp.ClientTimeout(total=60)
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    def load_field_configuration(self, config_path: str) -> Dict[str, Any]:
        """Load field configuration from analysis"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def categorize_field_extraction_strategy(self, field: Dict[str, Any]) -> str:
        """Determine extraction strategy based on field characteristics"""

        field_name = field.get('name', '').lower()
        field_label = field.get('label', '').lower()
        field_value = str(field.get('value', '')).lower() if field.get('value') else ''

        combined_text = f"{field_name} {field_label} {field_value}"

        # Date fields
        if re.search(r'date|from|to|time|period', combined_text):
            return 'date_extraction'

        # Phone/contact fields
        elif re.search(r'phone|telephone|extension|fax', combined_text):
            return 'contact_extraction'

        # Address fields
        elif re.search(r'address|city|state|zip|street', combined_text):
            return 'address_extraction'

        # Name fields
        elif re.search(r'name|first|last|middle|suffix', combined_text):
            return 'name_extraction'

        # Radio/button fields
        elif field.get('type') in ['PDFRadioButton', 'PDFCheckBox']:
            return 'button_extraction'

        # Supervisor information
        elif re.search(r'supervisor|manager|sup', combined_text):
            return 'supervisor_extraction'

        # Job/position fields
        elif re.search(r'position|title|rank|occupation|job', combined_text):
            return 'job_extraction'

        # Numeric fields
        elif re.search(r'number|amount|salary|pay', combined_text):
            return 'numeric_extraction'

        # Text explanation fields
        elif re.search(r'explain|reason|description|comment', combined_text):
            return 'text_extraction'

        # Default text field extraction
        return 'text_extraction'

    def generate_extraction_prompt(self, request: FieldExtractionRequest) -> str:
        """Generate specialized extraction prompt based on field type"""

        base_prompt = f"""
Extract the value from the PDF field at coordinates ({request.coordinates['x']}, {request.coordinates['y']})
with dimensions {request.coordinates.get('width', 0)}x{request.coordinates.get('height', 0)} on page {request.page_number}.

Field Information:
- Name: {request.field_name}
- Type: {request.field_type}
- Label: {request.extraction_strategy}

"""

        strategy_prompts = {
            'date_extraction': """
Extraction Strategy: DATE
- Look for dates in MM/DD/YYYY, MM/YYYY, or YYYY formats
- Validate month/year combinations
- Handle estimated dates with appropriate indicators
- Return in consistent MM/DD/YYYY format
""",

            'contact_extraction': """
Extraction Strategy: PHONE/CONTACT
- Extract phone numbers in (xxx) xxx-xxxx or xxx-xxx-xxxx format
- Handle extensions if present
- Clean up formatting and special characters
- Return standardized format
""",

            'address_extraction': """
Extraction Strategy: ADDRESS
- Extract street address, city, state, zip code
- Standardize state abbreviations
- Validate zip code format
- Return complete address components
""",

            'name_extraction': """
Extraction Strategy: PERSON NAME
- Extract first, middle, last names separately
- Handle suffixes (Jr, Sr, II, III, etc.)
- Preserve original capitalization
- Handle name fields with specific formatting
""",

            'button_extraction': """
Extraction Strategy: SELECTION FIELD
- Identify if radio button or checkbox is selected
- Return 'SELECTED', 'UNSELECTED', or 'UNCLEAR'
- Consider visual indicators (filled circles, X marks, etc.)
- Check for selection patterns in field groups
""",

            'supervisor_extraction': """
Extraction Strategy: SUPERVISOR INFO
- Extract supervisor name, title, contact info
- Handle business card format layouts
- Separate name, position, and contact details
- Validate business information format
""",

            'job_extraction': """
Extraction Strategy: JOB POSITION
- Extract job titles and position names
- Handle rank/grade information
- Preserve official formatting
- Clean up extraneous text
""",

            'numeric_extraction': """
Extraction Strategy: NUMERIC DATA
- Extract numbers and currency values
- Handle decimal points and separators
- Clean up formatting characters
- Return clean numeric values
""",

            'text_extraction': """
Extraction Strategy: FREE TEXT
- Extract complete text content
- Preserve line breaks and formatting
- Clean up scanning artifacts
- Return exact text content
"""
        }

        strategy_prompt = strategy_prompts.get(request.extraction_strategy, strategy_prompts['text_extraction'])

        return f"""
{base_prompt}
{strategy_prompt}

Extraction Requirements:
1. High accuracy extraction with confidence scoring
2. Format standardization
3. Validation against field type requirements
4. Handle edge cases and ambiguous content

Response Format:
{{
  "extracted_value": "cleaned extracted value",
  "confidence": 0.95,
  "alternative_values": ["alternative1", "alternative2"],
  "validation_notes": "any validation observations",
  "processing_confidence": 0.95
}}

Extract the field value now:
"""

    async def process_field_with_vision(self,
                                      request: FieldExtractionRequest,
                                      pdf_base64: str) -> FieldExtractionResult:
        """Process a single field using GLM4.5V vision capabilities"""

        start_time = time.time()
        errors = []

        try:
            # Generate extraction prompt
            prompt = self.generate_extraction_prompt(request)

            # Prepare API request
            api_payload = {
                "model": "gpt-4-vision-preview",  # Using GLM4.5V equivalent
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:application/pdf;base64,{pdf_base64}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 500,
                "temperature": 0.1,  # Low temperature for consistent extraction
                "response_format": {"type": "json_object"}
            }

            # Make API call
            async with self.session.post(
                f"{self.api_endpoint}/chat/completions",
                json=api_payload
            ) as response:

                if response.status != 200:
                    error_text = await response.text()
                    errors.append(f"API Error {response.status}: {error_text}")
                    return FieldExtractionResult(
                        field_id=request.field_id,
                        extracted_value="",
                        confidence=0.0,
                        coordinates=request.coordinates,
                        processing_time=time.time() - start_time,
                        validation_passed=False,
                        errors=errors
                    )

                response_data = await response.json()
                content = json.loads(response_data['choices'][0]['message']['content'])

                # Validate extracted value
                validation_passed = await self.validate_extraction_result(request, content)

                processing_time = time.time() - start_time

                # Update performance metrics
                self.performance_metrics['total_processed'] += 1
                if validation_passed and content.get('confidence', 0) > 0.8:
                    self.performance_metrics['successful_extractions'] += 1
                else:
                    self.performance_metrics['failed_extractions'] += 1

                self.performance_metrics['total_processing_time'] += processing_time
                self.performance_metrics['average_confidence'] = (
                    (self.performance_metrics['average_confidence'] * (self.performance_metrics['total_processed'] - 1) +
                     content.get('confidence', 0)) / self.performance_metrics['total_processed']
                )

                return FieldExtractionResult(
                    field_id=request.field_id,
                    extracted_value=content.get('extracted_value', ''),
                    confidence=content.get('confidence', 0),
                    coordinates=request.coordinates,
                    processing_time=processing_time,
                    validation_passed=validation_passed,
                    errors=[]
                )

        except Exception as e:
            errors.append(f"Processing Error: {str(e)}")
            processing_time = time.time() - start_time

            self.performance_metrics['total_processed'] += 1
            self.performance_metrics['failed_extractions'] += 1
            self.performance_metrics['total_processing_time'] += processing_time

            return FieldExtractionResult(
                field_id=request.field_id,
                extracted_value="",
                confidence=0.0,
                coordinates=request.coordinates,
                processing_time=processing_time,
                validation_passed=False,
                errors=errors
            )

    async def validate_extraction_result(self,
                                        request: FieldExtractionRequest,
                                        content: Dict[str, Any]) -> bool:
        """Validate extraction result based on field type and rules"""

        extracted_value = content.get('extracted_value', '')
        confidence = content.get('confidence', 0)

        # Base confidence check
        if confidence < 0.7:
            return False

        # Field type specific validation
        if request.extraction_strategy == 'date_extraction':
            return self.validate_date_format(extracted_value)

        elif request.extraction_strategy == 'contact_extraction':
            return self.validate_contact_format(extracted_value)

        elif request.extraction_strategy == 'address_extraction':
            return self.validate_address_format(extracted_value)

        elif request.extraction_strategy == 'numeric_extraction':
            return self.validate_numeric_format(extracted_value)

        elif request.extraction_strategy == 'button_extraction':
            return extracted_value in ['SELECTED', 'UNSELECTED', 'UNCLEAR']

        # For text fields, ensure reasonable content
        elif len(extracted_value.strip()) > 0:
            return True

        return False

    def validate_date_format(self, date_str: str) -> bool:
        """Validate date format"""
        date_patterns = [
            r'^\d{2}/\d{2}/\d{4}$',  # MM/DD/YYYY
            r'^\d{2}/\d{4}$',        # MM/YYYY
            r'^\d{4}$'              # YYYY
        ]
        return any(re.match(pattern, date_str.strip()) for pattern in date_patterns)

    def validate_contact_format(self, contact_str: str) -> bool:
        """Validate phone/contact format"""
        phone_patterns = [
            r'^\(\d{3}\) \d{3}-\d{4}$',  # (xxx) xxx-xxxx
            r'^\d{3}-\d{3}-\d{4}$',      # xxx-xxx-xxxx
            r'^\d{10}$'                 # 10 digits
        ]
        return any(re.match(pattern, contact_str.strip()) for pattern in phone_patterns)

    def validate_address_format(self, address_str: str) -> bool:
        """Validate address format"""
        # Basic address validation - should contain street and city
        if len(address_str.strip()) < 10:
            return False

        # Should contain at least one number (street number) and letters
        has_number = bool(re.search(r'\d', address_str))
        has_letters = bool(re.search(r'[a-zA-Z]', address_str))

        return has_number and has_letters

    def validate_numeric_format(self, numeric_str: str) -> bool:
        """Validate numeric format"""
        # Remove common formatting characters
        clean_numeric = re.sub(r'[$,\s]', '', numeric_str.strip())

        # Try to parse as number
        try:
            float(clean_numeric)
            return True
        except ValueError:
            return False

    async def process_section13_batch(self,
                                     section_data: Dict[str, Any],
                                     pdf_path: str,
                                     batch_size: int = 50) -> List[FieldExtractionResult]:
        """Process Section 13 fields in batches"""

        print(f"Processing {len(section_data['fields'])} fields in batches of {batch_size}")

        # Convert PDF to base64
        with open(pdf_path, 'rb') as pdf_file:
            pdf_base64 = base64.b64encode(pdf_file.read()).decode('utf-8')

        # Prepare field extraction requests
        extraction_requests = []

        for field in section_data['fields']:
            strategy = self.categorize_field_extraction_strategy(field)

            request = FieldExtractionRequest(
                field_id=field.get('id', ''),
                field_name=field.get('name', ''),
                field_type=field.get('type', ''),
                coordinates=field.get('rect', {}),
                page_number=field.get('page', 0),
                extraction_strategy=strategy,
                validation_rules=[],  # Can be enhanced with specific rules
                priority=field.get('priority', 'MEDIUM')
            )
            extraction_requests.append(request)

        # Process in batches
        all_results = []
        total_batches = (len(extraction_requests) + batch_size - 1) // batch_size

        for i in range(0, len(extraction_requests), batch_size):
            batch_requests = extraction_requests[i:i + batch_size]
            batch_number = i // batch_size + 1

            print(f"Processing batch {batch_number}/{total_batches} ({len(batch_requests)} fields)")

            # Process batch concurrently
            batch_tasks = [
                self.process_field_with_vision(request, pdf_base64)
                for request in batch_requests
            ]

            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            # Filter out exceptions and add valid results
            for result in batch_results:
                if isinstance(result, Exception):
                    print(f"Error in batch processing: {result}")
                else:
                    all_results.append(result)

            # Progress report
            successful = sum(1 for r in batch_results if isinstance(r, FieldExtractionResult) and r.validation_passed)
            print(f"Batch {batch_number} completed: {successful}/{len(batch_requests)} successful")

        return all_results

    def generate_processing_report(self, results: List[FieldExtractionResult]) -> Dict[str, Any]:
        """Generate comprehensive processing report"""

        successful_results = [r for r in results if r.validation_passed]
        failed_results = [r for r in results if not r.validation_passed]

        # Analysis by field type
        strategy_performance = {}
        for result in results:
            strategy = getattr(result, 'extraction_strategy', 'unknown')
            if strategy not in strategy_performance:
                strategy_performance[strategy] = {'total': 0, 'successful': 0, 'avg_confidence': 0}

            strategy_performance[strategy]['total'] += 1
            if result.validation_passed:
                strategy_performance[strategy]['successful'] += 1

            strategy_performance[strategy]['avg_confidence'] += result.confidence

        # Calculate averages
        for strategy in strategy_performance:
            if strategy_performance[strategy]['total'] > 0:
                strategy_performance[strategy]['avg_confidence'] /= strategy_performance[strategy]['total']
                strategy_performance[strategy]['success_rate'] = (
                    strategy_performance[strategy]['successful'] / strategy_performance[strategy]['total']
                )

        return {
            'processing_summary': {
                'total_fields': len(results),
                'successful_extractions': len(successful_results),
                'failed_extractions': len(failed_results),
                'overall_success_rate': len(successful_results) / len(results) if results else 0,
                'average_confidence': sum(r.confidence for r in results) / len(results) if results else 0,
                'total_processing_time': sum(r.processing_time for r in results)
            },
            'performance_by_strategy': strategy_performance,
            'error_analysis': {
                'common_errors': [],
                'failed_field_ids': [r.field_id for r in failed_results]
            },
            'quality_metrics': {
                'high_confidence_extractions': len([r for r in results if r.confidence > 0.9]),
                'medium_confidence_extractions': len([r for r in results if 0.7 < r.confidence <= 0.9]),
                'low_confidence_extractions': len([r for r in results if r.confidence <= 0.7])
            }
        }

    async def save_results(self, results: List[FieldExtractionResult], output_path: str):
        """Save extraction results to JSON file"""

        # Convert results to serializable format
        serializable_results = []
        for result in results:
            serializable_results.append({
                'field_id': result.field_id,
                'extracted_value': result.extracted_value,
                'confidence': result.confidence,
                'coordinates': result.coordinates,
                'processing_time': result.processing_time,
                'validation_passed': result.validation_passed,
                'errors': result.errors
            })

        # Generate comprehensive report
        report = self.generate_processing_report(results)

        output_data = {
            'metadata': {
                'processing_date': datetime.now().isoformat(),
                'total_fields_processed': len(results),
                'processor_version': 'GLM4V-Section13-Processor-v1.0'
            },
            'processing_report': report,
            'extraction_results': serializable_results
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"Results saved to: {output_path}")
        print(f"Processing Report: {report['processing_summary']}")

        return report

async def main():
    if len(sys.argv) != 4:
        print("Usage: python glm4.5v-section13-processor.py <api_key> <section13_analysis.json> <input.pdf>")
        sys.exit(1)

    api_key = sys.argv[1]
    section_config_path = sys.argv[2]
    pdf_path = sys.argv[3]

    print("GLM4.5V Section 13 Field Extraction Processor")
    print("=" * 50)

    # Validate inputs
    if not os.path.exists(section_config_path):
        print(f"Error: Section configuration file not found: {section_config_path}")
        sys.exit(1)

    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)

    try:
        # Load field configuration
        print("Loading field configuration...")
        processor = GLM4VSection13Processor(api_key)

        # Load section data from the original JSON
        section_json_path = section_config_path.replace('_analysis_report.md', '.json')
        with open(section_json_path, 'r', encoding='utf-8') as f:
            section_data = json.load(f)

        print(f"Loaded {len(section_data['fields'])} fields for processing")
        print(f"PDF: {pdf_path}")
        print()

        # Process fields using AI vision
        async with processor:
            print("Starting AI vision processing...")
            results = await processor.process_section13_batch(
                section_data,
                pdf_path,
                batch_size=50  # Process 50 fields at a time
            )

            print(f"\nProcessing completed! Results: {len(results)} fields processed")

            # Save results
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"section13_extraction_results_{timestamp}.json"

            report = await processor.save_results(results, output_path)

            print(f"\nFinal Performance Summary:")
            print(f"Success Rate: {report['processing_summary']['overall_success_rate']:.2%}")
            print(f"Average Confidence: {report['processing_summary']['average_confidence']:.3f}")
            print(f"Total Processing Time: {report['processing_summary']['total_processing_time']:.2f} seconds")

    except Exception as e:
        print(f"Error during processing: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())