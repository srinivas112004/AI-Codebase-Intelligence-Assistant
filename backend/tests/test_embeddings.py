import math
import pytest
from app.services.embeddings import get_embedding_service

def test_embedding_dimension_and_normalization():
    service = get_embedding_service()
    dim = service.get_embedding_dimension()
    assert dim == 384

    vec = service.embed_text("def login(username, password): pass")
    assert len(vec) == 384

    # Test normalization: magnitude should be approximately 1.0
    norm = math.sqrt(sum(x * x for x in vec))
    assert pytest.approx(norm, abs=1e-3) == 1.0

def test_batch_embed_documents():
    service = get_embedding_service()
    docs = [
        "class UserService: pass",
        "def query_database(): pass",
        "# Preamble import statement"
    ]
    vecs = service.embed_documents(docs, batch_size=2)
    assert len(vecs) == 3
    for v in vecs:
        assert len(v) == 384
        norm = math.sqrt(sum(x * x for x in v))
        assert pytest.approx(norm, abs=1e-3) == 1.0

def test_semantic_similarity_separation():
    """
    Verify that semantically related code produces higher cosine similarity than unrelated code.
    Query: 'user authentication'
    Code A: 'def authenticate_user(username, password): verify_token()'
    Code B: 'def compute_circle_radius(diameter): return diameter / 2'
    """
    service = get_embedding_service()

    query_vec = service.embed_query("user authentication and login credentials")
    auth_vec = service.embed_text("def authenticate_user(username, password):\n    return verify_token(password)")
    math_vec = service.embed_text("def compute_circle_area(radius):\n    return 3.14159 * radius * radius")

    # Since vectors are unit-normalized, dot product is exact cosine similarity: cos(A, B) = A . B
    sim_auth = sum(q * a for q, a in zip(query_vec, auth_vec))
    sim_math = sum(q * m for q, m in zip(query_vec, math_vec))

    # Similarity with auth code should be noticeably higher than math code
    assert sim_auth > sim_math
    assert sim_auth > 0.4
