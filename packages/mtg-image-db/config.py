"""
Load environment variables from root .env.development file.
This allows the package to use shared configuration from the monorepo root.
"""
import os
from pathlib import Path


def load_env_file(env_path: Path) -> dict:
    """Load environment variables from a .env file."""
    env_vars = {}
    if not env_path.exists():
        return env_vars
    
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue
            
            if '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
    
    return env_vars


def get_config():
    """Get configuration from root .env.development and .env.development.local files."""
    # Find root .env files (go up from packages/mtg-image-db)
    current_dir = Path(__file__).parent
    root_dir = current_dir.parent.parent
    root_env = root_dir / '.env.development'
    root_env_local = root_dir / '.env.development.local'
    
    # Load environment variables (local overrides development)
    env_vars = load_env_file(root_env)
    env_vars.update(load_env_file(root_env_local))
    
    # Also check OS environment variables (they take precedence)
    env_vars.update(os.environ)
    
    return env_vars


def get_embeddings_format() -> str:
    """
    Get embeddings format.
    
    Hardcoded to 'int8' (75% smaller than float32, slight accuracy loss).
    This must match the format expected by the browser client.
    
    Returns:
        str: Always returns 'int8'
    """
    return 'int8'


def get_default_contrast() -> float:
    """
    Get default contrast enhancement factor.
    
    Returns 1.5 as the recommended default for blurry webcam cards.
    This value is written to build_manifest.json and read by the browser client.
    
    Returns:
        float: Always returns 1.5 (50% boost)
    """
    return 1.5
