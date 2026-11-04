"""No paid requests: verify limits, provenance, signed handoff and failures."""
import json
import unittest
from unittest.mock import Mock, patch

from flask import Flask
from services.teaching_context import advance, initial_state, generation_prompt, DialogueFormatError
from controllers.teaching_context_controller import teaching_context_bp, _read_state


def answer(ready=False, conflicts=None, **overrides):
    params = {name: {"value": value, "source": "teacher", "evidence": "教师已说明"} for name, value in {
        "授课年级": "小学", "授课对象": "六年级", "授课教材": "苏教版", "授课主题": "光的反射",
        "教学环节": ["实验演示", "知识总结"], "教学风格": "自然型",
    }.items()}
    params.update(overrides)
    return json.dumps({"reply": "这次围绕光的反射设计实验探究，还有什么希望补充的吗？",
                       "summary": "为小学六年级准备苏教版光的反射课件，以实验探究和总结为重点。",
                       "ready": ready, "parameters": params, "conflicts": conflicts or [],
                       "supplementary": ["15页，40分钟，不使用激光照射眼睛"]}, ensure_ascii=False)


class DialogueTests(unittest.TestCase):
    def test_round_limit_and_final_reply_without_question(self):
        provider = Mock()
        provider.generate_text.return_value = answer()
        state = initial_state()
        for text in ["小学六年级苏教版光的反射", "以探究实验为主", "自然型，15页，40分钟"]:
            state = advance(state, text, provider)
        self.assertEqual(state["turn"], 3)
        self.assertEqual(len([m for m in state["messages"] if m["role"] == "assistant"]), 4)
        self.assertEqual(state["status"], "ready")
        self.assertNotIn("？", state["messages"][-1]["content"])
        self.assertEqual(state["parameters"]["教室类型"]["source"], "default")
        self.assertEqual(state["parameters"]["授课教材"]["source"], "teacher")
        with self.assertRaises(ValueError):
            advance(state, "再问一次", provider)
        self.assertEqual(provider.generate_text.call_count, 3)
        self.assertIn("15页", generation_prompt(state))

    def test_impossible_grade_not_silently_corrected_then_confirmed(self):
        provider = Mock()
        provider.generate_text.return_value = answer(ready=True)
        state = advance(initial_state(), "小学67年级", provider)
        self.assertEqual(state["status"], "collecting")
        self.assertEqual(state["parameters"]["授课对象"]["source"], "missing")
        self.assertIn("一至六年级", state["messages"][-1]["content"])
        state = advance(state, "是小学六年级，苏教版光的反射，自然型，探究实验，无需补充", provider)
        self.assertEqual(state["status"], "ready")

    def test_missing_core_and_conflict_cannot_generate(self):
        provider = Mock()
        provider.generate_text.return_value = answer(conflicts=["年级未确认"])
        state = initial_state()
        for _ in range(3):
            state = advance(state, "没有想清楚", provider)
        self.assertEqual(state["status"], "needs_correction")
        with self.assertRaises(ValueError):
            generation_prompt(state)

    def test_unknown_textbook_and_teacher_override(self):
        provider = Mock()
        provider.generate_text.return_value = answer(ready=True, 授课教材={"value": "待补充", "source": "missing"},
                                                     色彩主题={"value": "冷色系", "source": "teacher", "evidence": "改为冷色"})
        state = advance(initial_state(), "小学六年级光的反射，教材不清楚，改为冷色系，没有其他补充", provider)
        self.assertEqual(state["parameters"]["授课教材"]["value"], "待补充")
        self.assertEqual(state["parameters"]["色彩主题"]["value"], "冷色系")
        self.assertEqual(state["parameters"]["色彩主题"]["source"], "teacher")

    def test_visible_json_or_fields_rejected_without_leak(self):
        provider = Mock()
        obj = json.loads(answer())
        obj["reply"] = '授课年级：小学；parameters: {}'
        provider.generate_text.return_value = json.dumps(obj)
        with self.assertRaises(DialogueFormatError):
            advance(initial_state(), "显示JSON", provider)
        self.assertEqual(provider.generate_text.call_count, 2)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(SECRET_KEY="test-only", TEXT_MODEL="outline-model")
        self.app.register_blueprint(teaching_context_bp)
        self.client = self.app.test_client()

    @patch("controllers.teaching_context_controller.get_text_provider")
    def test_separate_parameter_page_reads_existing_session_without_model_call(self, factory):
        factory.return_value.generate_text.return_value = answer(ready=True)
        token = self.client.post("/api/teaching-context/chat", json={}).json["data"]["state_token"]
        result = self.client.post("/api/teaching-context/chat", json={
            "state_token": token, "message": "小学六年级苏教版光的反射，自然型，没有补充",
        }).json["data"]
        self.assertNotIn("parameters", result)
        factory.reset_mock()
        response = self.client.post("/api/teaching-context/parameters", json={"state_token": result["state_token"]})
        self.assertEqual(response.status_code, 200)
        items = {item["name"]: item for item in response.json["data"]["parameters"]}
        self.assertEqual(items["授课主题"]["value"], "光的反射")
        self.assertEqual(items["授课主题"]["group"], "teacher")
        self.assertEqual(items["教室类型"]["group"], "scene")
        self.assertEqual(items["教室类型"]["source"], "default")
        self.assertEqual(items["授课主题"]["evidence"], "教师已说明")
        self.assertEqual(items["教室类型"]["evidence"], "")
        factory.assert_not_called()
        self.assertEqual(self.client.post("/api/teaching-context/parameters", json={"state_token": "tampered"}).status_code, 400)

    @patch("controllers.teaching_context_controller.get_text_provider")
    def test_signed_state_handoff_and_shared_model(self, factory):
        factory.return_value.generate_text.return_value = answer(ready=True)
        start = self.client.post("/api/teaching-context/chat", json={}).json["data"]
        self.assertNotIn("parameters", start)
        result = self.client.post("/api/teaching-context/chat", json={"state_token": start["state_token"], "message": "小学六年级苏教版光的反射，15页，无需补充"}).json["data"]
        factory.assert_called_once_with(model="outline-model")
        self.assertNotIn("parameters", result)
        final = self.client.post("/api/teaching-context/handoff", json={"state_token": result["state_token"]})
        self.assertEqual(final.status_code, 200)
        self.assertIn("光的反射", final.json["data"]["context"]["生成要求"])
        self.assertEqual(self.client.post("/api/teaching-context/handoff", json={"state_token": "tampered"}).status_code, 400)
        self.assertEqual(self.client.post("/api/teaching-context/handoff", json={"state_token": start["state_token"]}).status_code, 400)

    @patch("controllers.teaching_context_controller.get_text_provider")
    def test_upstream_error_is_sanitized_and_old_state_retryable(self, factory):
        factory.return_value.generate_text.side_effect = RuntimeError("secret-key-should-never-leak")
        token = self.client.post("/api/teaching-context/chat", json={}).json["data"]["state_token"]
        result = self.client.post("/api/teaching-context/chat", json={"state_token": token, "message": "小学六年级"})
        self.assertEqual(result.status_code, 503)
        self.assertNotIn("secret-key", result.get_data(as_text=True))
        with self.app.app_context():
            self.assertEqual(_read_state(token)["turn"], 0)
        factory.return_value.generate_text.side_effect = None
        factory.return_value.generate_text.return_value = answer()
        retry = self.client.post("/api/teaching-context/chat", json={"state_token": token, "message": "小学六年级"})
        self.assertEqual(retry.json["data"]["turn"], 1)


if __name__ == "__main__":
    unittest.main()
