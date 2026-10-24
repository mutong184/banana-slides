"""Small server-side proxy for the Codia Open API.

The Codia credential stays in the backend environment.  The browser only
talks to these same-origin endpoints, so Vite does not have to expose the
credential in the generated JavaScript bundle.
"""

from __future__ import annotations

import os
from typing import Any

import requests
from flask import Blueprint, jsonify, request


codia_bp = Blueprint("codia", __name__, url_prefix="/api/codia")


def _base_url() -> str:
    return os.getenv("CODIA_API_BASE", "https://openapi.codia.ai").rstrip("/")


def _api_key() -> str:
    return os.getenv("CODIA_API_KEY", "").strip()


def _error(message: str, status: int):
    return jsonify({"message": message}), status


def _forward_response(response: requests.Response):
    """Forward Codia's JSON envelope while keeping the upstream status code."""
    try:
        payload: Any = response.json()
    except ValueError:
        payload = {"message": response.text[:500] or "Codia 返回了无法解析的响应"}
    return jsonify(payload), response.status_code


def _headers(*, include_content_type: bool = False) -> dict[str, str]:
    key = _api_key()
    if not key:
        raise RuntimeError("服务器尚未配置 CODIA_API_KEY，请在 .env 中填写 Codia Open API Key")
    if key.lower().startswith("whsec_"):
        raise RuntimeError(
            "当前 CODIA_API_KEY 是 webhook signing secret（whsec_ 开头），"
            "不能用于 Codia Open API。请改成控制台生成的 Open API Key。"
        )
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    if include_content_type:
        headers["Content-Type"] = "application/json"
    return headers


@codia_bp.post("/uploads")
def upload_pdf():
    """Upload a PDF to Codia and return its upload_id."""
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return _error("缺少 PDF 文件", 400)

    try:
        response = requests.post(
            f"{_base_url()}/v2/open/uploads",
            headers=_headers(),
            files={
                "file": (
                    uploaded.filename,
                    uploaded.stream,
                    uploaded.mimetype or "application/pdf",
                )
            },
            timeout=(20, 300),
        )
    except RuntimeError as exc:
        return _error(str(exc), 503)
    except requests.RequestException as exc:
        return _error(f"连接 Codia 上传接口失败：{exc}", 502)
    return _forward_response(response)


@codia_bp.post("/tasks")
def create_task():
    """Create a Codia conversion task."""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _error("任务参数必须是 JSON 对象", 400)

    try:
        headers = _headers(include_content_type=True)
    except RuntimeError as exc:
        return _error(str(exc), 503)
    idempotency_key = request.headers.get("Idempotency-Key", "").strip()
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key

    try:
        response = requests.post(
            f"{_base_url()}/v2/open/tasks",
            headers=headers,
            json=body,
            timeout=(20, 300),
        )
    except RuntimeError as exc:
        return _error(str(exc), 503)
    except requests.RequestException as exc:
        return _error(f"连接 Codia 任务接口失败：{exc}", 502)
    return _forward_response(response)


@codia_bp.get("/tasks/<task_id>")
def get_task(task_id: str):
    """Read the status of a Codia conversion task."""
    try:
        response = requests.get(
            f"{_base_url()}/v2/open/tasks/{task_id}",
            headers=_headers(),
            timeout=(20, 60),
        )
    except RuntimeError as exc:
        return _error(str(exc), 503)
    except requests.RequestException as exc:
        return _error(f"连接 Codia 状态接口失败：{exc}", 502)
    return _forward_response(response)
