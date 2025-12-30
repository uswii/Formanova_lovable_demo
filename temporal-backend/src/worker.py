"""Temporal worker that executes workflows and activities."""
import asyncio
import logging
import signal
import sys

from temporalio.client import Client
from temporalio.worker import Worker

from .config import config
from .workflows import JewelryGenerationWorkflow, PreprocessingWorkflow, GenerationWorkflow
from .activities import (
    upload_to_azure,
    resize_image,
    check_zoom,
    remove_background,
    generate_mask,
    fetch_and_create_overlay,
    refine_mask,
    generate_images,
    check_a100_health,
    check_service_health
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def main():
    """Start the Temporal worker."""
    logger.info(f"Connecting to Temporal at {config.temporal_address}")
    
    # Connect to Temporal
    client = await Client.connect(
        config.temporal_address,
        namespace=config.temporal_namespace
    )
    
    logger.info(f"Connected to Temporal namespace: {config.temporal_namespace}")
    
    # Create worker
    worker = Worker(
        client,
        task_queue=config.main_task_queue,
        workflows=[
            JewelryGenerationWorkflow,
            PreprocessingWorkflow,
            GenerationWorkflow
        ],
        activities=[
            upload_to_azure,
            resize_image,
            check_zoom,
            remove_background,
            generate_mask,
            fetch_and_create_overlay,
            refine_mask,
            generate_images,
            check_a100_health,
            check_service_health
        ]
    )
    
    logger.info(f"Worker started on task queue: {config.main_task_queue}")
    logger.info("Listening for workflows...")
    
    # Handle shutdown gracefully
    shutdown_event = asyncio.Event()
    
    def handle_shutdown(sig):
        logger.info(f"Received signal {sig}, shutting down...")
        shutdown_event.set()
    
    # Register signal handlers
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_shutdown(s))
    
    # Run worker until shutdown
    async with worker:
        await shutdown_event.wait()
    
    logger.info("Worker shut down cleanly")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker interrupted")
        sys.exit(0)
