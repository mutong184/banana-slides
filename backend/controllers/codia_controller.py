"""Small server-side proxy for the Codia Open API.

The Codia credential stays in the backend environment.  The browser only
talks to these same-origin endpoints, so Vite does not have to expose the
credential in the generated JavaScript bundle.
"""

from __future__ import annotations

import io
import os
import uuid
from typing import Any

import requests
from flask import Blueprint, current_app, jsonify, request
from models import Project
from services import ExportService, FileService
from utils import get_filtered_pages, success_response, not_found, bad_request
from werkzeug.utils import secure_filename


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


def _read_codia_payload(response: requests.Response) -> Any:
    """Read a successful Codia response and unwrap its optional data envelope."""
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError("Codia 返回了无法解析的响应") from exc

    if not response.ok:
        message = payload.get("message") if isinstance(payload, dict) else None
        raise RuntimeError(message or f"Codia 请求失败（HTTP {response.status_code}）")
    if isinstance(payload, dict) and isinstance(payload.get("code"), int) and payload["code"] != 0:
        raise RuntimeError(payload.get("message") or f"Codia 请求失败（code {payload['code']}）")
    if isinstance(payload, dict) and payload.get("data") is not None:
        return payload["data"]
    return payload


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


@codia_bp.post("/projects/<project_id>/pdf-to-ppt")
def create_project_pdf_to_ppt(project_id: str):
    """Create a Codia conversion task without sending the PDF through the browser.

    The server builds the PDF from the project's generated page images in memory,
    uploads it to Codia, and creates the asynchronous ``pdf_to_ppt`` task.  The
    browser receives only the task id and continues using the existing status
    endpoint.
    """
    project = Project.query.get(project_id)
    if not project:
        return not_found("Project")

    body = request.get_json(silent=True) or {}
    page_ids = body.get("page_ids")
    if page_ids is not None and not isinstance(page_ids, list):
        return bad_request("page_ids 必须是数组")

    pages = get_filtered_pages(project_id, page_ids or None)
    if not pages:
        return bad_request("项目中没有可导出的页面")

    file_service = FileService(current_app.config["UPLOAD_FOLDER"])
    image_paths = []
    for page in pages:
        if not page.generated_image_path:
            continue
        image_paths.append(file_service.get_absolute_path(page.generated_image_path))
    if not image_paths:
        return bad_request("项目中没有已生成的页面图片")

    try:
        # Keep the PDF in memory: this removes the browser download and the
        # second upload hop while retaining the existing PDF rendering logic.
        pdf_bytes = ExportService.create_pdf_from_images(
            image_paths,
            aspect_ratio=project.image_aspect_ratio,
        )
        if not pdf_bytes:
            raise RuntimeError("PDF 生成结果为空")

        upload_filename = secure_filename(f"{project.project_title or 'teaching-deck'}.pdf") or "teaching-deck.pdf"
        upload_response = requests.post(
            f"{_base_url()}/v2/open/uploads",
            headers=_headers(),
            files={
                "file": (
                    upload_filename,
                    io.BytesIO(pdf_bytes),
                    "application/pdf",
                )
            },
            timeout=(20, 300),
        )
        upload_payload = _read_codia_payload(upload_response)
        upload_id = upload_payload.get("upload_id") if isinstance(upload_payload, dict) else None
        if not upload_id:
            raise RuntimeError("PDF 上传成功但没有返回文件编号")

        idempotency_key = (
            request.headers.get("Idempotency-Key", "").strip()
            or str(body.get("idempotency_key", "")).strip()
            or f"ppt-edit-{uuid.uuid4()}"
        )
        title = str(body.get("title") or project.project_title or "教学课件").strip()
        task_response = requests.post(
            f"{_base_url()}/v2/open/tasks",
            headers={**_headers(include_content_type=True), "Idempotency-Key": idempotency_key},
            json={
                "operation": "pdf_to_ppt",
                "input": {
                    "upload_id": upload_id,
                    "page_no": list(range(len(image_paths))),
                    "title": title,
                },
            },
            timeout=(20, 300),
        )
        task_payload = _read_codia_payload(task_response)
        task_id = task_payload.get("task_id") if isinstance(task_payload, dict) else None
        if not task_id:
            raise RuntimeError("导出任务创建成功但没有返回任务编号")

        return success_response(
            data={"task_id": task_id, "page_count": len(image_paths)},
            message="PPTX 导出任务已创建",
        )
    except RuntimeError as exc:
        return _error(str(exc), 502)
    except requests.RequestException as exc:
        return _error(f"连接 Codia 导出接口失败：{exc}", 502)
    except (OSError, ValueError) as exc:
        return _error(f"生成导出 PDF 失败：{exc}", 500)


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
