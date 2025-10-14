"""
HTTP session management with retry logic and connection pooling.

This module provides a configured requests.Session with automatic retry logic,
exponential backoff, and proper User-Agent headers for polite API usage.
"""
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry


class DownloadSession:
    """
    Manages HTTP sessions with retry logic and connection pooling.
    
    Configured for robust downloads with:
    - Automatic retries on rate limits (429) and server errors (5xx)
    - Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 60s)
    - Polite User-Agent header
    - Connection pooling for efficiency
    - Configurable timeouts
    """
    
    def __init__(
        self,
        max_retries: int = 5,
        backoff_factor: float = 1.0,
        timeout_connect: int = 5,
        timeout_read: int = 30,
        user_agent: str = "MTG-Image-DB/1.0 (+https://github.com/FrimJo/spell-coven-mono; ifrim@me.com)"
    ):
        """
        Initialize a download session with retry logic.
        
        Args:
            max_retries: Maximum number of retry attempts (default: 5)
            backoff_factor: Multiplier for exponential backoff (default: 1.0)
                           Produces delays: 1s, 2s, 4s, 8s, 16s
            timeout_connect: Connection timeout in seconds (default: 5)
            timeout_read: Read timeout in seconds (default: 30)
            user_agent: User-Agent header string
        """
        self.timeout = (timeout_connect, timeout_read)
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "HEAD"],
            respect_retry_after_header=True
        )
        
        # Create session with retry adapter
        self.session = requests.Session()
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set User-Agent header
        self.session.headers.update({"User-Agent": user_agent})
    
    def get(self, url: str, **kwargs):
        """
        Perform GET request with configured retry logic and timeouts.
        
        Args:
            url: URL to request
            **kwargs: Additional arguments passed to requests.get()
        
        Returns:
            requests.Response object
        """
        # Use configured timeout if not overridden
        if "timeout" not in kwargs:
            kwargs["timeout"] = self.timeout
        
        return self.session.get(url, **kwargs)
    
    def close(self):
        """Close the session and release resources."""
        self.session.close()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - closes session."""
        self.close()
