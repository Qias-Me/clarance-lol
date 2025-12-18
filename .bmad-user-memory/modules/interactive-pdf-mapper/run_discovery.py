#!/usr/bin/env python3
import argparse
import asyncio
import sys
from pathlib import Path

from src.core.config import ConfigLoader
from src.workflow.discovery import DiscoveryWorkflow
from src.workflow.state import WorkflowPhase


def create_parser() -> argparse.ArgumentParser:
    """
    Create argument parser.

    Returns:
        argparse.ArgumentParser
            Configured argument parser.
    """
    parser = argparse.ArgumentParser(
        prog="run_discovery",
        description="PDF Field Discovery Workflow with GLM4.6v Vision",
    )

    parser.add_argument(
        "pdf_path",
        type=str,
        help="Path to PDF file to process",
    )

    parser.add_argument(
        "-p", "--project",
        type=str,
        default=None,
        help="Project name for output files (default: PDF filename)",
    )

    parser.add_argument(
        "-e", "--env",
        type=str,
        default="C:/Users/TJ/Desktop/clarance-lol/.env.local",
        help="Path to .env.local configuration file",
    )

    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable cache lookup and storage",
    )

    parser.add_argument(
        "--resume",
        type=str,
        default=None,
        help="Resume workflow from checkpoint ID",
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output",
    )

    return parser


def print_progress(phase: WorkflowPhase, percent: float, message: str):
    """
    Print progress to console.

    Args:
        phase: WorkflowPhase
            Current workflow phase.
        percent: float
            Progress percentage.
        message: str
            Status message.
    """
    bar_width = 30
    filled = int(bar_width * percent / 100)
    bar = "#" * filled + "-" * (bar_width - filled)
    print(f"\r[{phase.value:12}] [{bar}] {percent:5.1f}% | {message}", end="", flush=True)
    if percent >= 100:
        print()


def print_result(result: dict, verbose: bool = False):
    """
    Print workflow result.

    Args:
        result: dict
            Workflow result dictionary.
        verbose: bool
            Enable verbose output.
    """
    print("\n" + "=" * 60)
    print("DISCOVERY WORKFLOW COMPLETE")
    print("=" * 60)

    if result.get("status") == "cached":
        print(f"Status: Loaded from cache (ID: {result.get('cache_id')})")
    else:
        print(f"Status: {result.get('status', 'unknown')}")
        print(f"Workflow ID: {result.get('workflow_id', 'N/A')}")

    metrics = result.get("metrics", {})
    if metrics:
        print(f"\nMetrics:")
        print(f"  Pages: {metrics.get('total_pages', 0)}")
        print(f"  Fields Detected: {metrics.get('total_fields', 0)}")
        print(f"  Fields Validated: {metrics.get('validated_fields', 0)}")
        print(f"  Retry Pool: {metrics.get('retry_pool_size', 0)}")
        print(f"  Accuracy: {metrics.get('accuracy', 0):.1f}%")
        print(f"  Elapsed Time: {metrics.get('elapsed_time', 0):.2f}s")

    output_paths = result.get("output_paths", {})
    if output_paths:
        print(f"\nOutput Files:")
        for name, path in output_paths.items():
            print(f"  {name}: {path}")

    print("=" * 60)


async def run_workflow(args: argparse.Namespace) -> int:
    """
    Execute discovery workflow.

    Args:
        args: argparse.Namespace
            Parsed command-line arguments.

    Returns:
        int
            Exit code (0 for success, 1 for error).
    """
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"Error: PDF file not found: {pdf_path}", file=sys.stderr)
        return 1

    try:
        config = ConfigLoader.load(args.env)
    except Exception as e:
        print(f"Error loading config: {e}", file=sys.stderr)
        print("Make sure .env file exists with GLM_API_KEY set", file=sys.stderr)
        return 1

    if args.no_cache:
        config.cache.enabled = False

    if args.verbose:
        config.verbose = True

    workflow = DiscoveryWorkflow(config)

    if args.verbose:
        workflow.set_progress_callback(print_progress)

    try:
        if args.resume:
            print(f"Resuming workflow: {args.resume}")
            result = await workflow.resume(args.resume)
        else:
            print(f"Processing: {pdf_path}")
            result = await workflow.run(str(pdf_path), args.project)

        print_result(result, args.verbose)
        return 0

    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


def main():
    """
    Main entry point.
    """
    parser = create_parser()
    args = parser.parse_args()

    exit_code = asyncio.run(run_workflow(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
