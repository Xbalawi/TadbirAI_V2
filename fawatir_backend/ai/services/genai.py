import os
import mimetypes
from typing import Optional

import requests

from django.conf import settings


DEFAULT_SERVICE_URL = getattr(settings, 'GENAI_SERVICE_URL', 'http://localhost:8001/api/v1/extract-invoice/')


def post_file_to_service(file_path: str, service_url: Optional[str] = None, timeout: int = 60):
    """POSTs a single file to the external GenAI extractor service and returns parsed JSON.

    Raises requests.HTTPError on non-2xx responses.
    """
    url = service_url or DEFAULT_SERVICE_URL
    filename = os.path.basename(file_path)
    mime_type, _ = mimetypes.guess_type(filename)
    mime_type = mime_type or 'application/octet-stream'

    with open(file_path, 'rb') as fh:
        files = {'file': (filename, fh, mime_type)}
        resp = requests.post(url, files=files, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
