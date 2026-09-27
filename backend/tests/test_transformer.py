import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.transformer.attention import get_attention_service

client = TestClient(app)

def test_self_attention_mathematical_properties():
    """Verify self-attention calculation adheres to mathematical transformer specs."""
    service = get_attention_service()
    sentence = "The cat sat on the mat"
    res = service.compute_self_attention(sentence)

    # 1. Token dimensions match
    num_tokens = len(res.tokens)
    assert num_tokens > 0
    assert len(res.token_ids) == num_tokens
    assert len(res.attention_weights) == num_tokens

    # 2. Square matrix N x N
    for row in res.attention_weights:
        assert len(row) == num_tokens

    # 3. Softmax properties: Each row must sum to 1.0 (within float rounding)
    for row_idx, row in enumerate(res.attention_weights):
        row_sum = sum(row)
        assert abs(row_sum - 1.0) < 0.01, f"Row {row_idx} does not sum to 1.0 (sum={row_sum})"
        for val in row:
            assert 0.0 <= val <= 1.0, f"Value {val} outside [0, 1] range"

    # 4. Projections & Snippets
    assert res.q_snippet is not None
    assert len(res.q_snippet) == num_tokens
    assert len(res.q_snippet[0]) == 6  # 6-dim preview
    assert res.d_k == 64
    assert res.d_model == 64
    assert abs(res.scale_factor - 0.125) < 0.001


def test_self_attention_empty_input_rejected():
    """Verify empty or whitespace strings are cleanly rejected."""
    service = get_attention_service()
    with pytest.raises(ValueError):
        service.compute_self_attention("")

    with pytest.raises(ValueError):
        service.compute_self_attention("   ")


def test_transformer_api_endpoint():
    """Verify POST /api/transformer/attention HTTP endpoint."""
    payload = {"text": "Transformers enable attention"}
    response = client.post("/api/transformer/attention", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["text"] == "Transformers enable attention"
    assert "tokens" in data
    assert "attention_weights" in data
    assert len(data["tokens"]) == len(data["attention_weights"])

    # Test invalid empty text
    err_res = client.post("/api/transformer/attention", json={"text": ""})
    assert err_res.status_code in [400, 422]
