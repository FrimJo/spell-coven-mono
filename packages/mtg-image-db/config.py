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
    """Get embeddings format from config (default: float32)."""
    config = get_config()
    return config.get('VITE_EMBEDDINGS_FORMAT', 'float32')


def get_query_contrast() -> float:
    """Get query contrast enhancement factor from config (default: 1.0)."""
    config = get_config()
    try:
        return float(config.get('VITE_QUERY_CONTRAST', '1.0'))
    except (ValueError, TypeError):
        return 1.0
