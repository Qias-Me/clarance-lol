#!/usr/bin/env python3
"""
Section 13 Multi-Layer Validation Framework
Comprehensive integrity checking and quality assurance for PDF mapper restoration
"""

import json
import sys
import os
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
import re
from datetime import datetime
import statistics

class ValidationLevel(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class ValidationStatus(Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    WARNING = "WARNING"
    SKIPPED = "SKIPPED"

@dataclass
class ValidationResult:
    field_id: str
    validation_type: str
    status: ValidationStatus
    level: ValidationLevel
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    fix_suggestion: Optional[str] = None

@dataclass
class ValidationReport:
    total_fields: int
    passed_validations: int
    failed_validations: int
    warnings: int
    overall_status: ValidationStatus
    validation_results: List[ValidationResult] = field(default_factory=list)
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)

class Section13ValidationFramework:
    def __init__(self, reference_data_path: str, extraction_results_path: str):
        self.reference_data_path = reference_data_path
        self.extraction_results_path = extraction_results_path
        self.reference_data = None
        self.extraction_results = None
        self.validation_rules = self._initialize_validation_rules()

    def _initialize_validation_rules(self) -> Dict[str, Dict[str, Any]]:
        """Initialize comprehensive validation rules for Section 13"""

        return {
            'field_coverage': {
                'level': ValidationLevel.CRITICAL,
                'description': 'All 1,086 fields must be present',
                'rules': {
                    'min_field_coverage': 1.0,  # 100% coverage required
                    'required_fields': ['form1[0].section_13_1-2[0].TextField11[0]'],  # Critical supervisor field
                }
            },
            'coordinate_validation': {
                'level': ValidationLevel.HIGH,
                'description': 'Field coordinates must be within PDF boundaries',
                'rules': {
                    'max_x': 612,    # Standard PDF width
                    'max_y': 792,    # Standard PDF height
                    'min_width': 1,
                    'min_height': 1,
                    'coordinate_tolerance': 0.5
                }
            },
            'date_validation': {
                'level': ValidationLevel.HIGH,
                'description': 'Date fields must be in valid formats',
                'rules': {
                    'valid_formats': [
                        r'^\d{2}/\d{2}/\d{4}$',  # MM/DD/YYYY
                        r'^\d{2}/\d{4}$',        # MM/YYYY
                        r'^\d{4}$'              # YYYY
                    ],
                    'year_range': (1900, 2030),
                    'allow_estimated': True
                }
            },
            'phone_validation': {
                'level': ValidationLevel.MEDIUM,
                'description': 'Phone numbers must be in valid formats',
                'rules': {
                    'valid_patterns': [
                        r'^\(\d{3}\) \d{3}-\d{4}$',
                        r'^\d{3}-\d{3}-\d{4}$',
                        r'^\d{10}$'
                    ],
                    'require_area_code': True
                }
            },
            'address_validation': {
                'level': ValidationLevel.MEDIUM,
                'description': 'Addresses must contain required components',
                'rules': {
                    'min_length': 10,
                    'require_street_number': True,
                    'require_city': True,
                    'require_state': True,
                    'require_zip': True,
                    'zip_pattern': r'^\d{5}(-\d{4})?$'
                }
            },
            'name_validation': {
                'level': ValidationLevel.HIGH,
                'description': 'Names must be properly formatted',
                'rules': {
                    'min_length': 2,
                    'max_length': 100,
                    'allow_special_chars': ['-', "'", '.', ' '],
                    'require_first_last': True
                }
            },
            'confidence_validation': {
                'level': ValidationLevel.HIGH,
                'description': 'Extraction confidence must meet thresholds',
                'rules': {
                    'min_confidence': 0.8,
                    'target_confidence': 0.95,
                    'critical_fields_min_confidence': 0.95
                }
            },
            'subsection_validation': {
                'level': ValidationLevel.CRITICAL,
                'description': 'SF-86 subsection structure must be correct',
                'rules': {
                    'required_subsections': [
                        '13A.1', '13A.2', '13A.3', '13A.4', '13A.5', '13A.6',
                        '13B', '13C'
                    ],
                    'max_entries_per_subsection': 4
                }
            }
        }

    def load_data(self) -> bool:
        """Load reference data and extraction results"""
        try:
            # Load reference data
            with open(self.reference_data_path, 'r', encoding='utf-8') as f:
                self.reference_data = json.load(f)

            # Load extraction results
            with open(self.extraction_results_path, 'r', encoding='utf-8') as f:
                self.extraction_results = json.load(f)

            print(f"Loaded reference data: {len(self.reference_data.get('fields', []))} fields")
            print(f"Loaded extraction results: {len(self.extraction_results.get('extraction_results', []))} results")
            return True

        except Exception as e:
            print(f"Error loading data: {e}")
            return False

    def validate_field_coverage(self) -> List[ValidationResult]:
        """Validate that all reference fields are covered in extraction results"""
        results = []

        reference_fields = {field.get('id', ''): field for field in self.reference_data.get('fields', [])}
        extracted_fields = {result.get('field_id', ''): result for result in self.extraction_results.get('extraction_results', [])}

        total_fields = len(reference_fields)
        covered_fields = len(set(reference_fields.keys()) & set(extracted_fields.keys()))
        coverage_rate = covered_fields / total_fields if total_fields > 0 else 0

        # Overall coverage validation
        if coverage_rate < self.validation_rules['field_coverage']['rules']['min_field_coverage']:
            results.append(ValidationResult(
                field_id="OVERALL",
                validation_type="field_coverage",
                status=ValidationStatus.FAILED,
                level=ValidationLevel.CRITICAL,
                message=f"Field coverage {coverage_rate:.2%} below required {self.validation_rules['field_coverage']['rules']['min_field_coverage']:.0%}",
                details={
                    'total_fields': total_fields,
                    'covered_fields': covered_fields,
                    'coverage_rate': coverage_rate,
                    'missing_field_count': total_fields - covered_fields
                },
                fix_suggestion="Ensure all reference fields are processed in extraction pipeline"
            ))
        else:
            results.append(ValidationResult(
                field_id="OVERALL",
                validation_type="field_coverage",
                status=ValidationStatus.PASSED,
                level=ValidationLevel.CRITICAL,
                message=f"Field coverage {coverage_rate:.2%} meets requirements",
                details={
                    'total_fields': total_fields,
                    'covered_fields': covered_fields,
                    'coverage_rate': coverage_rate
                }
            ))

        # Validate required critical fields
        required_fields = self.validation_rules['field_coverage']['rules']['required_fields']
        for required_field in required_fields:
            if required_field not in extracted_fields:
                results.append(ValidationResult(
                    field_id=required_field,
                    validation_type="required_field",
                    status=ValidationStatus.FAILED,
                    level=ValidationLevel.CRITICAL,
                    message=f"Required field {required_field} is missing",
                    fix_suggestion="Ensure critical field is processed and extracted correctly"
                ))

        return results

    def validate_coordinates(self) -> List[ValidationResult]:
        """Validate field coordinates are within PDF boundaries"""
        results = []

        coord_rules = self.validation_rules['coordinate_validation']['rules']

        for result in self.extraction_results.get('extraction_results', []):
            field_id = result.get('field_id', '')
            coordinates = result.get('coordinates', {})

            x = coordinates.get('x', 0)
            y = coordinates.get('y', 0)
            width = coordinates.get('width', 0)
            height = coordinates.get('height', 0)

            # Check boundaries
            x_valid = 0 <= x <= coord_rules['max_x']
            y_valid = 0 <= y <= coord_rules['max_y']
            width_valid = width >= coord_rules['min_width']
            height_valid = height >= coord_rules['min_height']

            if all([x_valid, y_valid, width_valid, height_valid]):
                results.append(ValidationResult(
                    field_id=field_id,
                    validation_type="coordinates",
                    status=ValidationStatus.PASSED,
                    level=ValidationLevel.HIGH,
                    message="Field coordinates are valid",
                    details={
                        'x': x, 'y': y, 'width': width, 'height': height
                    }
                ))
            else:
                errors = []
                if not x_valid:
                    errors.append(f"X coordinate {x} out of bounds [0, {coord_rules['max_x']}]")
                if not y_valid:
                    errors.append(f"Y coordinate {y} out of bounds [0, {coord_rules['max_y']}]")
                if not width_valid:
                    errors.append(f"Width {width} below minimum {coord_rules['min_width']}")
                if not height_valid:
                    errors.append(f"Height {height} below minimum {coord_rules['min_height']}")

                results.append(ValidationResult(
                    field_id=field_id,
                    validation_type="coordinates",
                    status=ValidationStatus.FAILED,
                    level=ValidationLevel.HIGH,
                    message=f"Coordinate validation failed: {'; '.join(errors)}",
                    details={
                        'x': x, 'y': y, 'width': width, 'height': height,
                        'errors': errors
                    },
                    fix_suggestion="Review field extraction coordinates and adjust coordinate detection algorithm"
                ))

        return results

    def validate_extraction_quality(self) -> List[ValidationResult]:
        """Validate extraction quality including confidence and content"""
        results = []

        confidence_rules = self.validation_rules['confidence_validation']['rules']

        for result in self.extraction_results.get('extraction_results', []):
            field_id = result.get('field_id', '')
            confidence = result.get('confidence', 0)
            extracted_value = result.get('extracted_value', '')

            # Find corresponding reference field
            reference_field = None
            for ref_field in self.reference_data.get('fields', []):
                if ref_field.get('id', '') == field_id:
                    reference_field = ref_field
                    break

            # Confidence validation
            min_confidence = confidence_rules['min_confidence']
            if confidence < min_confidence:
                results.append(ValidationResult(
                    field_id=field_id,
                    validation_type="confidence",
                    status=ValidationStatus.WARNING,
                    level=ValidationLevel.HIGH,
                    message=f"Low extraction confidence: {confidence:.3f} < {min_confidence:.3f}",
                    details={
                        'confidence': confidence,
                        'min_required': min_confidence,
                        'extracted_value': extracted_value[:50] + '...' if len(extracted_value) > 50 else extracted_value
                    },
                    fix_suggestion="Review extraction quality for this field, consider manual review or reprocessing"
                ))
            else:
                results.append(ValidationResult(
                    field_id=field_id,
                    validation_type="confidence",
                    status=ValidationStatus.PASSED,
                    level=ValidationLevel.HIGH,
                    message=f"Confidence meets threshold: {confidence:.3f}",
                    details={'confidence': confidence}
                ))

            # Content-specific validation based on field type
            if reference_field:
                content_validation_results = self.validate_field_content(
                    field_id, extracted_value, reference_field
                )
                results.extend(content_validation_results)

        return results

    def validate_field_content(self, field_id: str, extracted_value: str, reference_field: Dict) -> List[ValidationResult]:
        """Validate field content based on field type and context"""
        results = []

        field_name = reference_field.get('name', '').lower()
        field_label = reference_field.get('label', '').lower()
        field_type = reference_field.get('type', '')

        combined_context = f"{field_name} {field_label}"

        # Date validation
        if self._is_date_field(combined_context):
            date_validation = self._validate_date_content(field_id, extracted_value)
            results.append(date_validation)

        # Phone validation
        elif self._is_phone_field(combined_context):
            phone_validation = self._validate_phone_content(field_id, extracted_value)
            results.append(phone_validation)

        # Address validation
        elif self._is_address_field(combined_context):
            address_validation = self._validate_address_content(field_id, extracted_value)
            results.append(address_validation)

        # Name validation
        elif self._is_name_field(combined_context):
            name_validation = self._validate_name_content(field_id, extracted_value)
            results.append(name_validation)

        # Button/radio validation
        elif self._is_button_field(field_type, combined_context):
            button_validation = self._validate_button_content(field_id, extracted_value)
            results.append(button_validation)

        return results

    def _is_date_field(self, context: str) -> bool:
        """Check if field is a date field"""
        date_keywords = ['date', 'from', 'to', 'time', 'period', 'when']
        return any(keyword in context for keyword in date_keywords)

    def _is_phone_field(self, context: str) -> bool:
        """Check if field is a phone field"""
        phone_keywords = ['phone', 'telephone', 'extension', 'fax', 'tel']
        return any(keyword in context for keyword in phone_keywords)

    def _is_address_field(self, context: str) -> bool:
        """Check if field is an address field"""
        address_keywords = ['address', 'city', 'state', 'zip', 'street', 'location']
        return any(keyword in context for keyword in address_keywords)

    def _is_name_field(self, context: str) -> bool:
        """Check if field is a name field"""
        name_keywords = ['name', 'first', 'last', 'middle', 'suffix']
        return any(keyword in context for keyword in name_keywords)

    def _is_button_field(self, field_type: str, context: str) -> bool:
        """Check if field is a button/radio field"""
        return 'radio' in field_type.lower() or 'check' in field_type.lower()

    def _validate_date_content(self, field_id: str, date_value: str) -> ValidationResult:
        """Validate date field content"""
        date_rules = self.validation_rules['date_validation']['rules']
        valid_formats = date_rules['valid_formats']

        # Check format
        is_valid_format = any(re.match(pattern, date_value.strip()) for pattern in valid_formats)

        if is_valid_format:
            # Additional year validation
            year_match = re.search(r'\d{4}', date_value)
            if year_match:
                year = int(year_match.group())
                min_year, max_year = date_rules['year_range']
                if min_year <= year <= max_year:
                    return ValidationResult(
                        field_id=field_id,
                        validation_type="date_content",
                        status=ValidationStatus.PASSED,
                        level=ValidationLevel.HIGH,
                        message=f"Valid date format: {date_value}",
                        details={'year': year, 'format': 'valid'}
                    )
                else:
                    return ValidationResult(
                        field_id=field_id,
                        validation_type="date_content",
                        status=ValidationStatus.WARNING,
                        level=ValidationLevel.HIGH,
                        message=f"Date year {year} outside expected range [{min_year}, {max_year}]",
                        details={'year': year, 'expected_range': (min_year, max_year)},
                        fix_suggestion="Verify date accuracy or review extraction quality"
                    )

        return ValidationResult(
            field_id=field_id,
            validation_type="date_content",
            status=ValidationStatus.FAILED,
            level=ValidationLevel.HIGH,
            message=f"Invalid date format: {date_value}",
            details={'value': date_value, 'expected_formats': valid_formats},
            fix_suggestion="Reprocess field with enhanced date extraction"
        )

    def _validate_phone_content(self, field_id: str, phone_value: str) -> ValidationResult:
        """Validate phone field content"""
        phone_rules = self.validation_rules['phone_validation']['rules']
        valid_patterns = phone_rules['valid_patterns']

        # Clean phone number
        clean_phone = re.sub(r'[^\d]', '', phone_value)

        # Check patterns
        is_valid_pattern = any(re.match(pattern, phone_value.strip()) for pattern in valid_patterns)

        if is_valid_pattern or (len(clean_phone) == 10 and clean_phone.isdigit()):
            return ValidationResult(
                field_id=field_id,
                validation_type="phone_content",
                status=ValidationStatus.PASSED,
                level=ValidationLevel.MEDIUM,
                message=f"Valid phone format: {phone_value}",
                details={'cleaned_phone': clean_phone, 'length': len(clean_phone)}
            )
        else:
            return ValidationResult(
                field_id=field_id,
                validation_type="phone_content",
                status=ValidationStatus.WARNING,
                level=ValidationLevel.MEDIUM,
                message=f"Potentially invalid phone format: {phone_value}",
                details={'value': phone_value, 'cleaned_digits': clean_phone},
                fix_suggestion="Review phone extraction and consider manual correction"
            )

    def _validate_address_content(self, field_id: str, address_value: str) -> ValidationResult:
        """Validate address field content"""
        address_rules = self.validation_rules['address_validation']['rules']

        if len(address_value.strip()) < address_rules['min_length']:
            return ValidationResult(
                field_id=field_id,
                validation_type="address_content",
                status=ValidationStatus.WARNING,
                level=ValidationLevel.MEDIUM,
                message=f"Address too short: {len(address_value)} < {address_rules['min_length']}",
                details={'length': len(address_value), 'value': address_value},
                fix_suggestion="Review address extraction for completeness"
            )

        # Check for required components
        has_number = bool(re.search(r'\d', address_value))
        has_letters = bool(re.search(r'[a-zA-Z]', address_value))

        if address_rules['require_street_number'] and not has_number:
            return ValidationResult(
                field_id=field_id,
                validation_type="address_content",
                status=ValidationStatus.WARNING,
                level=ValidationLevel.MEDIUM,
                message="Address may be missing street number",
                details={'value': address_value, 'has_number': has_number},
                fix_suggestion="Verify address completeness"
            )

        if has_letters:
            return ValidationResult(
                field_id=field_id,
                validation_type="address_content",
                status=ValidationStatus.PASSED,
                level=ValidationLevel.MEDIUM,
                message=f"Valid address format: {address_value[:30]}...",
                details={'has_number': has_number, 'has_letters': has_letters, 'length': len(address_value)}
            )

        return ValidationResult(
            field_id=field_id,
            validation_type="address_content",
            status=ValidationStatus.FAILED,
            level=ValidationLevel.MEDIUM,
            message=f"Invalid address format: {address_value}",
            details={'value': address_value, 'has_number': has_number, 'has_letters': has_letters},
            fix_suggestion="Reprocess address field with enhanced extraction"
        )

    def _validate_name_content(self, field_id: str, name_value: str) -> ValidationResult:
        """Validate name field content"""
        name_rules = self.validation_rules['name_validation']['rules']

        name_length = len(name_value.strip())

        if name_length < name_rules['min_length']:
            return ValidationResult(
                field_id=field_id,
                validation_type="name_content",
                status=ValidationStatus.FAILED,
                level=ValidationLevel.HIGH,
                message=f"Name too short: {name_length} < {name_rules['min_length']}",
                details={'length': name_length, 'value': name_value},
                fix_suggestion="Review name extraction for completeness"
            )

        if name_length > name_rules['max_length']:
            return ValidationResult(
                field_id=field_id,
                validation_type="name_content",
                status=ValidationStatus.WARNING,
                level=ValidationLevel.HIGH,
                message=f"Name unusually long: {name_length} > {name_rules['max_length']}",
                details={'length': name_length, 'value': name_value[:50] + '...'},
                fix_suggestion="Verify name extraction accuracy"
            )

        # Check for valid characters
        valid_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ -.\'')
        invalid_chars = set(name_value) - valid_chars

        if not invalid_chars:
            return ValidationResult(
                field_id=field_id,
                validation_type="name_content",
                status=ValidationStatus.PASSED,
                level=ValidationLevel.HIGH,
                message=f"Valid name format: {name_value}",
                details={'length': name_length}
            )
        else:
            return ValidationResult(
                field_id=field_id,
                validation_type="name_content",
                status=ValidationStatus.WARNING,
                level=ValidationLevel.HIGH,
                message=f"Name contains unusual characters: {list(invalid_chars)}",
                details={'value': name_value, 'invalid_chars': list(invalid_chars)},
                fix_suggestion="Review name extraction for character encoding issues"
            )

    def _validate_button_content(self, field_id: str, button_value: str) -> ValidationResult:
        """Validate button/radio field content"""
        valid_states = ['SELECTED', 'UNSELECTED', 'UNCLEAR', 'TRUE', 'FALSE', 'YES', 'NO', '1', '0']

        button_value_clean = button_value.strip().upper()

        if button_value_clean in valid_states or button_value_clean in ['SELECTED', 'UNSELECTED']:
            return ValidationResult(
                field_id=field_id,
                validation_type="button_content",
                status=ValidationStatus.PASSED,
                level=ValidationLevel.MEDIUM,
                message=f"Valid button state: {button_value}",
                details={'state': button_value_clean}
            )
        else:
            return ValidationResult(
                field_id=field_id,
                validation_type="button_content",
                status=ValidationStatus.WARNING,
                level=ValidationLevel.MEDIUM,
                message=f"Unexpected button state: {button_value}",
                details={'value': button_value, 'expected_states': valid_states},
                fix_suggestion="Review button extraction logic"
            )

    def validate_subsection_structure(self) -> List[ValidationResult]:
        """Validate SF-86 subsection structure"""
        results = []

        subsection_rules = self.validation_rules['subsection_validation']['rules']
        required_subsections = subsection_rules['required_subsections']

        # Count fields by subsection based on naming patterns
        subsection_field_counts = {}
        for field in self.reference_data.get('fields', []):
            field_name = field.get('name', '')

            # Pattern matching for subsections
            if 'section_13_1-2' in field_name:
                subsection_field_counts['13A.1'] = subsection_field_counts.get('13A.1', 0) + 1
            elif 'sect13A.2' in field_name.lower():
                subsection_field_counts['13A.2'] = subsection_field_counts.get('13A.2', 0) + 1
            elif 'sect13A.3' in field_name.lower():
                subsection_field_counts['13A.3'] = subsection_field_counts.get('13A.3', 0) + 1
            # Add more subsection patterns as needed

        # Validate required subsections
        for required_subsection in required_subsections:
            field_count = subsection_field_counts.get(required_subsection, 0)

            if field_count == 0:
                results.append(ValidationResult(
                    field_id=f"SUBSECTION_{required_subsection}",
                    validation_type="subsection_structure",
                    status=ValidationStatus.FAILED,
                    level=ValidationLevel.CRITICAL,
                    message=f"Required subsection {required_subsection} has no fields",
                    details={'subsection': required_subsection, 'field_count': field_count},
                    fix_suggestion="Ensure all required subsections are present in reference data"
                ))
            else:
                results.append(ValidationResult(
                    field_id=f"SUBSECTION_{required_subsection}",
                    validation_type="subsection_structure",
                    status=ValidationStatus.PASSED,
                    level=ValidationLevel.CRITICAL,
                    message=f"Subsection {required_subsection} has {field_count} fields",
                    details={'subsection': required_subsection, 'field_count': field_count}
                ))

        return results

    def run_comprehensive_validation(self) -> ValidationReport:
        """Run all validation checks and generate comprehensive report"""
        print("Running comprehensive Section 13 validation...")

        all_results = []
        validation_start_time = datetime.now()

        # Run all validation categories
        print("  - Validating field coverage...")
        all_results.extend(self.validate_field_coverage())

        print("  - Validating coordinates...")
        all_results.extend(self.validate_coordinates())

        print("  - Validating extraction quality...")
        all_results.extend(self.validate_extraction_quality())

        print("  - Validating subsection structure...")
        all_results.extend(self.validate_subsection_structure())

        # Calculate summary statistics
        passed_count = len([r for r in all_results if r.status == ValidationStatus.PASSED])
        failed_count = len([r for r in all_results if r.status == ValidationStatus.FAILED])
        warning_count = len([r for r in all_results if r.status == ValidationStatus.WARNING])

        # Determine overall status
        critical_failures = len([r for r in all_results
                               if r.status == ValidationStatus.FAILED and r.level == ValidationLevel.CRITICAL])

        if critical_failures > 0:
            overall_status = ValidationStatus.FAILED
        elif failed_count > 0:
            overall_status = ValidationStatus.WARNING
        else:
            overall_status = ValidationStatus.PASSED

        # Generate performance metrics
        processing_time = (datetime.now() - validation_start_time).total_seconds()
        confidence_scores = [r.get('confidence', 0) for r in self.extraction_results.get('extraction_results', [])]

        performance_metrics = {
            'validation_processing_time': processing_time,
            'average_extraction_confidence': statistics.mean(confidence_scores) if confidence_scores else 0,
            'extraction_confidence_std': statistics.stdev(confidence_scores) if len(confidence_scores) > 1 else 0,
            'validation_efficiency': len(all_results) / processing_time if processing_time > 0 else 0
        }

        # Generate recommendations
        recommendations = self._generate_recommendations(all_results)

        return ValidationReport(
            total_fields=len(self.reference_data.get('fields', [])),
            passed_validations=passed_count,
            failed_validations=failed_count,
            warnings=warning_count,
            overall_status=overall_status,
            validation_results=all_results,
            performance_metrics=performance_metrics,
            recommendations=recommendations
        )

    def _generate_recommendations(self, validation_results: List[ValidationResult]) -> List[str]:
        """Generate actionable recommendations based on validation results"""
        recommendations = []

        # Analyze failure patterns
        failures_by_type = {}
        for result in validation_results:
            if result.status == ValidationStatus.FAILED:
                validation_type = result.validation_type
                failures_by_type[validation_type] = failures_by_type.get(validation_type, 0) + 1

        # Generate specific recommendations
        if 'field_coverage' in failures_by_type:
            recommendations.append(
                "CRITICAL: Improve field extraction pipeline to achieve 100% field coverage"
            )

        if 'coordinates' in failures_by_type:
            recommendations.append(
                "Review coordinate detection algorithm and adjust boundary validation rules"
            )

        if failures_by_type.get('date_content', 0) > 5:
            recommendations.append(
                "Enhance date extraction with multiple format recognition and validation"
            )

        if failures_by_type.get('phone_content', 0) > 5:
            recommendations.append(
                "Improve phone number extraction with format standardization"
            )

        # Performance recommendations
        if any('confidence' in r.validation_type for r in validation_results if r.status == ValidationStatus.WARNING):
            recommendations.append(
                "Consider reprocessing low-confidence fields with enhanced AI parameters"
            )

        return recommendations

    def save_validation_report(self, report: ValidationReport, output_path: str = None):
        """Save validation report to JSON file"""
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"section13_validation_report_{timestamp}.json"

        # Convert to serializable format
        serializable_report = {
            'metadata': {
                'validation_date': datetime.now().isoformat(),
                'framework_version': 'Section13-Validation-v1.0',
                'reference_data_path': self.reference_data_path,
                'extraction_results_path': self.extraction_results_path
            },
            'summary': {
                'total_fields': report.total_fields,
                'passed_validations': report.passed_validations,
                'failed_validations': report.failed_validations,
                'warnings': report.warnings,
                'overall_status': report.overall_status.value
            },
            'performance_metrics': report.performance_metrics,
            'recommendations': report.recommendations,
            'validation_results': [
                {
                    'field_id': r.field_id,
                    'validation_type': r.validation_type,
                    'status': r.status.value,
                    'level': r.level.value,
                    'message': r.message,
                    'details': r.details,
                    'fix_suggestion': r.fix_suggestion
                }
                for r in report.validation_results
            ]
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(serializable_report, f, indent=2, ensure_ascii=False)

        print(f"Validation report saved to: {output_path}")
        return output_path

def main():
    if len(sys.argv) != 3:
        print("Usage: python section13-validation-framework.py <reference_data.json> <extraction_results.json>")
        sys.exit(1)

    reference_data_path = sys.argv[1]
    extraction_results_path = sys.argv[2]

    print("Section 13 Multi-Layer Validation Framework")
    print("=" * 50)

    # Initialize validation framework
    validator = Section13ValidationFramework(reference_data_path, extraction_results_path)

    # Load data
    if not validator.load_data():
        sys.exit(1)

    # Run comprehensive validation
    report = validator.run_comprehensive_validation()

    # Print summary
    print(f"\nValidation Summary:")
    print(f"  Total Fields: {report.total_fields}")
    print(f"  Passed: {report.passed_validations}")
    print(f"  Failed: {report.failed_validations}")
    print(f"  Warnings: {report.warnings}")
    print(f"  Overall Status: {report.overall_status.value}")

    print(f"\nPerformance Metrics:")
    for metric, value in report.performance_metrics.items():
        print(f"  {metric}: {value:.3f}")

    if report.recommendations:
        print(f"\nRecommendations:")
        for i, rec in enumerate(report.recommendations, 1):
            print(f"  {i}. {rec}")

    # Save detailed report
    output_path = validator.save_validation_report(report)
    print(f"\nDetailed report saved to: {output_path}")

    # Exit with appropriate code
    sys.exit(0 if report.overall_status == ValidationStatus.PASSED else 1)

if __name__ == '__main__':
    main()