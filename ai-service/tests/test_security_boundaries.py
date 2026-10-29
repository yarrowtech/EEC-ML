from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.modules.documents import service


def test_auth_fails_closed(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr(settings, "ai_service_internal_key", "")
    assert client.get("/openapi.json").status_code == 503
    assert client.get("/health").json() == {"status": "ok"}
    monkeypatch.setattr(settings, "ai_service_internal_key", "secret")
    assert client.get("/openapi.json").status_code == 401
    assert client.get("/openapi.json", headers={"X-Internal-Key": "wrong"}).status_code == 401
    assert client.get("/openapi.json", headers={"X-Internal-Key": "secret"}).status_code == 200


@pytest.mark.parametrize("url", [
    "http://res.cloudinary.com/file", "https://evil.example/file",
    "https://user:password@res.cloudinary.com/file",
    "https://res.cloudinary.com:8443/file",
])
def test_untrusted_download_urls_rejected(url):
    with pytest.raises(HTTPException):
        service._assert_public_host(url)


def test_private_dns_rejected(monkeypatch):
    monkeypatch.setattr(service.socket, "getaddrinfo", lambda *_: [(None, None, None, None, ("127.0.0.1", 443))])
    with pytest.raises(HTTPException):
        service._assert_public_host("https://res.cloudinary.com/file")


@pytest.mark.parametrize("status,chunks,expected", [(302, [], 400), (200, [b"123", b"456"], 413)])
def test_redirect_and_stream_limits(monkeypatch, tmp_path, status, chunks, expected):
    monkeypatch.setattr(service, "_assert_public_host", lambda _: None)
    monkeypatch.setattr(settings, "download_max_bytes", 5)
    monkeypatch.setattr(service.tempfile, "tempdir", str(tmp_path))
    response = MagicMock()
    response.status_code = status
    response.headers = {}
    response.iter_content.return_value = iter(chunks)
    response.__enter__.return_value = response
    get = MagicMock(return_value=response)
    monkeypatch.setattr(service.requests, "get", get)
    with pytest.raises(HTTPException) as error:
        service.download_to_temp("https://res.cloudinary.com/file", ".pdf")
    assert error.value.status_code == expected
    assert get.call_args.kwargs["allow_redirects"] is False
    assert list(tmp_path.iterdir()) == []
    response.__exit__.assert_called()
