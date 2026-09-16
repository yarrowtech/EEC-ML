from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableLambda
from app.core.privacy import redact_text, redact_model_input, redact_value
from app.core.config import settings
from app.core import llm
from app.modules.assessment import service


def test_contact_and_labeled_identifiers_removed_without_changing_math():
    text = 'Student name: Ada Lovelace\nEmail ada@example.com, phone +91 9876543210\nAddress: 12 School Road\n2 + 3 = 5; photosynthesis uses CO2.'
    result = redact_text(text)
    for value in ['Ada Lovelace', 'ada@example.com', '9876543210', '12 School Road']:
        assert value not in result
    assert '2 + 3 = 5; photosynthesis uses CO2.' in result


def test_messages_are_redacted_without_mutating_original():
    original = [SystemMessage(content='Email a@example.com'), HumanMessage(content=[{'type': 'text', 'text': 'Mobile: 9876543210'}])]
    result = redact_model_input(original)
    assert result[0].type == 'system'
    assert 'a@example.com' not in result[0].content
    assert '9876543210' not in str(result[1].content)
    assert original[0].content == 'Email a@example.com'


def test_external_generation_receives_only_redacted_input(monkeypatch):
    import langchain_openai
    received = []
    monkeypatch.setattr(settings, 'openrouter_api_key', 'test')
    monkeypatch.setattr(langchain_openai, 'ChatOpenAI', lambda **_: RunnableLambda(lambda value: received.append(value) or 'answer'))
    assert llm.create_chain().invoke([HumanMessage(content='Contact a@example.com')]) == 'answer'
    assert 'a@example.com' not in received[0][0].content


def test_assessment_fallback_redacts_both_messages(monkeypatch):
    captured = {}
    class Response:
        def raise_for_status(self):
            pass
        def json(self):
            return {'choices': [{'message': {'content': 'feedback'}}]}
    def post(url, **kwargs):
        captured.update(kwargs)
        captured['url'] = url
        return Response()
    monkeypatch.setattr(service.httpx, 'post', post)
    assert service._call_openrouter('student id: 123456789012', 'Email teacher@example.com') == 'feedback'
    assert '123456789012' not in str(captured['json'])
    assert 'teacher@example.com' not in str(captured['json'])
    assert captured['json']['model'] == settings.openrouter_model


def test_existing_student_label_and_structured_keys_are_redacted():
    assert 'Ada' not in redact_text('Student: Ada, Class 5 A\nSubject: Maths')
    assert redact_value({'studentName': 'Ada', 'student_id': 'abc', 'score': 80}) == {
        'studentName': '[REDACTED]', 'student_id': '[REDACTED]', 'score': 80}
