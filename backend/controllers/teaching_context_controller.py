"""Teacher-facing dialogue; model credentials remain on the backend."""
import logging

from flask import Blueprint, current_app, request
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from services.teaching_context import initial_state, advance, generation_prompt, DialogueFormatError
from services.ai_providers import get_text_provider
from utils import success_response, error_response

teaching_context_bp = Blueprint("teaching_context", __name__, url_prefix="/api/teaching-context")
logger = logging.getLogger(__name__)


def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="teaching-context-v1")


def _read_state(token):
    if not isinstance(token, str) or len(token) > 90000:
        raise ValueError("需求会话无法读取，请重新填写。")
    try:
        state = _serializer().loads(token, max_age=86400)
        if not isinstance(state, dict) or not isinstance(state.get("turn"), int) or not isinstance(state.get("messages"), list):
            raise ValueError("需求会话无法读取，请重新填写。")
        return state
    except (BadSignature, SignatureExpired):
        raise ValueError("需求会话已过期，请重新填写。") from None


def _view(state):
    return {"state_token": _serializer().dumps(state), "messages": state["messages"],
            "turn": state["turn"], "status": state["status"], "summary": state["summary"]}


@teaching_context_bp.post("/chat")
def chat():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("INVALID_REQUEST", "无法读取请求，请重试。", 400)
    try:
        token = data.get("state_token")
        if not token:
            if data.get("message"):
                raise ValueError("请先开始需求采集。")
            return success_response(_view(initial_state()))
        state = _read_state(token)
        message = data.get("message")
        if not isinstance(message, str) or not message.strip() or len(message) > 6000:
            raise ValueError("请输入需求内容，单次最多6000字。")
        model = current_app.config["TEXT_MODEL"]
        state = advance(state, message.strip(), get_text_provider(model=model))
        return success_response(_view(state))
    except DialogueFormatError:
        return error_response("AI_RESPONSE_INVALID", "模型未返回完整的需求信息，请重试当前回复。", 502)
    except ValueError as error:
        # Only our validation messages are safe to display. Provider errors may contain credentials.
        if str(error).startswith(("需求会话", "请先", "请输入", "本轮")):
            return error_response("INVALID_DIALOGUE", str(error), 400)
        logger.warning("Teaching dialogue failed (%s)", type(error).__name__)
        return error_response("AI_UNAVAILABLE", "文本模型配置不可用，请检查服务端文本模型设置后重试。", 503)
    except Exception as error:
        logger.warning("Teaching dialogue upstream failure (%s)", type(error).__name__)
        return error_response("AI_UNAVAILABLE", "文本模型暂时无法响应，请重试当前回复；已确认的对话会保留。", 503)


@teaching_context_bp.post("/handoff")
def handoff():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return error_response("INVALID_REQUEST", "无法读取请求，请重试。", 400)
    try:
        state = _read_state(data.get("state_token"))
        prompt = generation_prompt(state)
        return success_response({"context": {"生成要求": prompt, "课件设计": state["parameters"]["模板风格"]["value"]},
                                 "notes": {"需求总结": state["summary"]}})
    except ValueError as error:
        return error_response("INVALID_HANDOFF", str(error), 400)


@teaching_context_bp.post("/parameters")
def parameters():
    """Show collected values on the dedicated page, including older signed sessions.

    Chat replies stay conversational. Only teacher-provided source quotes are
    exposed here, while default and inference reasoning stays on the backend.
    Reading the snapshot does not make another model request.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("INVALID_REQUEST", "无法读取请求，请重试。", 400)
    try:
        state = _read_state(data.get("state_token"))
    except ValueError as error:
        return error_response("INVALID_DIALOGUE", str(error), 400)

    scene_fields = {
        "课时分配", "教室类型", "教室规模", "教室布局", "教学设备-硬件",
        "课堂氛围", "师生互动模式",
    }
    items = [
        {"name": name, "value": entry["value"], "source": entry["source"],
         "evidence": entry.get("evidence", "") if entry["source"] == "teacher" else "",
         "group": "scene" if name in scene_fields else "teacher"}
        for name, entry in state["parameters"].items()
    ]
    return success_response({"parameters": items, "supplementary": state.get("supplementary", [])})
