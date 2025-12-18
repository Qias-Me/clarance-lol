#!/usr/bin/env python3
"""
Section 13 Performance Optimization & Error Recovery System
Advanced caching, batch processing, and intelligent retry mechanisms
"""

import json
import sys
import os
import asyncio
import aiohttp
import time
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import pickle
import logging
from datetime import datetime, timedelta
import statistics
from pathlib import Path
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import backoff

class ProcessingStatus(Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"
    CACHED = "CACHED"

class ErrorType(Enum):
    API_ERROR = "API_ERROR"
    NETWORK_ERROR = "NETWORK_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"

@dataclass
class ProcessingMetrics:
    field_id: str
    start_time: float
    end_time: Optional[float] = None
    status: ProcessingStatus = ProcessingStatus.PENDING
    attempts: int = 0
    error_type: Optional[ErrorType] = None
    error_message: Optional[str] = None
    confidence: float = 0.0
    cache_hit: bool = False
    processing_time: float = 0.0

@dataclass
class CacheEntry:
    field_id: str
    extracted_value: str
    confidence: float
    coordinates: Dict[str, float]
    timestamp: datetime
    extraction_method: str
    validation_passed: bool

class Section13PerformanceOptimizer:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.cache_directory = Path(config.get('cache_directory', './cache'))
        self.cache_ttl = config.get('cache_ttl', 3600)  # 1 hour default
        self.max_batch_size = config.get('max_batch_size', 100)
        self.max_concurrent_requests = config.get('max_concurrent_requests', 10)
        self.retry_attempts = config.get('retry_attempts', 3)
        self.retry_delay = config.get('retry_delay', 1.0)

        # Performance tracking
        self.metrics = []
        self.cache = {}
        self.session = None
        self.logger = self._setup_logging()

        # Thread pool for parallel processing
        self.thread_pool = ThreadPoolExecutor(max_workers=self.max_concurrent_requests)

        # Ensure cache directory exists
        self.cache_directory.mkdir(exist_ok=True)

        # Load existing cache
        self._load_cache()

    def _setup_logging(self) -> logging.Logger:
        """Setup comprehensive logging"""
        logger = logging.getLogger('Section13Optimizer')
        logger.setLevel(logging.INFO)

        # File handler
        fh = logging.FileHandler('section13_optimization.log')
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

    def _load_cache(self):
        """Load cache from disk"""
        try:
            cache_file = self.cache_directory / 'field_cache.pkl'
            if cache_file.exists():
                with open(cache_file, 'rb') as f:
                    cache_data = pickle.load(f)

                # Filter expired entries
                current_time = datetime.now()
                self.cache = {
                    field_id: entry for field_id, entry in cache_data.items()
                    if (current_time - entry.timestamp).total_seconds() < self.cache_ttl
                }

                self.logger.info(f"Loaded {len(self.cache)} cached entries")
        except Exception as e:
            self.logger.warning(f"Failed to load cache: {e}")
            self.cache = {}

    def _save_cache(self):
        """Save cache to disk"""
        try:
            cache_file = self.cache_directory / 'field_cache.pkl'
            with open(cache_file, 'wb') as f:
                pickle.dump(self.cache, f)
            self.logger.info(f"Saved {len(self.cache)} entries to cache")
        except Exception as e:
            self.logger.warning(f"Failed to save cache: {e}")

    def _generate_cache_key(self, field_id: str, coordinates: Dict[str, float]) -> str:
        """Generate unique cache key for field"""
        coord_string = f"{coordinates.get('x', 0)}_{coordinates.get('y', 0)}_{coordinates.get('width', 0)}_{coordinates.get('height', 0)}"
        raw_key = f"{field_id}_{coord_string}"
        return hashlib.md5(raw_key.encode()).hexdigest()

    def get_cached_result(self, field_id: str, coordinates: Dict[str, float]) -> Optional[CacheEntry]:
        """Get cached result if available and not expired"""
        cache_key = self._generate_cache_key(field_id, coordinates)

        if cache_key in self.cache:
            entry = self.cache[cache_key]
            current_time = datetime.now()

            if (current_time - entry.timestamp).total_seconds() < self.cache_ttl:
                self.logger.debug(f"Cache hit for field {field_id}")
                return entry
            else:
                # Remove expired entry
                del self.cache[cache_key]

        return None

    def cache_result(self, field_id: str, coordinates: Dict[str, float],
                    extracted_value: str, confidence: float,
                    extraction_method: str, validation_passed: bool = True):
        """Cache extraction result"""
        cache_key = self._generate_cache_key(field_id, coordinates)

        entry = CacheEntry(
            field_id=field_id,
            extracted_value=extracted_value,
            confidence=confidence,
            coordinates=coordinates.copy(),
            timestamp=datetime.now(),
            extraction_method=extraction_method,
            validation_passed=validation_passed
        )

        self.cache[cache_key] = entry

        # Periodically save cache
        if len(self.cache) % 50 == 0:
            self._save_cache()

    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=5,
        base=1,
        max=60
    )
    async def _process_single_field_with_retry(self, field_data: Dict[str, Any],
                                              pdf_base64: str, extraction_method: str = 'ai_vision') -> ProcessingMetrics:
        """Process single field with intelligent retry mechanism"""

        field_id = field_data.get('id', '')
        field_name = field_data.get('name', '')
        coordinates = field_data.get('rect', {})

        metrics = ProcessingMetrics(
            field_id=field_id,
            start_time=time.time()
        )

        # Check cache first
        cached_result = self.get_cached_result(field_id, coordinates)
        if cached_result:
            metrics.status = ProcessingStatus.CACHED
            metrics.end_time = time.time()
            metrics.confidence = cached_result.confidence
            metrics.cache_hit = True
            metrics.processing_time = metrics.end_time - metrics.start_time
            return metrics

        metrics.status = ProcessingStatus.PROCESSING
        metrics.attempts = 1

        try:
            # This would integrate with the actual GLM4.5V processing
            # For now, we'll simulate with a mock processing
            processing_result = await self._mock_field_processing(field_data, pdf_base64)

            metrics.end_time = time.time()
            metrics.processing_time = metrics.end_time - metrics.start_time
            metrics.confidence = processing_result.get('confidence', 0.8)
            metrics.status = ProcessingStatus.COMPLETED

            # Cache successful result
            self.cache_result(
                field_id=field_id,
                coordinates=coordinates,
                extracted_value=processing_result.get('value', ''),
                confidence=metrics.confidence,
                extraction_method=extraction_method,
                validation_passed=processing_result.get('validation_passed', True)
            )

            self.logger.info(f"Successfully processed field {field_id} in {metrics.processing_time:.3f}s")

        except Exception as e:
            metrics.end_time = time.time()
            metrics.processing_time = metrics.end_time - metrics.start_time
            metrics.status = ProcessingStatus.FAILED
            metrics.error_type = self._classify_error(e)
            metrics.error_message = str(e)

            self.logger.error(f"Failed to process field {field_id}: {e}")

            # Retry logic for specific error types
            if metrics.error_type in [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT_ERROR, ErrorType.RATE_LIMIT_ERROR]:
                return await self._retry_field_processing(field_data, pdf_base64, metrics)

        return metrics

    async def _retry_field_processing(self, field_data: Dict[str, Any],
                                     pdf_base64: str, initial_metrics: ProcessingMetrics) -> ProcessingMetrics:
        """Implement intelligent retry logic"""

        for attempt in range(1, self.retry_attempts + 1):
            self.logger.info(f"Retrying field {field_data.get('id')} attempt {attempt}/{self.retry_attempts}")

            # Exponential backoff with jitter
            delay = self.retry_delay * (2 ** (attempt - 1)) + (0.1 * attempt)
            await asyncio.sleep(delay)

            try:
                # Retry processing
                processing_result = await self._mock_field_processing(field_data, pdf_base64)

                # Update metrics for successful retry
                initial_metrics.status = ProcessingStatus.COMPLETED
                initial_metrics.end_time = time.time()
                initial_metrics.processing_time = initial_metrics.end_time - initial_metrics.start_time
                initial_metrics.confidence = processing_result.get('confidence', 0.8)
                initial_metrics.attempts += 1

                self.logger.info(f"Retry successful for field {field_data.get('id')} on attempt {attempt}")
                return initial_metrics

            except Exception as e:
                initial_metrics.attempts += 1
                self.logger.warning(f"Retry {attempt} failed for field {field_data.get('id')}: {e}")

        # All retries failed
        initial_metrics.status = ProcessingStatus.FAILED
        initial_metrics.error_message = f"Failed after {self.retry_attempts} retry attempts"

        return initial_metrics

    def _classify_error(self, error: Exception) -> ErrorType:
        """Classify error type for appropriate handling"""
        error_str = str(error).lower()

        if 'timeout' in error_str:
            return ErrorType.TIMEOUT_ERROR
        elif 'rate limit' in error_str or 'too many requests' in error_str:
            return ErrorType.RATE_LIMIT_ERROR
        elif 'network' in error_str or 'connection' in error_str:
            return ErrorType.NETWORK_ERROR
        elif 'validation' in error_str or 'invalid' in error_str:
            return ErrorType.VALIDATION_ERROR
        elif 'api' in error_str:
            return ErrorType.API_ERROR
        else:
            return ErrorType.UNKNOWN_ERROR

    async def _mock_field_processing(self, field_data: Dict[str, Any], pdf_base64: str) -> Dict[str, Any]:
        """Mock field processing for demonstration"""
        # Simulate processing time
        await asyncio.sleep(0.1)

        # Simulate varying confidence levels
        confidence = 0.85 + (hash(field_data.get('id', '')) % 10) / 100

        return {
            'value': f"extracted_value_{field_data.get('id', 'unknown')}",
            'confidence': confidence,
            'validation_passed': confidence > 0.8
        }

    def optimize_batch_processing(self, fields: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Optimize batch processing based on field characteristics"""

        # Sort fields by priority and complexity
        priority_order = {
            'HIGH': 0,
            'MEDIUM': 1,
            'LOW': 2
        }

        # Add priority estimation based on field characteristics
        for field in fields:
            field_name = field.get('name', '').lower()
            field_type = field.get('type', '').lower()

            if any(keyword in field_name for keyword in ['name', 'date', 'phone']):
                field['estimated_priority'] = 'HIGH'
            elif any(keyword in field_name for keyword in ['address', 'city', 'state']):
                field['estimated_priority'] = 'MEDIUM'
            else:
                field['estimated_priority'] = 'LOW'

        # Sort by priority
        sorted_fields = sorted(fields, key=lambda x: priority_order.get(x['estimated_priority'], 2))

        # Create optimized batches
        batches = []
        current_batch = []
        current_batch_size = 0

        for field in sorted_fields:
            # Estimate processing complexity
            field_complexity = self._estimate_field_complexity(field)

            # Check if field fits in current batch
            if current_batch_size + field_complexity <= self.max_batch_size:
                current_batch.append(field)
                current_batch_size += field_complexity
            else:
                if current_batch:
                    batches.append(current_batch)
                current_batch = [field]
                current_batch_size = field_complexity

        if current_batch:
            batches.append(current_batch)

        self.logger.info(f"Optimized {len(fields)} fields into {len(batches)} batches")
        return batches

    def _estimate_field_complexity(self, field: Dict[str, Any]) -> int:
        """Estimate processing complexity of a field"""
        complexity = 1

        field_name = field.get('name', '').lower()
        field_type = field.get('type', '').lower()

        # Increase complexity for certain field types
        if 'radio' in field_type or 'check' in field_type:
            complexity += 2  # Visual elements require more processing
        elif any(keyword in field_name for keyword in ['address', 'name']):
            complexity += 1  # Complex text fields
        elif any(keyword in field_name for keyword in ['date', 'phone']):
            complexity += 0.5  # Formatted fields

        return int(complexity * 10)  # Scale to batch units

    async def process_optimized_batches(self, batches: List[List[Dict[str, Any]]],
                                      pdf_base64: str) -> List[ProcessingMetrics]:
        """Process optimized batches with intelligent concurrency control"""

        all_metrics = []
        semaphore = asyncio.Semaphore(self.max_concurrent_requests)

        async def process_batch_with_semaphore(batch: List[Dict[str, Any]]) -> List[ProcessingMetrics]:
            async with semaphore:
                batch_tasks = [
                    self._process_single_field_with_retry(field, pdf_base64)
                    for field in batch
                ]
                return await asyncio.gather(*batch_tasks, return_exceptions=True)

        # Process batches with controlled concurrency
        batch_tasks = [process_batch_with_semaphore(batch) for batch in batches]
        batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

        # Flatten results and filter exceptions
        for batch_result in batch_results:
            if isinstance(batch_result, Exception):
                self.logger.error(f"Batch processing error: {batch_result}")
            else:
                for field_result in batch_result:
                    if isinstance(field_result, ProcessingMetrics):
                        all_metrics.append(field_result)
                    elif isinstance(field_result, Exception):
                        self.logger.error(f"Field processing error: {field_result}")

        return all_metrics

    def generate_performance_report(self, metrics: List[ProcessingMetrics]) -> Dict[str, Any]:
        """Generate comprehensive performance report"""

        if not metrics:
            return {'error': 'No metrics available'}

        # Basic statistics
        total_fields = len(metrics)
        successful = len([m for m in metrics if m.status == ProcessingStatus.COMPLETED])
        failed = len([m for m in metrics if m.status == ProcessingStatus.FAILED])
        cached = len([m for m in metrics if m.cache_hit])

        processing_times = [m.processing_time for m in metrics if m.processing_time > 0]
        confidence_scores = [m.confidence for m in metrics if m.confidence > 0]

        # Performance metrics
        report = {
            'summary': {
                'total_fields': total_fields,
                'successful_extractions': successful,
                'failed_extractions': failed,
                'cached_results': cached,
                'success_rate': successful / total_fields if total_fields > 0 else 0,
                'cache_hit_rate': cached / total_fields if total_fields > 0 else 0
            },
            'timing': {
                'total_processing_time': sum(processing_times),
                'average_processing_time': statistics.mean(processing_times) if processing_times else 0,
                'median_processing_time': statistics.median(processing_times) if processing_times else 0,
                'fastest_field': min(processing_times) if processing_times else 0,
                'slowest_field': max(processing_times) if processing_times else 0
            },
            'quality': {
                'average_confidence': statistics.mean(confidence_scores) if confidence_scores else 0,
                'confidence_std': statistics.stdev(confidence_scores) if len(confidence_scores) > 1 else 0,
                'high_confidence_fields': len([c for c in confidence_scores if c > 0.9]),
                'medium_confidence_fields': len([c for c in confidence_scores if 0.7 <= c <= 0.9]),
                'low_confidence_fields': len([c for c in confidence_scores if c < 0.7])
            },
            'retries': {
                'fields_retried': len([m for m in metrics if m.attempts > 1]),
                'total_retry_attempts': sum(m.attempts - 1 for m in metrics),
                'retry_success_rate': len([m for m in metrics if m.attempts > 1 and m.status == ProcessingStatus.COMPLETED]) / len([m for m in metrics if m.attempts > 1]) if any(m.attempts > 1 for m in metrics) else 0
            },
            'errors': {
                'error_types': {}
            }
        }

        # Error analysis
        error_counts = {}
        for metric in metrics:
            if metric.error_type:
                error_counts[metric.error_type] = error_counts.get(metric.error_type, 0) + 1

        report['errors']['error_types'] = {error_type.value: count for error_type, count in error_counts.items()}

        # Performance recommendations
        report['recommendations'] = self._generate_performance_recommendations(report)

        return report

    def _generate_performance_recommendations(self, report: Dict[str, Any]) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []

        # Success rate recommendations
        if report['summary']['success_rate'] < 0.9:
            recommendations.append("Consider adjusting processing parameters to improve success rate")

        # Cache recommendations
        if report['summary']['cache_hit_rate'] < 0.1:
            recommendations.append("Cache hit rate is low - consider longer cache TTL for repeated processing")

        # Performance recommendations
        if report['timing']['average_processing_time'] > 5.0:
            recommendations.append("Average processing time is high - consider optimizing batch sizes or increasing concurrency")

        # Retry recommendations
        if report['retries']['retry_success_rate'] < 0.5:
            recommendations.append("Retry success rate is low - adjust retry strategy or investigate root causes")

        # Error recommendations
        if report['errors']['error_types']:
            most_common_error = max(report['errors']['error_types'].items(), key=lambda x: x[1])
            recommendations.append(f"Most common error type is {most_common_error[0]} - implement specific handling")

        return recommendations

    def save_performance_metrics(self, metrics: List[ProcessingMetrics], output_path: str = None):
        """Save performance metrics to file"""
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"section13_performance_metrics_{timestamp}.json"

        # Generate report
        report = self.generate_performance_report(metrics)

        # Save detailed metrics
        detailed_metrics = [
            {
                'field_id': m.field_id,
                'start_time': m.start_time,
                'end_time': m.end_time,
                'status': m.status.value,
                'attempts': m.attempts,
                'error_type': m.error_type.value if m.error_type else None,
                'error_message': m.error_message,
                'confidence': m.confidence,
                'cache_hit': m.cache_hit,
                'processing_time': m.processing_time
            }
            for m in metrics
        ]

        output_data = {
            'metadata': {
                'timestamp': datetime.now().isoformat(),
                'optimizer_version': 'Section13-PerformanceOptimizer-v1.0',
                'total_fields': len(metrics)
            },
            'performance_report': report,
            'detailed_metrics': detailed_metrics,
            'cache_statistics': {
                'cache_size': len(self.cache),
                'cache_ttl': self.cache_ttl
            }
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        self.logger.info(f"Performance metrics saved to: {output_path}")
        return output_path

async def main():
    if len(sys.argv) != 2:
        print("Usage: python section13-performance-optimizer.py <section13_fields.json>")
        sys.exit(1)

    fields_path = sys.argv[1]

    print("Section 13 Performance Optimization & Error Recovery System")
    print("=" * 60)

    # Configuration
    config = {
        'cache_directory': './cache',
        'cache_ttl': 3600,  # 1 hour
        'max_batch_size': 100,
        'max_concurrent_requests': 10,
        'retry_attempts': 3,
        'retry_delay': 1.0
    }

    # Load fields
    with open(fields_path, 'r', encoding='utf-8') as f:
        fields_data = json.load(f)

    fields = fields_data.get('fields', [])
    print(f"Loaded {len(fields)} fields for optimization")

    # Initialize optimizer
    optimizer = Section13PerformanceOptimizer(config)

    try:
        # Mock PDF base64 (in real usage, this would be the actual PDF)
        pdf_base64 = "mock_pdf_base64_data"

        print("Optimizing batch processing...")
        optimized_batches = optimizer.optimize_batch_processing(fields)
        print(f"Created {len(optimized_batches)} optimized batches")

        print("Processing fields with optimization...")
        start_time = time.time()

        all_metrics = await optimizer.process_optimized_batches(optimized_batches, pdf_base64)

        total_time = time.time() - start_time
        print(f"Processing completed in {total_time:.2f} seconds")

        # Generate and save performance report
        report = optimizer.generate_performance_report(all_metrics)

        print(f"\nPerformance Summary:")
        print(f"  Success Rate: {report['summary']['success_rate']:.2%}")
        print(f"  Cache Hit Rate: {report['summary']['cache_hit_rate']:.2%}")
        print(f"  Average Processing Time: {report['timing']['average_processing_time']:.3f}s")
        print(f"  Average Confidence: {report['quality']['average_confidence']:.3f}")

        if report['recommendations']:
            print(f"\nRecommendations:")
            for i, rec in enumerate(report['recommendations'], 1):
                print(f"  {i}. {rec}")

        # Save detailed metrics
        output_path = optimizer.save_performance_metrics(all_metrics)
        print(f"\nDetailed metrics saved to: {output_path}")

        # Save cache
        optimizer._save_cache()

    except Exception as e:
        print(f"Error during optimization: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())