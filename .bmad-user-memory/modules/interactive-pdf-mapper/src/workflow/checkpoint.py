import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..core.exceptions import CheckpointError
from ..core.types import (
    Coordinates,
    CSSCoordinates,
    DetectedField,
    FieldHierarchy,
    FieldType,
    PageInfo,
    ValidationStatus,
)
from .state import PhaseProgress, StateManager, WorkflowPhase, WorkflowState


class CheckpointManager:
    """
    Manages workflow checkpoint persistence.

    Handles saving and restoring workflow state for
    crash recovery and session resumption.
    """

    def __init__(self, checkpoint_folder: str):
        """
        Initialize checkpoint manager.

        Args:
            checkpoint_folder: str
                Directory for checkpoint files.
        """
        self._checkpoint_folder = Path(checkpoint_folder)

    def save_checkpoint(self, state_manager: StateManager) -> str:
        """
        Save current workflow state to checkpoint.

        Args:
            state_manager: StateManager
                State manager with current state.

        Returns:
            str
                Path to checkpoint file.

        Raises:
            CheckpointError
                If save fails.
        """
        self._checkpoint_folder.mkdir(parents=True, exist_ok=True)

        state = state_manager.state
        checkpoint_path = self._checkpoint_folder / f"{state.workflow_id}.json"

        try:
            data = self._serialize_state(state)
            with open(checkpoint_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
            return str(checkpoint_path)
        except Exception as e:
            raise CheckpointError("save", state.workflow_id, str(e))

    def load_checkpoint(self, workflow_id: str) -> Optional[WorkflowState]:
        """
        Load workflow state from checkpoint.

        Args:
            workflow_id: str
                Workflow identifier to load.

        Returns:
            Optional[WorkflowState]
                Restored state or None if not found.

        Raises:
            CheckpointError
                If load fails.
        """
        checkpoint_path = self._checkpoint_folder / f"{workflow_id}.json"

        if not checkpoint_path.exists():
            return None

        try:
            with open(checkpoint_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._deserialize_state(data)
        except Exception as e:
            raise CheckpointError("load", workflow_id, str(e))

    def delete_checkpoint(self, workflow_id: str) -> bool:
        """
        Delete checkpoint file.

        Args:
            workflow_id: str
                Workflow identifier to delete.

        Returns:
            bool
                True if deleted, False if not found.
        """
        checkpoint_path = self._checkpoint_folder / f"{workflow_id}.json"

        if checkpoint_path.exists():
            checkpoint_path.unlink()
            return True
        return False

    def list_checkpoints(self) -> list:
        """
        List all available checkpoints.

        Returns:
            list
                List of workflow IDs with checkpoints.
        """
        if not self._checkpoint_folder.exists():
            return []

        return [
            p.stem for p in self._checkpoint_folder.glob("*.json")
        ]

    def _serialize_state(self, state: WorkflowState) -> dict:
        """
        Serialize workflow state to dictionary.

        Args:
            state: WorkflowState
                State to serialize.

        Returns:
            dict
                Serialized state data.
        """
        return {
            "workflowId": state.workflow_id,
            "documentPath": state.document_path,
            "documentHash": state.document_hash,
            "currentPhase": state.current_phase.value,
            "phaseHistory": [
                self._serialize_phase_progress(p) for p in state.phase_history
            ],
            "pages": [self._serialize_page_info(p) for p in state.pages],
            "detectedFields": [
                self._serialize_field(f) for f in state.detected_fields
            ],
            "validatedFields": [
                self._serialize_field(f) for f in state.validated_fields
            ],
            "retryPool": [self._serialize_field(f) for f in state.retry_pool],
            "outputPaths": state.output_paths,
            "startedAt": state.started_at.isoformat(),
            "updatedAt": state.updated_at.isoformat(),
            "error": state.error,
        }

    def _deserialize_state(self, data: dict) -> WorkflowState:
        """
        Deserialize dictionary to workflow state.

        Args:
            data: dict
                Serialized state data.

        Returns:
            WorkflowState
                Restored state object.
        """
        return WorkflowState(
            workflow_id=data["workflowId"],
            document_path=data["documentPath"],
            document_hash=data.get("documentHash", ""),
            current_phase=WorkflowPhase(data["currentPhase"]),
            phase_history=[
                self._deserialize_phase_progress(p)
                for p in data.get("phaseHistory", [])
            ],
            pages=[
                self._deserialize_page_info(p) for p in data.get("pages", [])
            ],
            detected_fields=[
                self._deserialize_field(f) for f in data.get("detectedFields", [])
            ],
            validated_fields=[
                self._deserialize_field(f) for f in data.get("validatedFields", [])
            ],
            retry_pool=[
                self._deserialize_field(f) for f in data.get("retryPool", [])
            ],
            output_paths=data.get("outputPaths", {}),
            started_at=datetime.fromisoformat(data["startedAt"]),
            updated_at=datetime.fromisoformat(data["updatedAt"]),
            error=data.get("error"),
        )

    def _serialize_phase_progress(self, progress: PhaseProgress) -> dict:
        """
        Serialize phase progress.

        Args:
            progress: PhaseProgress
                Progress to serialize.

        Returns:
            dict
                Serialized progress.
        """
        return {
            "phase": progress.phase.value,
            "startedAt": progress.started_at.isoformat() if progress.started_at else None,
            "completedAt": progress.completed_at.isoformat() if progress.completed_at else None,
            "progressPercent": progress.progress_percent,
            "itemsTotal": progress.items_total,
            "itemsCompleted": progress.items_completed,
            "errorMessage": progress.error_message,
        }

    def _deserialize_phase_progress(self, data: dict) -> PhaseProgress:
        """
        Deserialize phase progress.

        Args:
            data: dict
                Serialized progress.

        Returns:
            PhaseProgress
                Restored progress.
        """
        return PhaseProgress(
            phase=WorkflowPhase(data["phase"]),
            started_at=datetime.fromisoformat(data["startedAt"]) if data.get("startedAt") else None,
            completed_at=datetime.fromisoformat(data["completedAt"]) if data.get("completedAt") else None,
            progress_percent=data.get("progressPercent", 0.0),
            items_total=data.get("itemsTotal", 0),
            items_completed=data.get("itemsCompleted", 0),
            error_message=data.get("errorMessage"),
        )

    def _serialize_page_info(self, page: PageInfo) -> dict:
        """
        Serialize page info.

        Args:
            page: PageInfo
                Page to serialize.

        Returns:
            dict
                Serialized page.
        """
        return {
            "pageNumber": page.page_number,
            "width": page.width,
            "height": page.height,
        }

    def _deserialize_page_info(self, data: dict) -> PageInfo:
        """
        Deserialize page info.

        Args:
            data: dict
                Serialized page.

        Returns:
            PageInfo
                Restored page.
        """
        return PageInfo(
            page_number=data["pageNumber"],
            width=data["width"],
            height=data["height"],
        )

    def _serialize_field(self, field: DetectedField) -> dict:
        """
        Serialize detected field.

        Args:
            field: DetectedField
                Field to serialize.

        Returns:
            dict
                Serialized field.
        """
        return {
            "fieldId": field.field_id,
            "fieldType": field.field_type.value,
            "coordinates": asdict(field.coordinates),
            "hierarchy": asdict(field.hierarchy),
            "pageNumber": field.page_number,
            "confidenceScore": field.confidence_score,
            "validationStatus": field.validation_status.value,
            "cssCoordinates": asdict(field.css_coordinates) if field.css_coordinates else None,
            "renderOrder": field.render_order,
            "tabIndex": field.tab_index,
            "label": field.label,
            "placeholder": field.placeholder,
        }

    def _deserialize_field(self, data: dict) -> DetectedField:
        """
        Deserialize detected field.

        Args:
            data: dict
                Serialized field.

        Returns:
            DetectedField
                Restored field.
        """
        coords_data = data["coordinates"]
        hierarchy_data = data["hierarchy"]
        css_data = data.get("cssCoordinates")

        return DetectedField(
            field_id=data["fieldId"],
            field_type=FieldType(data["fieldType"]),
            coordinates=Coordinates(
                x=coords_data["x"],
                y=coords_data["y"],
                width=coords_data["width"],
                height=coords_data["height"],
            ),
            hierarchy=FieldHierarchy(
                section=hierarchy_data["section"],
                subsection=hierarchy_data.get("subsection"),
                entry=hierarchy_data.get("entry"),
                field_name=hierarchy_data["field_name"],
            ),
            page_number=data["pageNumber"],
            confidence_score=data["confidenceScore"],
            validation_status=ValidationStatus(data["validationStatus"]),
            css_coordinates=CSSCoordinates(
                left=css_data["left"],
                top=css_data["top"],
                width=css_data["width"],
                height=css_data["height"],
            ) if css_data else None,
            render_order=data.get("renderOrder"),
            tab_index=data.get("tabIndex"),
            label=data.get("label"),
            placeholder=data.get("placeholder"),
        )
