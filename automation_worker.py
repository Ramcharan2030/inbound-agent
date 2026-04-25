import asyncio
import json
import logging
import os
import sys
from pathlib import Path

def _bootstrap_venv() -> None:
    project_dir = Path(__file__).resolve().parent
    venv_python = project_dir / '.venv' / 'Scripts' / 'python.exe'
    if not venv_python.exists():
        return
    try:
        current_python = Path(sys.executable).resolve()
        target_python = venv_python.resolve()
    except Exception:
        return
    if current_python == target_python:
        return
    os.execv(str(target_python), [str(target_python), str(Path(__file__).resolve()), *sys.argv[1:]])
_bootstrap_venv()
from dotenv import load_dotenv
from automation import ensure_default_templates, process_due_jobs
CONFIG_FILE = 'config.json'
load_dotenv()
logging.basicConfig(level=logging.INFO)
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
logger = logging.getLogger('automation-worker')

def parse_bool(value, default: bool=False) -> bool:
    if value in (None, ''):
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {'1', 'true', 'yes', 'on'}:
        return True
    if text in {'0', 'false', 'no', 'off'}:
        return False
    return default

def read_config() -> dict:
    path = Path(CONFIG_FILE)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}

async def main() -> None:
    config = read_config()
    whatsapp_enabled = parse_bool(config.get('whatsapp_enabled', os.environ.get('WHATSAPP_ENABLED', False)), False)
    if not whatsapp_enabled:
        logger.info('[WORKER] WhatsApp automation is disabled. Worker will not start.')
        return
    ensure_default_templates()
    logger.info('[WORKER] Automation worker started.')
    while True:
        config = read_config()
        poll_seconds = max(3, int(config.get('automation_worker_poll_seconds') or 8))
        try:
            processed = process_due_jobs(limit=10, config=config)
            if processed:
                logger.info(f'[WORKER] Processed {len(processed)} due WhatsApp jobs')
        except Exception as exc:
            logger.error(f'[WORKER] Processing failed: {exc}')
        await asyncio.sleep(poll_seconds)
if __name__ == '__main__':
    asyncio.run(main())
