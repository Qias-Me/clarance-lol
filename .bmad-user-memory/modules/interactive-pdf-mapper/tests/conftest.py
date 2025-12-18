import pytest
from pathlib import Path


@pytest.fixture
def sample_pdf_path():
    """
    Provide path to sample test PDF.

    Returns:
        Path
            Path to test PDF file.
    """
    return Path(__file__).parent.parent.parent.parent / "samples" / "test-pdfs" / "clean.pdf"


@pytest.fixture
def temp_output_dir(tmp_path):
    """
    Provide temporary output directory.

    Args:
        tmp_path: Path
            Pytest temporary path fixture.

    Returns:
        Path
            Temporary directory for test outputs.
    """
    output_dir = tmp_path / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


@pytest.fixture
def mock_glm_config():
    """
    Provide mock GLM configuration.

    Returns:
        dict
            Mock configuration dictionary.
    """
    return {
        "api_key": "test-api-key",
        "api_url": "https://api.example.com/v1/vision",
        "model_name": "glm-4v-6",
        "max_tokens": 4096,
        "temperature": 0.1,
    }


@pytest.fixture
def sample_coordinates():
    """
    Provide sample coordinate data.

    Returns:
        dict
            Sample coordinate dictionary.
    """
    return {
        "x": 100.0,
        "y": 200.0,
        "width": 150.0,
        "height": 25.0,
    }


@pytest.fixture
def sample_field_hierarchy():
    """
    Provide sample field hierarchy.

    Returns:
        dict
            Sample hierarchy dictionary.
    """
    return {
        "section": "Personal Information",
        "subsection": "Contact Details",
        "entry": None,
        "field_name": "email_address",
    }
