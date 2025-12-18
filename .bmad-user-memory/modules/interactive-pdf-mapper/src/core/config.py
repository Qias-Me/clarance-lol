import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

from .exceptions import ConfigurationError
from .types import DetectionSensitivity, RetryParameters


@dataclass
class GLMConfig:
    """
    GLM4.6v API configuration.

    Attributes:
        api_key: str
            API key for GLM4.6v authentication.
        api_endpoint: str
            API endpoint URL.
        model: str
            Model version to use.
        timeout_seconds: int
            Request timeout in seconds.
        max_tokens: int
            Maximum tokens for response.
        temperature: float
            Model temperature for responses.
        zoom_level: float
            Default zoom level for rendering.
        enhance_contrast: bool
            Whether to enhance contrast by default.
        max_concurrent_requests: int
            Maximum concurrent API requests (GLM-4.6V limit is 10).
    """

    api_key: str = ""
    api_endpoint: str = "https://api.z.ai/api/anthropic"
    model: str = "glm-4.6v"
    timeout_seconds: int = 120
    max_tokens: int = 4096
    temperature: float = 0.1
    zoom_level: float = 1.5
    enhance_contrast: bool = True
    max_concurrent_requests: int = 1


@dataclass
class ValidationConfig:
    """
    Coordinate validation configuration.

    Attributes:
        tolerance: float
            Maximum allowed coordinate difference.
        max_retries: int
            Maximum validation retry attempts per field.
        confidence_threshold: float
            Minimum confidence score for validation.
    """

    tolerance: float = 0.5
    max_retries: int = 7
    confidence_threshold: float = 0.85


@dataclass
class CacheConfig:
    """
    Cache configuration.

    Attributes:
        directory: str
            Directory for cache files.
        enabled: bool
            Whether caching is enabled.
        ttl: int
            Cache time-to-live in milliseconds.
        max_size_mb: int
            Maximum cache size in megabytes.
    """

    directory: str = "data/golden-maps"
    enabled: bool = True
    ttl: int = 3600000
    max_size_mb: int = 1000


@dataclass
class OutputConfig:
    """
    Output file configuration.

    Attributes:
        output_folder: str
            Directory for output files.
        checkpoint_folder: str
            Directory for checkpoint files.
        component_format: str
            Output format for React components.
    """

    output_folder: str = "./output"
    checkpoint_folder: str = "./checkpoints"
    component_format: str = "typescript"


@dataclass
class LogConfig:
    """
    Logging configuration.

    Attributes:
        verbosity: str
            Log verbosity level.
        file_path: str
            Path to log file.
    """

    verbosity: str = "standard"
    file_path: str = "./logs/interactive-pdf-mapper.log"


@dataclass
class DiscoveryConfig:
    """
    Complete discovery workflow configuration.

    Attributes:
        glm: GLMConfig
            GLM4.6v API settings.
        validation: ValidationConfig
            Validation settings.
        cache: CacheConfig
            Cache settings.
        output: OutputConfig
            Output file settings.
        log: LogConfig
            Logging settings.
        max_concurrent_tasks: int
            Maximum concurrent processing tasks.
        retry_parameters: Dict[int, RetryParameters]
            Parameters for each retry attempt.
    """

    glm: GLMConfig = field(default_factory=GLMConfig)
    validation: ValidationConfig = field(default_factory=ValidationConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    output: OutputConfig = field(default_factory=OutputConfig)
    log: LogConfig = field(default_factory=LogConfig)
    max_concurrent_tasks: int = 3
    retry_parameters: Dict[int, RetryParameters] = field(default_factory=dict)

    def __post_init__(self):
        """
        Initialize default retry parameters if not provided.
        """
        if not self.retry_parameters:
            self.retry_parameters = self._default_retry_parameters()

    def _default_retry_parameters(self) -> Dict[int, RetryParameters]:
        """
        Generate default retry parameters for 7 attempts.

        Returns:
            Dict[int, RetryParameters]
                Mapping of attempt number to parameters.
        """
        return {
            1: RetryParameters(
                confidence_threshold=0.95,
                detection_sensitivity=DetectionSensitivity.NORMAL,
            ),
            2: RetryParameters(
                confidence_threshold=0.90,
                detection_sensitivity=DetectionSensitivity.HIGH,
            ),
            3: RetryParameters(
                confidence_threshold=0.85,
                detection_sensitivity=DetectionSensitivity.HIGH,
                zoom_level=1.5,
            ),
            4: RetryParameters(
                confidence_threshold=0.80,
                detection_sensitivity=DetectionSensitivity.VERY_HIGH,
                zoom_level=2.0,
            ),
            5: RetryParameters(
                confidence_threshold=0.75,
                detection_sensitivity=DetectionSensitivity.VERY_HIGH,
                zoom_level=2.0,
                contrast_enhancement=True,
            ),
            6: RetryParameters(
                confidence_threshold=0.70,
                detection_sensitivity=DetectionSensitivity.MAXIMUM,
                zoom_level=2.5,
                contrast_enhancement=True,
            ),
            7: RetryParameters(
                confidence_threshold=0.65,
                detection_sensitivity=DetectionSensitivity.MAXIMUM,
                zoom_level=3.0,
                contrast_enhancement=True,
                edge_detection=True,
            ),
        }


class ConfigLoader:
    """
    Configuration loader for .env.local file.
    """

    @staticmethod
    def _find_env_file() -> Optional[Path]:
        """
        Find .env.local file by traversing up from module directory.

        Returns:
            Optional[Path]
                Path to .env.local or None if not found.
        """
        current = Path(__file__).resolve()

        for _ in range(10):
            current = current.parent
            env_path = current / ".env.local"
            if env_path.exists():
                return env_path

        return None

    @staticmethod
    def _load_dotenv(env_path: Path):
        """
        Load environment variables from .env.local file.

        Args:
            env_path: Path
                Path to .env.local file.
        """
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue

                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip()

                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]

                os.environ.setdefault(key, value)

    @staticmethod
    def load(env_path: Optional[str] = None) -> DiscoveryConfig:
        """
        Load configuration from .env.local file.

        Args:
            env_path: Optional[str]
                Path to .env.local file. Auto-detected if not provided.

        Returns:
            DiscoveryConfig
                Loaded configuration object.

        Raises:
            ConfigurationError
                If required configuration is missing.
        """
        if env_path:
            path = Path(env_path)
        else:
            path = ConfigLoader._find_env_file()

        if path and path.exists():
            ConfigLoader._load_dotenv(path)

        api_key = os.environ.get("GLM45V_API_KEY", "")
        if not api_key:
            raise ConfigurationError("GLM45V_API_KEY", "Not set in .env.local")

        glm_config = GLMConfig(
            api_key=api_key,
            api_endpoint=os.environ.get("GLM45V_ENDPOINT", GLMConfig.api_endpoint),
            model=os.environ.get("GLM45V_MODEL", GLMConfig.model),
            timeout_seconds=int(os.environ.get("GLM45V_TIMEOUT", GLMConfig.timeout_seconds)),
            max_tokens=int(os.environ.get("GLM45V_MAX_TOKENS", GLMConfig.max_tokens)),
            temperature=float(os.environ.get("GLM45V_TEMPERATURE", GLMConfig.temperature)),
            zoom_level=float(os.environ.get("GLM45V_ZOOM_LEVEL", GLMConfig.zoom_level)),
            enhance_contrast=os.environ.get("GLM45V_ENHANCE_CONTRAST", "true").lower() == "true",
        )

        validation_config = ValidationConfig(
            tolerance=float(os.environ.get("VALIDATION_TOLERANCE", ValidationConfig.tolerance)),
            max_retries=int(os.environ.get("VALIDATION_MAX_RETRIES", ValidationConfig.max_retries)),
            confidence_threshold=float(os.environ.get("VALIDATION_CONFIDENCE", ValidationConfig.confidence_threshold)),
        )

        cache_config = CacheConfig(
            directory=os.environ.get("CACHE_DIRECTORY", CacheConfig.directory),
            enabled=os.environ.get("CACHE_ENABLED", "true").lower() == "true",
            ttl=int(os.environ.get("CACHE_TTL", CacheConfig.ttl)),
            max_size_mb=int(os.environ.get("CACHE_MAX_SIZE_MB", CacheConfig.max_size_mb)),
        )

        output_config = OutputConfig(
            output_folder=os.environ.get("OUTPUT_FOLDER", OutputConfig.output_folder),
            checkpoint_folder=os.environ.get("CHECKPOINT_FOLDER", OutputConfig.checkpoint_folder),
            component_format=os.environ.get("COMPONENT_OUTPUT_FORMAT", OutputConfig.component_format),
        )

        log_config = LogConfig(
            verbosity=os.environ.get("LOG_VERBOSITY", LogConfig.verbosity),
            file_path=os.environ.get("LOG_FILE_PATH", LogConfig.file_path),
        )

        return DiscoveryConfig(
            glm=glm_config,
            validation=validation_config,
            cache=cache_config,
            output=output_config,
            log=log_config,
            max_concurrent_tasks=int(os.environ.get("MAX_CONCURRENT_TASKS", 3)),
        )
