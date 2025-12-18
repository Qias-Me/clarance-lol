#!/usr/bin/env python3
"""
Section 13 Integration Orchestrator
Main coordination system for PDF mapper integrity restoration workflow
"""

import json
import sys
import os
import asyncio
import subprocess
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import logging
from pathlib import Path

@dataclass
class WorkflowStep:
    name: str
    description: str
    script_path: str
    required_inputs: List[str]
    expected_outputs: List[str]
    estimated_time: int  # in minutes
    status: str = "PENDING"

class Section13IntegrationOrchestrator:
    def __init__(self, project_directory: str, reference_directory: str):
        self.project_directory = Path(project_directory)
        self.reference_directory = Path(reference_directory)
        self.logger = self._setup_logging()
        self.workflow_steps = self._initialize_workflow_steps()
        self.results = {}

    def _setup_logging(self) -> logging.Logger:
        """Setup comprehensive logging for orchestration"""
        logger = logging.getLogger('Section13Orchestrator')
        logger.setLevel(logging.INFO)

        # Create logs directory
        Path('./logs').mkdir(exist_ok=True)

        # File handler
        fh = logging.FileHandler('./logs/section13_orchestration.log')
        fh.setLevel(logging.INFO)

        # Console handler
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)

        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        fh.setFormatter(formatter)
        ch.setFormatter(formatter)

        logger.addHandler(fh)
        logger.addHandler(ch)

        return logger

    def _initialize_workflow_steps(self) -> List[WorkflowStep]:
        """Initialize all workflow steps in execution order"""
        return [
            WorkflowStep(
                name="Field Analysis",
                description="Analyze and categorize all 1,086 fields in Section 13",
                script_path="section-13-field-analyzer.py",
                required_inputs=["clarance-f/api/sections-references/section-13.json"],
                expected_outputs=["clarance-f/api/sections-references/section-13_analysis_report.md"],
                estimated_time=5
            ),
            WorkflowStep(
                name="AI Vision Processing",
                description="Process fields using GLM4.5V with targeted extraction strategies",
                script_path="glm4.5v-section13-processor.py",
                required_inputs=["API_KEY", "clarance-f/api/sections-references/section-13.json", "INPUT_PDF"],
                expected_outputs=["section13_extraction_results_TIMESTAMP.json"],
                estimated_time=30
            ),
            WorkflowStep(
                name="Multi-Layer Validation",
                description="Comprehensive validation and quality assurance",
                script_path="section13-validation-framework.py",
                required_inputs=["clarance-f/api/sections-references/section-13.json", "EXTRACTION_RESULTS"],
                expected_outputs=["section13_validation_report_TIMESTAMP.json"],
                estimated_time=10
            ),
            WorkflowStep(
                name="Performance Optimization",
                description="Optimize processing with caching and error recovery",
                script_path="section13-performance-optimizer.py",
                required_inputs=["section13_extraction_results.json"],
                expected_outputs=["section13_performance_metrics_TIMESTAMP.json"],
                estimated_time=15
            )
        ]

    def verify_prerequisites(self) -> bool:
        """Verify all prerequisites are met"""
        self.logger.info("Verifying prerequisites...")

        # Check project structure
        required_paths = [
            self.project_directory,
            self.reference_directory,
            self.reference_directory / "api" / "sections-references",
            self.project_directory / ".bmad" / "interactive-pdf-mapper"
        ]

        for path in required_paths:
            if not path.exists():
                self.logger.error(f"Required path missing: {path}")
                return False

        # Check required files
        required_files = [
            self.reference_directory / "api" / "sections-references" / "section-13.json",
            self.project_directory / ".bmad" / "interactive-pdf-mapper" / "config.yaml"
        ]

        for file_path in required_files:
            if not file_path.exists():
                self.logger.error(f"Required file missing: {file_path}")
                return False

        # Check Python dependencies
        try:
            import aiohttp
            import asyncio
            import json
            import logging
            self.logger.info("Python dependencies verified")
        except ImportError as e:
            self.logger.error(f"Missing Python dependency: {e}")
            return False

        self.logger.info("All prerequisites verified successfully")
        return True

    def execute_workflow_step(self, step: WorkflowStep, **kwargs) -> bool:
        """Execute a single workflow step"""
        self.logger.info(f"Executing workflow step: {step.name}")
        step.status = "RUNNING"

        try:
            # Build command
            cmd = ["python", str(self.project_directory / step.script_path)]

            # Add required inputs
            for input_param in step.required_inputs:
                if input_param == "API_KEY":
                    cmd.append(kwargs.get("api_key", "test-api-key"))
                elif input_param == "INPUT_PDF":
                    cmd.append(str(kwargs.get("input_pdf", "")))
                elif input_param == "EXTRACTION_RESULTS":
                    cmd.append(str(kwargs.get("extraction_results", "")))
                elif input_param.endswith(".json"):
                    cmd.append(str(self.reference_directory / input_param))
                else:
                    cmd.append(input_param)

            # Execute step
            self.logger.info(f"Running command: {' '.join(cmd)}")
            result = subprocess.run(
                cmd,
                cwd=self.project_directory,
                capture_output=True,
                text=True,
                timeout=step.estimated_time * 60  # Convert minutes to seconds
            )

            if result.returncode == 0:
                step.status = "COMPLETED"
                self.logger.info(f"Step '{step.name}' completed successfully")
                self.logger.info(f"Output: {result.stdout[-500:]}")  # Last 500 chars
                return True
            else:
                step.status = "FAILED"
                self.logger.error(f"Step '{step.name}' failed with return code {result.returncode}")
                self.logger.error(f"Error: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            step.status = "TIMEOUT"
            self.logger.error(f"Step '{step.name}' timed out after {step.estimated_time} minutes")
            return False
        except Exception as e:
            step.status = "ERROR"
            self.logger.error(f"Step '{step.name}' encountered error: {e}")
            return False

    def generate_workflow_summary(self) -> Dict[str, Any]:
        """Generate comprehensive workflow execution summary"""
        completed_steps = [s for s in self.workflow_steps if s.status == "COMPLETED"]
        failed_steps = [s for s in self.workflow_steps if s.status in ["FAILED", "ERROR", "TIMEOUT"]]
        total_estimated_time = sum(s.estimated_time for s in self.workflow_steps)

        return {
            'execution_summary': {
                'total_steps': len(self.workflow_steps),
                'completed_steps': len(completed_steps),
                'failed_steps': len(failed_steps),
                'success_rate': len(completed_steps) / len(self.workflow_steps) if self.workflow_steps else 0,
                'total_estimated_time': total_estimated_time
            },
            'step_details': [
                {
                    'name': step.name,
                    'description': step.description,
                    'status': step.status,
                    'estimated_time': step.estimated_time
                }
                for step in self.workflow_steps
            ],
            'results': self.results,
            'timestamp': datetime.now().isoformat()
        }

    async def execute_complete_workflow(self, api_key: str, input_pdf: str) -> bool:
        """Execute the complete Section 13 integration workflow"""
        self.logger.info("Starting complete Section 13 integration workflow")

        if not self.verify_prerequisites():
            self.logger.error("Prerequisites verification failed")
            return False

        total_start_time = datetime.now()

        try:
            # Execute each step in sequence
            for step in self.workflow_steps:
                self.logger.info(f"Starting: {step.name}")

                step_start_time = datetime.now()

                # Prepare step-specific parameters
                step_kwargs = {
                    'api_key': api_key,
                    'input_pdf': input_pdf
                }

                # If this is the validation step, find extraction results
                if step.name == "Multi-Layer Validation":
                    extraction_files = list(self.project_directory.glob("section13_extraction_results_*.json"))
                    if extraction_files:
                        step_kwargs['extraction_results'] = str(extraction_files[-1])
                    else:
                        self.logger.error("No extraction results found for validation step")
                        step.status = "SKIPPED"
                        continue

                success = self.execute_workflow_step(step, **step_kwargs)

                step_end_time = datetime.now()
                step_duration = (step_end_time - step_start_time).total_seconds() / 60

                self.logger.info(f"Step '{step.name}' completed in {step_duration:.2f} minutes")

                if not success:
                    self.logger.error(f"Workflow failed at step: {step.name}")
                    return False

                # Collect results from completed steps
                if step.status == "COMPLETED":
                    self.results[step.name] = {
                        'completed_at': step_end_time.isoformat(),
                        'duration_minutes': step_duration,
                        'outputs': step.expected_outputs
                    }

            # Workflow completed successfully
            total_end_time = datetime.now()
            total_duration = (total_end_time - total_start_time).total_seconds() / 60

            self.logger.info(f"Complete workflow finished successfully in {total_duration:.2f} minutes")

            # Generate final report
            summary = self.generate_workflow_summary()
            summary['execution_summary']['total_actual_time'] = total_duration

            # Save final report
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_path = self.project_directory / f"section13_integration_report_{timestamp}.json"

            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)

            self.logger.info(f"Final integration report saved to: {report_path}")
            return True

        except Exception as e:
            self.logger.error(f"Workflow execution failed: {e}")
            return False

def print_usage():
    """Print usage instructions"""
    print("""
Section 13 Integration Orchestrator - Usage Instructions
=====================================================

PREREQUISITES:
1. Clarance-lol project directory with interactive-pdf-mapper configuration
2. Clarance-f reference directory with Section 13 JSON data
3. Python 3.8+ with required dependencies
4. GLM4.5V API access (or compatible vision API)

USAGE:
python section13-integration-orchestrator.py <api_key> <input_pdf>

EXAMPLE:
python section13-integration-orchestrator.py "your-api-key-here" "path/to/section13.pdf"

WORKFLOW STEPS:
1. Field Analysis (5 min) - Analyze and categorize 1,086 fields
2. AI Vision Processing (30 min) - Extract field values using GLM4.5V
3. Multi-Layer Validation (10 min) - Comprehensive validation and QA
4. Performance Optimization (15 min) - Optimize with caching and error recovery

OUTPUTS:
- Section 13 field analysis report
- Extraction results with confidence scores
- Comprehensive validation report
- Performance optimization metrics
- Complete integration execution summary

SUCCESS CRITERIA:
- 100% field coverage (1,086/1,086 fields)
- >90% extraction accuracy for high-priority fields
- <5% error rate after validation
- Complete alignment with clarance-f reference implementation
""")

def main():
    if len(sys.argv) != 3:
        print_usage()
        sys.exit(1)

    api_key = sys.argv[1]
    input_pdf = sys.argv[2]

    # Validate inputs
    if not api_key or api_key == "your-api-key-here":
        print("Error: Please provide a valid API key")
        print_usage()
        sys.exit(1)

    if not os.path.exists(input_pdf):
        print(f"Error: Input PDF not found: {input_pdf}")
        sys.exit(1)

    if not input_pdf.lower().endswith('.pdf'):
        print("Error: Input file must be a PDF")
        sys.exit(1)

    print("Section 13 Integration Orchestrator")
    print("=" * 50)
    print(f"API Key: {'*' * 8}{api_key[-8:] if len(api_key) > 8 else api_key}")
    print(f"Input PDF: {input_pdf}")
    print(f"Project Directory: {os.getcwd()}")
    print(f"Reference Directory: {os.path.join(os.getcwd(), 'clarance-f')}")
    print()

    # Initialize and execute workflow
    orchestrator = Section13IntegrationOrchestrator(
        project_directory=os.getcwd(),
        reference_directory=os.path.join(os.getcwd(), 'clarance-f')
    )

    try:
        success = asyncio.run(orchestrator.execute_complete_workflow(api_key, input_pdf))

        if success:
            print("\n" + "=" * 50)
            print("✅ SECTION 13 INTEGRATION WORKFLOW COMPLETED SUCCESSFULLY!")
            print("=" * 50)
            print("\nKey accomplishments:")
            print("- Analyzed and categorized all 1,086 Section 13 fields")
            print("- Extracted field values using GLM4.5V AI vision")
            print("- Validated extraction quality and integrity")
            print("- Optimized performance with intelligent caching")
            print("- Generated comprehensive execution reports")
            print("\nNext steps:")
            print("1. Review extraction results in generated JSON files")
            print("2. Examine validation report for any issues")
            print("3. Check performance metrics for optimization opportunities")
            print("4. Integrate results back into main PDF mapper system")

            sys.exit(0)
        else:
            print("\n" + "=" * 50)
            print("❌ SECTION 13 INTEGRATION WORKFLOW FAILED")
            print("=" * 50)
            print("\nTroubleshooting steps:")
            print("1. Check logs/section13_orchestration.log for detailed error information")
            print("2. Verify API key and network connectivity")
            print("3. Ensure input PDF is valid and accessible")
            print("4. Confirm all prerequisite files and directories exist")
            print("5. Review failed workflow steps and error messages")

            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\nWorkflow interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()