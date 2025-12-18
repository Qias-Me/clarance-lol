import asyncio
import uuid
from pathlib import Path
from typing import Callable, Optional

from ..cache.index import CacheIndex
from ..cache.sidecar import SidecarManager
from ..core.config import DiscoveryConfig
from ..core.exceptions import PDFLoadError, WorkflowStateError
from ..core.types import DetectedField, GoldenMapMetadata, ValidationStatus
from ..organization.css_converter import CSSConverter
from ..organization.hierarchy import HierarchyBuilder
from ..organization.render_order import RenderOrderCalculator
from ..output.golden_map import GoldenMapGenerator
from ..output.metrics import MetricsGenerator
from ..output.qa_report import QAReportGenerator
from ..pdf.loader import PDFLoader
from ..pdf.metadata import PDFMetadataExtractor
from ..pdf.renderer import PDFRenderer, RenderOptions
from ..validation.coordinator import ValidationCoordinator
from ..vision.detector import FieldDetector
from ..vision.glm_provider import GLMVisionProvider
from .checkpoint import CheckpointManager
from .state import StateManager, WorkflowPhase


class DiscoveryWorkflow:
    """
    Main workflow orchestrator for PDF field discovery.

    Coordinates all phases of the discovery process from
    PDF loading through golden map generation.
    """

    def __init__(self, config: DiscoveryConfig):
        """
        Initialize discovery workflow.

        Args:
            config: DiscoveryConfig
                Complete workflow configuration.
        """
        self._config = config
        self._state_manager: Optional[StateManager] = None
        self._checkpoint_manager = CheckpointManager(config.output.checkpoint_folder)
        self._cache_index = CacheIndex(config.cache.directory)
        self._sidecar_manager = SidecarManager(config.cache.directory)
        self._progress_callback: Optional[Callable[[WorkflowPhase, float, str], None]] = None

    def set_progress_callback(
        self,
        callback: Callable[[WorkflowPhase, float, str], None],
    ):
        """
        Set progress callback for UI updates.

        Args:
            callback: Callable[[WorkflowPhase, float, str], None]
                Callback receiving phase, progress percent, and message.
        """
        self._progress_callback = callback

    async def run(self, pdf_path: str, project_name: Optional[str] = None) -> dict:
        """
        Execute complete discovery workflow.

        Args:
            pdf_path: str
                Path to source PDF file.
            project_name: Optional[str]
                Project name for output files.

        Returns:
            dict
                Workflow results with output paths and metrics.

        Raises:
            PDFLoadError
                If PDF cannot be loaded.
            WorkflowStateError
                If workflow fails.
        """
        workflow_id = f"wf_{uuid.uuid4().hex[:12]}"
        self._state_manager = StateManager(workflow_id, pdf_path)

        if not project_name:
            project_name = Path(pdf_path).stem

        try:
            import sys
            print("[DEBUG] Checking cache...", flush=True)
            cache_result = await self._check_cache(pdf_path)
            if cache_result:
                return cache_result

            print("[DEBUG] Phase 1: Loading PDF...", flush=True)
            await self._phase_loading(pdf_path)
            print("[DEBUG] Phase 2: Detection...", flush=True)
            await self._phase_detection()
            print("[DEBUG] Phase 3: Validation...", flush=True)
            await self._phase_validation()
            print("[DEBUG] Phase 4: Organization...", flush=True)
            await self._phase_organization()
            print("[DEBUG] Phase 5: Output...", flush=True)
            output_paths = await self._phase_output(project_name)

            await self._cache_results(output_paths.get("golden_map", ""))

            self._state_manager.start_phase(WorkflowPhase.COMPLETE)
            self._state_manager.complete_phase()

            return self._build_result(output_paths)

        except Exception as e:
            if self._state_manager:
                self._state_manager.set_error(str(e))
                self._checkpoint_manager.save_checkpoint(self._state_manager)
            raise e

    async def resume(self, workflow_id: str) -> dict:
        """
        Resume workflow from checkpoint.

        Args:
            workflow_id: str
                Workflow identifier to resume.

        Returns:
            dict
                Workflow results.

        Raises:
            WorkflowStateError
                If checkpoint not found or resume fails.
        """
        state = self._checkpoint_manager.load_checkpoint(workflow_id)
        if not state:
            raise WorkflowStateError("resume", f"Checkpoint not found: {workflow_id}")

        self._state_manager = StateManager(state.workflow_id, state.document_path)
        self._state_manager._state = state

        current_phase = state.current_phase

        if current_phase == WorkflowPhase.ERROR:
            last_phase = state.phase_history[-1].phase if state.phase_history else WorkflowPhase.INIT
            current_phase = last_phase

        if current_phase in (WorkflowPhase.INIT, WorkflowPhase.LOADING):
            return await self.run(state.document_path)

        if current_phase == WorkflowPhase.DETECTION:
            await self._phase_detection()
            await self._phase_validation()
            await self._phase_organization()
            output_paths = await self._phase_output(Path(state.document_path).stem)

        elif current_phase == WorkflowPhase.VALIDATION:
            await self._phase_validation()
            await self._phase_organization()
            output_paths = await self._phase_output(Path(state.document_path).stem)

        elif current_phase == WorkflowPhase.ORGANIZATION:
            await self._phase_organization()
            output_paths = await self._phase_output(Path(state.document_path).stem)

        elif current_phase == WorkflowPhase.OUTPUT:
            output_paths = await self._phase_output(Path(state.document_path).stem)

        else:
            output_paths = state.output_paths

        self._checkpoint_manager.delete_checkpoint(workflow_id)
        return self._build_result(output_paths)

    async def _check_cache(self, pdf_path: str) -> Optional[dict]:
        """
        Check for cached golden map.

        Args:
            pdf_path: str
                Path to PDF file.

        Returns:
            Optional[dict]
                Cached result or None if not cached.
        """
        if not self._config.cache.enabled:
            return None

        with PDFLoader(pdf_path) as loader:
            extractor = PDFMetadataExtractor(loader.get_document(), pdf_path)
            metadata = extractor.extract()

        cache_entry = self._cache_index.get_entry(metadata.md5_hash)
        if cache_entry:
            cached_map = self._sidecar_manager.retrieve_golden_map(metadata.md5_hash)
            if cached_map:
                self._report_progress(WorkflowPhase.COMPLETE, 100.0, "Loaded from cache")
                return {
                    "status": "cached",
                    "golden_map": cached_map,
                    "cache_id": cache_entry.cache_id,
                }

        return None

    async def _phase_loading(self, pdf_path: str):
        """
        Execute PDF loading phase.

        Args:
            pdf_path: str
                Path to PDF file.
        """
        self._state_manager.start_phase(WorkflowPhase.LOADING, 3)
        self._report_progress(WorkflowPhase.LOADING, 0.0, "Loading PDF")

        with PDFLoader(pdf_path) as loader:
            self._state_manager.update_progress(1)

            extractor = PDFMetadataExtractor(loader.get_document(), pdf_path)
            metadata = extractor.extract()
            self._state_manager.set_document_hash(metadata.md5_hash)
            self._state_manager.update_progress(2)

            renderer = PDFRenderer(loader.get_document())
            render_options = RenderOptions(
                zoom_level=self._config.glm.zoom_level,
                contrast_enhancement=self._config.glm.enhance_contrast,
            )

            pages = []
            for page_num in range(loader.get_document().page_count):
                _, page_info = renderer.render_page(page_num, render_options)
                pages.append(page_info)

            self._state_manager.set_pages(pages)
            self._state_manager.update_progress(3)

        self._state_manager.complete_phase()
        self._report_progress(WorkflowPhase.LOADING, 100.0, "PDF loaded")

    async def _phase_detection(self):
        """
        Execute field detection phase.
        """
        state = self._state_manager.state
        page_count = len(state.pages)

        self._state_manager.start_phase(WorkflowPhase.DETECTION, page_count)
        self._report_progress(WorkflowPhase.DETECTION, 0.0, "Detecting fields")

        provider = GLMVisionProvider(self._config.glm)
        detector = FieldDetector(provider, self._config)

        def on_progress(progress):
            self._state_manager.update_progress(progress.page_number)
            percent = (progress.page_number / progress.total_pages * 100) if progress.total_pages > 0 else 0
            print(f"[DETECT] Page {progress.page_number}/{progress.total_pages} - {progress.fields_detected} fields", flush=True)
            self._report_progress(WorkflowPhase.DETECTION, percent, f"Page {progress.page_number}/{progress.total_pages}")

        with PDFLoader(state.document_path) as loader:
            renderer = PDFRenderer(loader.get_document())
            render_options = RenderOptions(
                zoom_level=self._config.glm.zoom_level,
                contrast_enhancement=self._config.glm.enhance_contrast,
            )

            page_images = []
            for page_num in range(len(loader.get_document())):
                image_data, _ = renderer.render_page(page_num, render_options)
                page_images.append(image_data)

            result = await detector.detect_all_pages(page_images, state.pages, on_progress)

        self._state_manager.set_detected_fields(result.fields)
        self._state_manager.complete_phase()
        self._report_progress(WorkflowPhase.DETECTION, 100.0, f"Detected {len(result.fields)} fields")

    async def _phase_validation(self):
        """
        Execute coordinate validation phase.
        """
        state = self._state_manager.state
        field_count = len(state.detected_fields)

        self._state_manager.start_phase(WorkflowPhase.VALIDATION, field_count)
        self._report_progress(WorkflowPhase.VALIDATION, 0.0, "Validating coordinates")

        provider = GLMVisionProvider(self._config.glm)
        coordinator = ValidationCoordinator(
            provider,
            self._config,
        )

        with PDFLoader(state.document_path) as loader:
            renderer = PDFRenderer(loader.get_document())
            render_options = RenderOptions(
                zoom_level=self._config.glm.zoom_level,
                contrast_enhancement=self._config.glm.enhance_contrast,
            )

            page_images = {}
            for page_num in range(len(loader.get_document())):
                image_data, _ = renderer.render_page(page_num, render_options)
                page_images[page_num + 1] = image_data

            summary = await coordinator.validate_all_fields(
                state.detected_fields,
                page_images,
            )

        validated = [
            f for f in state.detected_fields
            if f.validation_status == ValidationStatus.VALIDATED
        ]
        retry_pool = [
            f for f in state.detected_fields
            if f.validation_status in (ValidationStatus.FAILED, ValidationStatus.RETRY_EXHAUSTED)
        ]

        self._state_manager.set_validated_fields(validated, retry_pool)
        self._state_manager.complete_phase()
        self._report_progress(
            WorkflowPhase.VALIDATION,
            100.0,
            f"Validated {len(validated)}/{field_count} fields",
        )

    async def _phase_organization(self):
        """
        Execute hierarchy organization phase.
        """
        state = self._state_manager.state
        field_count = len(state.validated_fields)

        self._state_manager.start_phase(WorkflowPhase.ORGANIZATION, 3)
        self._report_progress(WorkflowPhase.ORGANIZATION, 0.0, "Organizing hierarchy")

        hierarchy_builder = HierarchyBuilder()
        hierarchy_builder.build_hierarchy(state.validated_fields)
        self._state_manager.update_progress(1)

        css_converter = CSSConverter(state.pages)
        for field in state.validated_fields:
            page_info = next(
                (p for p in state.pages if p.page_number == field.page_number),
                state.pages[0] if state.pages else None,
            )
            if page_info:
                field.css_coordinates = css_converter.convert(
                    field.coordinates,
                    page_info.width,
                    page_info.height,
                )
        self._state_manager.update_progress(2)

        order_calculator = RenderOrderCalculator()
        order_calculator.calculate_order(state.validated_fields)
        self._state_manager.update_progress(3)

        self._state_manager.complete_phase()
        self._report_progress(WorkflowPhase.ORGANIZATION, 100.0, "Hierarchy organized")

    async def _phase_output(self, project_name: str) -> dict:
        """
        Execute output generation phase.

        Args:
            project_name: str
                Project name for output files.

        Returns:
            dict
                Generated output file paths.
        """
        state = self._state_manager.state

        self._state_manager.start_phase(WorkflowPhase.OUTPUT, 3)
        self._report_progress(WorkflowPhase.OUTPUT, 0.0, "Generating outputs")

        output_folder = self._config.output.output_folder
        output_paths = {}

        from datetime import datetime

        accuracy = len(state.validated_fields) / len(state.detected_fields) * 100 if state.detected_fields else 100.0
        metadata = GoldenMapMetadata(
            created_date=datetime.now().isoformat(),
            last_validated=datetime.now().isoformat(),
            accuracy_score=accuracy,
            evolution_version=1,
            total_fields=len(state.validated_fields),
            total_sections=0,
            steps_completed=[1, 2, 3, 4, 5],
            pdf_path=state.document_path,
            sections_references_path=None,
            tolerance_pixels=self._config.validation.tolerance,
            workflow_complete=True,
        )

        golden_gen = GoldenMapGenerator(output_folder, project_name)
        golden_path = golden_gen.generate(
            document_id=state.document_hash,
            document_name=Path(state.document_path).name,
            pages=state.pages,
            sections=[],
            all_fields=state.validated_fields,
            metadata=metadata,
        )
        output_paths["golden_map"] = golden_path
        self._state_manager.add_output_path("golden_map", golden_path)
        self._state_manager.update_progress(1)

        detection_time = int((self._state_manager.get_phase_duration(WorkflowPhase.DETECTION) or 0) * 1000)
        validation_time = int((self._state_manager.get_phase_duration(WorkflowPhase.VALIDATION) or 0) * 1000)
        organization_time = int((self._state_manager.get_phase_duration(WorkflowPhase.ORGANIZATION) or 0) * 1000)
        total_processing_time = detection_time + validation_time + organization_time

        from ..validation.coordinator import ValidationSummary
        validation_summary = ValidationSummary(
            total_fields=len(state.detected_fields),
            passed=len(state.validated_fields),
            skipped=len(state.retry_pool),
            accuracy=accuracy,
            retry_pool_count=len(state.retry_pool),
            max_retries_used=0,
        )

        qa_gen = QAReportGenerator(output_folder, project_name)
        qa_path = qa_gen.generate(
            document_name=Path(state.document_path).name,
            fields=state.validated_fields,
            validation_summary=validation_summary,
            processing_time_ms=total_processing_time,
        )
        output_paths["qa_report"] = qa_path
        self._state_manager.add_output_path("qa_report", qa_path)
        self._state_manager.update_progress(2)

        metrics_gen = MetricsGenerator(output_folder, project_name)
        metrics_path = metrics_gen.generate(
            state.document_hash,
            state.pages,
            state.validated_fields,
            validation_summary,
            detection_time,
            validation_time,
            organization_time,
        )
        output_paths["metrics"] = metrics_path
        self._state_manager.add_output_path("metrics", metrics_path)
        self._state_manager.update_progress(3)

        self._state_manager.complete_phase()
        self._report_progress(WorkflowPhase.OUTPUT, 100.0, "Outputs generated")

        return output_paths

    async def _cache_results(self, golden_map_path: str):
        """
        Cache golden map for future use.

        Args:
            golden_map_path: str
                Path to generated golden map.
        """
        if not self._config.cache.enabled or not golden_map_path:
            return

        state = self._state_manager.state

        cache_id = self._sidecar_manager.store_golden_map(
            state.document_hash,
            golden_map_path,
        )

        self._cache_index.add_entry(
            cache_id=cache_id,
            document_hash=state.document_hash,
            document_name=Path(state.document_path).name,
            golden_map_path=golden_map_path,
            field_count=len(state.validated_fields),
            accuracy_score=len(state.validated_fields) / len(state.detected_fields) * 100 if state.detected_fields else 0,
        )

    def _build_result(self, output_paths: dict) -> dict:
        """
        Build final workflow result.

        Args:
            output_paths: dict
                Generated output file paths.

        Returns:
            dict
                Complete workflow result.
        """
        state = self._state_manager.state

        return {
            "status": "complete",
            "workflow_id": state.workflow_id,
            "document_hash": state.document_hash,
            "output_paths": output_paths,
            "metrics": {
                "total_pages": len(state.pages),
                "total_fields": len(state.detected_fields),
                "validated_fields": len(state.validated_fields),
                "retry_pool_size": len(state.retry_pool),
                "accuracy": len(state.validated_fields) / len(state.detected_fields) * 100 if state.detected_fields else 0,
                "elapsed_time": self._state_manager.get_elapsed_time(),
            },
        }

    def _report_progress(self, phase: WorkflowPhase, percent: float, message: str):
        """
        Report progress to callback.

        Args:
            phase: WorkflowPhase
                Current phase.
            percent: float
                Progress percentage.
            message: str
                Status message.
        """
        if self._progress_callback:
            self._progress_callback(phase, percent, message)
