#!/usr/bin/env python3
"""
Section 13 Comprehensive Field Analysis & AI Vision Integration
Analyzes all 1,086 problematic fields in Section 13 and categorizes them for AI vision processing
"""

import json
import sys
from typing import Dict, List, Tuple, Any
from collections import defaultdict, Counter
import re

class Section13FieldAnalyzer:
    def __init__(self, section_json_path: str):
        self.section_json_path = section_json_path
        self.fields_data = None
        self.field_categories = {}
        self.field_patterns = {}
        self.page_analysis = defaultdict(list)

    def load_section_data(self) -> bool:
        """Load Section 13 JSON data"""
        try:
            with open(self.section_json_path, 'r', encoding='utf-8') as f:
                self.fields_data = json.load(f)

            metadata = self.fields_data.get('metadata', {})
            print(f"Loaded Section {metadata.get('sectionId', 'Unknown')}: {metadata.get('sectionName', 'Unknown')}")
            print(f"Total Fields: {metadata.get('totalFields', 0)}")
            print(f"Page Range: {metadata.get('pageRange', 'Unknown')}")
            print(f"Average Confidence: {metadata.get('averageConfidence', 0):.3f}")
            print()
            return True

        except Exception as e:
            print(f"Error loading section data: {e}")
            return False

    def categorize_fields_by_pattern(self) -> Dict[str, List[Dict]]:
        """Categorize fields by naming patterns and types"""

        # Define field pattern categories based on SF-86 structure
        categories = {
            '13A_1_MilitaryFederal': {
                'pattern': r'section_13_1-2.*|sect13A\.1',
                'description': 'Military/Federal Employment Entry',
                'priority': 'HIGH'
            },
            '13A_2_NonFederal': {
                'pattern': r' sect13A\.2|section_13_.*2.*',
                'description': 'Non-Federal Employment Entry',
                'priority': 'HIGH'
            },
            '13A_3_SelfEmployed': {
                'pattern': r'sect13A\.3|self.*employ',
                'description': 'Self-Employment Entry',
                'priority': 'HIGH'
            },
            '13A_4_Unemployment': {
                'pattern': r'sect13A\.4|unemploy',
                'description': 'Unemployment Period Entry',
                'priority': 'MEDIUM'
            },
            '13A_5_EmploymentIssues': {
                'pattern': r'sect13A\.5|disciplinary|terminat',
                'description': 'Employment Record Issues',
                'priority': 'HIGH'
            },
            '13A_6_Disciplinary': {
                'pattern': r'sect13A\.6|written.*warn|suspension',
                'description': 'Disciplinary Actions',
                'priority': 'HIGH'
            },
            '13B_EmploymentGaps': {
                'pattern': r'gap|period.*unemploy',
                'description': 'Employment Gaps Explanation',
                'priority': 'MEDIUM'
            },
            '13C_Verification': {
                'pattern': r'verif|confirm|radio',
                'description': 'Employment Record Verification',
                'priority': 'HIGH'
            },
            'Supervisor_Information': {
                'pattern': r'supervisor|manager|sup',
                'description': 'Supervisor Contact Information',
                'priority': 'MEDIUM'
            },
            'Address_Information': {
                'pattern': r'address|city|state|zip|street',
                'description': 'Address and Location Data',
                'priority': 'MEDIUM'
            },
            'Contact_Information': {
                'pattern': r'phone|email|extension|telephone',
                'description': 'Contact Information',
                'priority': 'MEDIUM'
            },
            'Dates_and_Timeline': {
                'pattern': r'date|from|to|period|time',
                'description': 'Dates and Timeline Information',
                'priority': 'HIGH'
            },
            'Job_Details': {
                'pattern': r'position|title|rank|occupation|job',
                'description': 'Job Position and Title Information',
                'priority': 'HIGH'
            },
            'Salary_Compensation': {
                'pattern': r'salary|pay|wage|income|compensation',
                'description': 'Salary and Compensation Information',
                'priority': 'MEDIUM'
            },
            'Leave_Information': {
                'pattern': r'leave|absent|vacation|sick',
                'description': 'Leave and Absence Information',
                'priority': 'LOW'
            },
            'Reason_Explanation': {
                'pattern': r'reason|explanation|explain|why',
                'description': 'Reasons and Explanations',
                'priority': 'HIGH'
            }
        }

        categorized_fields = {category: [] for category in categories.keys()}
        uncategorized = []

        for field in self.fields_data.get('fields', []):
            field_name = field.get('name', '').lower()
            field_value = str(field.get('value', '')).lower() if field.get('value') else ''
            field_label = field.get('label', '').lower()

            # Combine all text fields for pattern matching
            combined_text = f"{field_name} {field_value} {field_label}"

            categorized = False

            # Check against each category pattern
            for category, config in categories.items():
                if re.search(config['pattern'], combined_text, re.IGNORECASE):
                    categorized_fields[category].append({
                        'id': field.get('id', ''),
                        'name': field.get('name', ''),
                        'value': field.get('value', ''),
                        'label': field.get('label', ''),
                        'page': field.get('page', 0),
                        'type': field.get('type', ''),
                        'confidence': field.get('confidence', 0),
                        'rect': field.get('rect', {}),
                        'priority': config['priority']
                    })
                    categorized = True
                    break

            if not categorized:
                uncategorized.append(field)

        # Store uncategorized fields for review
        categorized_fields['UNCATEGORIZED'] = uncategorized

        return categorized_fields, categories

    def analyze_by_pages(self) -> Dict[int, Dict]:
        """Analyze field distribution across pages"""
        page_analysis = defaultdict(lambda: {
            'field_count': 0,
            'field_types': Counter(),
            'confidence_sum': 0,
            'categories': defaultdict(int),
            'fields': []
        })

        categorized_fields, categories = self.categorize_fields_by_pattern()

        for category, fields in categorized_fields.items():
            if category == 'UNCATEGORIZED':
                continue

            for field in fields:
                page = field.get('page', 0)
                page_analysis[page]['field_count'] += 1
                page_analysis[page]['field_types'][field.get('type', '')] += 1
                page_analysis[page]['confidence_sum'] += field.get('confidence', 0)
                page_analysis[page]['categories'][category] += 1
                page_analysis[page]['fields'].append(field)

        return dict(page_analysis)

    def identify_field_validation_rules(self) -> Dict[str, List[str]]:
        """Identify validation requirements for each field category"""
        validation_rules = {
            'Dates_and_Timeline': [
                'validate_date_format',
                'check_date_ranges',
                'verify_chronological_order',
                'estimate_date_tolerance'
            ],
            'Contact_Information': [
                'validate_phone_format',
                'check_email_format',
                'verify_extension_format'
            ],
            'Address_Information': [
                'validate_street_address',
                'check_city_state_combo',
                'verify_zip_code_format',
                'validate_country_codes'
            ],
            'Supervisor_Information': [
                'validate_name_format',
                'check_required_fields',
                'verify_business_logic'
            ],
            'Job_Details': [
                'validate_title_format',
                'check_character_limits',
                'verify_business_rules'
            ],
            '13C_Verification': [
                'validate_radio_selection',
                'check_required_completion',
                'verify_cross_section_consistency'
            ]
        }

        return validation_rules

    def generate_ai_vision_config(self) -> Dict[str, Any]:
        """Generate configuration for AI vision processing"""

        categorized_fields, categories = self.categorize_fields_by_pattern()
        page_analysis = self.analyze_by_pages()
        validation_rules = self.identify_field_validation_rules()

        # Generate priority-based processing order
        priority_order = {
            'HIGH': [],
            'MEDIUM': [],
            'LOW': []
        }

        for category, fields in categorized_fields.items():
            if category == 'UNCATEGORIZED':
                continue

            if fields:
                priority = fields[0].get('priority', 'MEDIUM')
                priority_order[priority].append({
                    'category': category,
                    'description': categories[category]['description'],
                    'field_count': len(fields),
                    'validation_rules': validation_rules.get(category, [])
                })

        return {
            'section_metadata': self.fields_data.get('metadata', {}),
            'field_analysis': {
                'total_fields': len(self.fields_data.get('fields', [])),
                'categorized_fields': {k: len(v) for k, v in categorized_fields.items() if k != 'UNCATEGORIZED'},
                'uncategorized_count': len(categorized_fields.get('UNCATEGORIZED', [])),
                'categories': categories
            },
            'page_analysis': page_analysis,
            'processing_priority': priority_order,
            'ai_vision_config': {
                'glm45v_settings': {
                    'field_detection_threshold': 0.95,
                    'coordinate_tolerance': 0.5,
                    'confidence_threshold': 0.9,
                    'batch_size': 50,
                    'parallel_processing': True
                },
                'extraction_strategies': {
                    'text_fields': {
                        'method': 'ocr_with_context',
                        'confidence_threshold': 0.9,
                        'post_processing': ['clean_text', 'validate_format']
                    },
                    'date_fields': {
                        'method': 'pattern_matching',
                        'formats': ['MM/DD/YYYY', 'MM/YYYY', 'YYYY'],
                        'validation': 'date_range_check'
                    },
                    'phone_fields': {
                        'method': 'phone_pattern_extraction',
                        'formats': ['(xxx) xxx-xxxx', 'xxx-xxx-xxxx'],
                        'validation': 'phone_format_check'
                    },
                    'address_fields': {
                        'method': 'address_parser',
                        'components': ['street', 'city', 'state', 'zip'],
                        'validation': 'address_verification'
                    }
                },
                'quality_assurance': {
                    'cross_field_validation': True,
                    'section_integrity_check': True,
                    'automated_testing': True,
                    'manual_review_threshold': 0.85
                }
            },
            'implementation_plan': self.generate_implementation_plan(categorized_fields, categories)
        }

    def generate_implementation_plan(self, categorized_fields: Dict, categories: Dict) -> Dict[str, Any]:
        """Generate step-by-step implementation plan"""

        total_fields = sum(len(fields) for cat, fields in categorized_fields.items() if cat != 'UNCATEGORIZED')

        return {
            'phase_1_critical': {
                'description': 'Process High-Priority Field Categories',
                'categories': [cat for cat in categories.keys() if categorized_fields.get(cat) and
                              categorized_fields[cat][0].get('priority') == 'HIGH'],
                'estimated_fields': sum(len(categorized_fields.get(cat, []))
                                      for cat in categories.keys()
                                      if categorized_fields.get(cat) and
                                      categorized_fields[cat][0].get('priority') == 'HIGH'),
                'timeline': '2-3 days',
                'success_criteria': '95% field extraction accuracy'
            },
            'phase_2_comprehensive': {
                'description': 'Process Medium-Priority Field Categories',
                'categories': [cat for cat in categories.keys() if categorized_fields.get(cat) and
                              categorized_fields[cat][0].get('priority') == 'MEDIUM'],
                'estimated_fields': sum(len(categorized_fields.get(cat, []))
                                      for cat in categories.keys()
                                      if categorized_fields.get(cat) and
                                      categorized_fields[cat][0].get('priority') == 'MEDIUM'),
                'timeline': '1-2 days',
                'success_criteria': '90% field extraction accuracy'
            },
            'phase_3_completion': {
                'description': 'Process Low-Priority and Uncategorized Fields',
                'categories': ['UNCATEGORIZED'] + [cat for cat in categories.keys() if categorized_fields.get(cat) and
                                                   categorized_fields[cat][0].get('priority') == 'LOW'],
                'estimated_fields': len(categorized_fields.get('UNCATEGORIZED', [])) +
                                 sum(len(categorized_fields.get(cat, []))
                                     for cat in categories.keys()
                                     if categorized_fields.get(cat) and
                                     categorized_fields[cat][0].get('priority') == 'LOW'),
                'timeline': '1 day',
                'success_criteria': '85% field extraction accuracy'
            },
            'validation_phase': {
                'description': 'Comprehensive Quality Assurance',
                'activities': [
                    'Cross-reference with clarance-f baseline',
                    'Automated integrity checking',
                    'Performance benchmarking',
                    'Error recovery testing'
                ],
                'timeline': '1 day',
                'success_criteria': '100% field coverage with <5% error rate'
            }
        }

    def generate_detailed_field_report(self) -> str:
        """Generate comprehensive field analysis report"""

        config = self.generate_ai_vision_config()

        report = f"""
# SECTION 13 COMPREHENSIVE FIELD ANALYSIS REPORT
## AI Vision Integration for PDF Mapper Integrity Restoration

### EXECUTIVE SUMMARY
- **Total Fields Analyzed**: {config['field_analysis']['total_fields']}
- **Successfully Categorized**: {sum(config['field_analysis']['categorized_fields'].values())}
- **Uncategorized**: {config['field_analysis']['uncategorized_count']}
- **Page Coverage**: {min(config['page_analysis'].keys())} - {max(config['page_analysis'].keys())}
- **Processing Priority**: {len(config['processing_priority']['HIGH'])} High, {len(config['processing_priority']['MEDIUM'])} Medium, {len(config['processing_priority']['LOW'])} Low

### FIELD CATEGORIZATION BREAKDOWN
"""

        for category, count in config['field_analysis']['categorized_fields'].items():
            if count > 0:
                report += f"**{category}**: {count} fields\n"

        report += f"""
### PAGE ANALYSIS SUMMARY
"""

        for page, analysis in config['page_analysis'].items():
            report += f"**Page {page}**: {analysis['field_count']} fields, Avg Confidence: {analysis['confidence_sum']/analysis['field_count']:.3f}\n"

        report += f"""
### AI VISION PROCESSING CONFIGURATION

#### GLM4.5V Settings
- Field Detection Threshold: {config['ai_vision_config']['glm45v_settings']['field_detection_threshold']}
- Coordinate Tolerance: {config['ai_vision_config']['glm45v_settings']['coordinate_tolerance']}px
- Confidence Threshold: {config['ai_vision_config']['glm45v_settings']['confidence_threshold']}
- Batch Processing: {config['ai_vision_config']['glm45v_settings']['batch_size']} fields/batch

#### Implementation Timeline
"""

        for phase, details in config['implementation_plan'].items():
            if 'estimated_fields' in details:
                report += f"**{phase.replace('_', ' ').title()}**: {details['estimated_fields']} fields, {details['timeline']}\n"
            else:
                report += f"**{phase.replace('_', ' ').title()}**: {details['timeline']}\n"

        report += f"""
### NEXT STEPS
1. Configure GLM4.5V with above specifications
2. Implement field extraction algorithms by category
3. Establish validation checkpoints with clarance-f baseline
4. Execute phased processing plan
5. Perform comprehensive quality assurance

### SUCCESS CRITERIA
- 100% field coverage (1,086/1,086 fields)
- >90% extraction accuracy for high-priority fields
- <5% error rate after validation phase
- Complete alignment with clarance-f reference implementation
"""

        return report

    def save_analysis_report(self, output_path: str = None):
        """Save comprehensive analysis report"""
        if output_path is None:
            output_path = self.section_json_path.replace('.json', '_analysis_report.md')

        report = self.generate_detailed_field_report()

        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(report)
            print(f"Analysis report saved to: {output_path}")
            return True
        except Exception as e:
            print(f"Error saving report: {e}")
            return False

def main():
    if len(sys.argv) != 2:
        print("Usage: python section-13-field-analyzer.py <section-13.json>")
        sys.exit(1)

    section_json_path = sys.argv[1]

    print("SECTION 13 COMPREHENSIVE FIELD ANALYSIS")
    print("=" * 50)
    print()

    analyzer = Section13FieldAnalyzer(section_json_path)

    # Load section data
    if not analyzer.load_section_data():
        sys.exit(1)

    # Analyze fields
    print("Analyzing field patterns and categorization...")
    categorized_fields, categories = analyzer.categorize_fields_by_pattern()

    categorized_count = sum(len(v) for k, v in categorized_fields.items() if k != 'UNCATEGORIZED')
    uncategorized_count = len(categorized_fields.get('UNCATEGORIZED', []))

    print(f"Categorized {categorized_count} fields")
    print(f"Uncategorized: {uncategorized_count} fields")
    print()

    # Page analysis
    print("Analyzing page distribution...")
    page_analysis = analyzer.analyze_by_pages()
    print(f"Fields span {len(page_analysis)} pages")
    print()

    # Generate AI vision config
    print("Generating AI vision integration configuration...")
    ai_config = analyzer.generate_ai_vision_config()
    print("Configuration generated")
    print()

    # Save analysis report
    print("Saving comprehensive analysis report...")
    if analyzer.save_analysis_report():
        print("Analysis complete!")
        print()
        print("SUMMARY:")
        print(f"   Total Fields: {ai_config['field_analysis']['total_fields']}")
        print(f"   Categories: {len([k for k, v in ai_config['field_analysis']['categorized_fields'].items() if v > 0])}")
        print(f"   Pages: {len(ai_config['page_analysis'])}")
        print(f"   High Priority: {len(ai_config['processing_priority']['HIGH'])} categories")
    else:
        print("Failed to save report")
        sys.exit(1)

if __name__ == '__main__':
    main()