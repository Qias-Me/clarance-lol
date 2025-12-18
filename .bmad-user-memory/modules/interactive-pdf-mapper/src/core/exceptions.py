class PDFMapperError(Exception):
    """Base exception for all PDF Mapper errors."""

    pass


class PDFLoadError(PDFMapperError):
    """
    Raised when PDF file cannot be loaded or accessed.

    Attributes:
        path: str
            Path to the PDF that failed to load.
        reason: str
            Description of why loading failed.
    """

    def __init__(self, path: str, reason: str):
        """
        Initialize PDF load error.

        Args:
            path: str
                Path to the PDF that failed to load.
            reason: str
                Description of why loading failed.
        """
        self.path = path
        self.reason = reason
        super().__init__(f"Failed to load PDF at '{path}': {reason}")


class VisionAPIError(PDFMapperError):
    """
    Raised when GLM4.6v API call fails.

    Attributes:
        endpoint: str
            API endpoint that was called.
        status_code: int
            HTTP status code returned.
        message: str
            Error message from API.
    """

    def __init__(self, endpoint: str, status_code: int, message: str):
        """
        Initialize vision API error.

        Args:
            endpoint: str
                API endpoint that was called.
            status_code: int
                HTTP status code returned.
            message: str
                Error message from API.
        """
        self.endpoint = endpoint
        self.status_code = status_code
        self.message = message
        super().__init__(f"GLM4.6v API error [{status_code}] at {endpoint}: {message}")


class ValidationError(PDFMapperError):
    """
    Raised when field validation fails after all retries.

    Attributes:
        field_id: str
            Identifier of the field that failed validation.
        attempts: int
            Number of retry attempts made.
        last_difference: float
            Coordinate difference on final attempt.
    """

    def __init__(self, field_id: str, attempts: int, last_difference: float):
        """
        Initialize validation error.

        Args:
            field_id: str
                Identifier of the field that failed validation.
            attempts: int
                Number of retry attempts made.
            last_difference: float
                Coordinate difference on final attempt.
        """
        self.field_id = field_id
        self.attempts = attempts
        self.last_difference = last_difference
        super().__init__(
            f"Field '{field_id}' failed validation after {attempts} attempts "
            f"(difference: {last_difference:.2f}px)"
        )


class CheckpointError(PDFMapperError):
    """
    Raised when checkpoint save or load fails.

    Attributes:
        operation: str
            Either 'save' or 'load'.
        path: str
            Path to checkpoint file.
        reason: str
            Description of failure.
    """

    def __init__(self, operation: str, path: str, reason: str):
        """
        Initialize checkpoint error.

        Args:
            operation: str
                Either 'save' or 'load'.
            path: str
                Path to checkpoint file.
            reason: str
                Description of failure.
        """
        self.operation = operation
        self.path = path
        self.reason = reason
        super().__init__(f"Checkpoint {operation} failed at '{path}': {reason}")


class CacheError(PDFMapperError):
    """
    Raised when sidecar cache operations fail.

    Attributes:
        operation: str
            Cache operation that failed.
        cache_id: str
            Identifier of cache entry.
        reason: str
            Description of failure.
    """

    def __init__(self, operation: str, cache_id: str, reason: str):
        """
        Initialize cache error.

        Args:
            operation: str
                Cache operation that failed.
            cache_id: str
                Identifier of cache entry.
            reason: str
                Description of failure.
        """
        self.operation = operation
        self.cache_id = cache_id
        self.reason = reason
        super().__init__(f"Cache {operation} failed for '{cache_id}': {reason}")


class ConfigurationError(PDFMapperError):
    """
    Raised when configuration is invalid or missing.

    Attributes:
        parameter: str
            Name of invalid parameter.
        reason: str
            Description of why configuration is invalid.
    """

    def __init__(self, parameter: str, reason: str):
        """
        Initialize configuration error.

        Args:
            parameter: str
                Name of invalid parameter.
            reason: str
                Description of why configuration is invalid.
        """
        self.parameter = parameter
        self.reason = reason
        super().__init__(f"Configuration error for '{parameter}': {reason}")


class WorkflowStateError(PDFMapperError):
    """
    Raised when workflow state is invalid or corrupted.

    Attributes:
        current_step: int
            Step number where error occurred.
        expected_state: str
            Description of expected state.
        actual_state: str
            Description of actual state found.
    """

    def __init__(self, current_step: int, expected_state: str, actual_state: str):
        """
        Initialize workflow state error.

        Args:
            current_step: int
                Step number where error occurred.
            expected_state: str
                Description of expected state.
            actual_state: str
                Description of actual state found.
        """
        self.current_step = current_step
        self.expected_state = expected_state
        self.actual_state = actual_state
        super().__init__(
            f"Workflow state error at step {current_step}: "
            f"expected {expected_state}, found {actual_state}"
        )
