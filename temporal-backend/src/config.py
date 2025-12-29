"""Configuration settings for the Temporal backend."""
import os
from dataclasses import dataclass


@dataclass
class Config:
    """Application configuration loaded from environment variables."""
    
    # Temporal
    temporal_address: str = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
    temporal_namespace: str = os.getenv("TEMPORAL_NAMESPACE", "default")
    
    # Azure Storage
    azure_account_name: str = os.getenv("AZURE_ACCOUNT_NAME", "")
    azure_account_key: str = os.getenv("AZURE_ACCOUNT_KEY", "")
    azure_container_name: str = os.getenv("AZURE_CONTAINER_NAME", "jewelry-uploads")
    
    # External Services
    image_manipulator_url: str = os.getenv("IMAGE_MANIPULATOR_URL", "http://20.106.235.80:8005")
    birefnet_url: str = os.getenv("BIREFNET_URL", "https://nemoooooooooo--bg-remove-service-fastapi-app.modal.run")
    sam3_url: str = os.getenv("SAM3_URL", "https://nemoooooooooo--sam3-service-fastapi-app.modal.run")
    a100_server_url: str = os.getenv("A100_SERVER_URL", "http://localhost:8000")
    
    # API Server
    api_port: int = int(os.getenv("API_PORT", "8001"))
    
    # Task Queues
    main_task_queue: str = "jewelry-generation"
    image_processing_queue: str = "image-processing"
    ml_inference_queue: str = "ml-inference"


config = Config()
