from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from ..core.types import DetectedField, PageInfo


class WorkflowPhase(Enum):
    """
    Workflow execution phases.

    Attributes:
        INIT: str
            Initial setup phase.
        LOADING: str
            PDF loading phase.
        DETECTION: str
            Field detection phase.
        VALIDATION: str
            Coordinate validation phase.
        ORGANIZATION: str
            Hierarchy organization phase.
        OUTPUT: str
            Output generation phase.
        COMPLETE: str
            Workflow completed.
        ERROR: str
            Error state.
    """

    INIT = "init"
    LOADING = "loading"
    DETECTION = "detection"
    VALIDATION = "validation"
    ORGANIZATION = "organization"
    OUTPUT = "output"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class PhaseProgress:
    """
    Progress tracking for a single phase.

    Attributes:
        phase: WorkflowPhase
            Current phase.
        started_at: Optional[datetime]
            Phase start time.
        completed_at: Optional[datetime]
            Phase completion time.
        progress_percent: float
            Completion percentage.
        items_total: int
            Total items to process.
        items_completed: int
            Items completed.
        error_message: Optional[str]
            Error message if failed.
    """

    phase: WorkflowPhase
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_percent: float = 0.0
    items_total: int = 0
    items_completed: int = 0
    error_message: Optional[str] = None


@dataclass
class WorkflowState:
    """
    Complete workflow state container.

    Attributes:
        workflow_id: str
            Unique workflow identifier.
        document_path: str
            Path to source PDF.
        document_hash: str
            MD5 hash of PDF.
        current_phase: WorkflowPhase
            Active phase.
        phase_history: List[PhaseProgress]
            Completed phase records.
        pages: List[PageInfo]
            Processed page metadata.
        detected_fields: List[DetectedField]
            All detected fields.
        validated_fields: List[DetectedField]
            Fields passing validation.
        retry_pool: List[DetectedField]
            Fields requiring retry.
        output_paths: Dict[str, str]
            Generated output file paths.
        started_at: datetime
            Workflow start time.
        updated_at: datetime
            Last update time.
        error: Optional[str]
            Error message if failed.
    """

    workflow_id: str
    document_path: str
    document_hash: str = ""
    current_phase: WorkflowPhase = WorkflowPhase.INIT
    phase_history: List[PhaseProgress] = field(default_factory=list)
    pages: List[PageInfo] = field(default_factory=list)
    detected_fields: List[DetectedField] = field(default_factory=list)
    validated_fields: List[DetectedField] = field(default_factory=list)
    retry_pool: List[DetectedField] = field(default_factory=list)
    output_paths: Dict[str, str] = field(default_factory=dict)
    started_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    error: Optional[str] = None


class StateManager:
    """
    Manages workflow state transitions and tracking.

    Handles state updates, phase transitions, and
    progress tracking throughout workflow execution.
    """

    def __init__(self, workflow_id: str, document_path: str):
        """
        Initialize state manager.

        Args:
            workflow_id: str
                Unique workflow identifier.
            document_path: str
                Path to source PDF.
        """
        self._state = WorkflowState(
            workflow_id=workflow_id,
            document_path=document_path,
        )
        self._current_progress: Optional[PhaseProgress] = None

    @property
    def state(self) -> WorkflowState:
        """
        Get current workflow state.

        Returns:
            WorkflowState
                Current state snapshot.
        """
        return self._state

    def start_phase(self, phase: WorkflowPhase, total_items: int = 0):
        """
        Begin a new workflow phase.

        Args:
            phase: WorkflowPhase
                Phase to start.
            total_items: int
                Total items to process in phase.
        """
        if self._current_progress:
            self._current_progress.completed_at = datetime.now()
            self._state.phase_history.append(self._current_progress)

        self._current_progress = PhaseProgress(
            phase=phase,
            started_at=datetime.now(),
            items_total=total_items,
        )
        self._state.current_phase = phase
        self._state.updated_at = datetime.now()

    def update_progress(self, items_completed: int):
        """
        Update phase progress.

        Args:
            items_completed: int
                Number of items completed.
        """
        if self._current_progress:
            self._current_progress.items_completed = items_completed
            if self._current_progress.items_total > 0:
                self._current_progress.progress_percent = (
                    items_completed / self._current_progress.items_total * 100
                )
            self._state.updated_at = datetime.now()

    def complete_phase(self):
        """
        Mark current phase as complete.
        """
        if self._current_progress:
            self._current_progress.completed_at = datetime.now()
            self._current_progress.progress_percent = 100.0
            self._state.phase_history.append(self._current_progress)
            self._current_progress = None
            self._state.updated_at = datetime.now()

    def set_error(self, error_message: str):
        """
        Set workflow error state.

        Args:
            error_message: str
                Error description.
        """
        self._state.error = error_message
        self._state.current_phase = WorkflowPhase.ERROR
        if self._current_progress:
            self._current_progress.error_message = error_message
            self._current_progress.completed_at = datetime.now()
            self._state.phase_history.append(self._current_progress)
            self._current_progress = None
        self._state.updated_at = datetime.now()

    def set_document_hash(self, document_hash: str):
        """
        Set document hash.

        Args:
            document_hash: str
                MD5 hash of PDF.
        """
        self._state.document_hash = document_hash
        self._state.updated_at = datetime.now()

    def set_pages(self, pages: List[PageInfo]):
        """
        Set page metadata.

        Args:
            pages: List[PageInfo]
                Page information list.
        """
        self._state.pages = pages
        self._state.updated_at = datetime.now()

    def set_detected_fields(self, fields: List[DetectedField]):
        """
        Set detected fields.

        Args:
            fields: List[DetectedField]
                Detected field list.
        """
        self._state.detected_fields = fields
        self._state.updated_at = datetime.now()

    def set_validated_fields(
        self,
        validated: List[DetectedField],
        retry_pool: List[DetectedField],
    ):
        """
        Set validation results.

        Args:
            validated: List[DetectedField]
                Fields passing validation.
            retry_pool: List[DetectedField]
                Fields requiring retry.
        """
        self._state.validated_fields = validated
        self._state.retry_pool = retry_pool
        self._state.updated_at = datetime.now()

    def add_output_path(self, output_type: str, path: str):
        """
        Add generated output path.

        Args:
            output_type: str
                Type of output (golden_map, qa_report, metrics).
            path: str
                Path to generated file.
        """
        self._state.output_paths[output_type] = path
        self._state.updated_at = datetime.now()

    def get_elapsed_time(self) -> float:
        """
        Get total elapsed time in seconds.

        Returns:
            float
                Elapsed seconds since start.
        """
        return (datetime.now() - self._state.started_at).total_seconds()

    def get_phase_duration(self, phase: WorkflowPhase) -> Optional[float]:
        """
        Get duration of a completed phase.

        Args:
            phase: WorkflowPhase
                Phase to query.

        Returns:
            Optional[float]
                Duration in seconds or None if not found.
        """
        for progress in self._state.phase_history:
            if progress.phase == phase and progress.completed_at and progress.started_at:
                return (progress.completed_at - progress.started_at).total_seconds()
        return None
