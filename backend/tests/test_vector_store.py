import pytest
from app.services.chunker import CodeChunk
from app.services.vector_store import get_vector_store
from app.services.retriever import get_retriever

def create_sample_chunks(repo_id: str):
    return [
        CodeChunk(
            chunk_id=f"{repo_id}:auth.py:login:10",
            repository_id=repo_id,
            file_path="auth.py",
            symbol_name="login",
            chunk_type="function",
            start_line=10,
            end_line=25,
            content="def login(username, password):\n    \"\"\"Authenticate user and generate access token.\"\"\"\n    if verify_password(password):\n        return create_jwt_token(username)\n    return None",
            token_estimate=35,
        ),
        CodeChunk(
            chunk_id=f"{repo_id}:db.py:connect:1",
            repository_id=repo_id,
            file_path="db.py",
            symbol_name="create_connection",
            chunk_type="function",
            start_line=1,
            end_line=15,
            content="def create_connection(db_url: str):\n    \"\"\"Initialize SQLite database engine and sessionmaker.\"\"\"\n    engine = create_engine(db_url)\n    return sessionmaker(bind=engine)()",
            token_estimate=30,
        ),
        CodeChunk(
            chunk_id=f"{repo_id}:models.py:User:5",
            repository_id=repo_id,
            file_path="models.py",
            symbol_name="User",
            chunk_type="class",
            start_line=5,
            end_line=30,
            content="class User(Base):\n    \"\"\"SQLAlchemy model for user table.\"\"\"\n    __tablename__ = 'users'\n    id = Column(Integer, primary_key=True)\n    username = Column(String)\n    email = Column(String)",
            token_estimate=40,
        ),
    ]

def test_add_and_similarity_search():
    store = get_vector_store()
    repo_id = "test-repo-similarity"

    # Clean prior test state if any
    store.delete_repository_chunks(repo_id)

    chunks = create_sample_chunks(repo_id)
    added = store.add_chunks(chunks)
    assert added == 3

    assert store.get_repository_chunk_count(repo_id) == 3

    # Query for authentication
    results = store.similarity_search(
        query="Where is user login and password verification implemented?",
        repository_id=repo_id,
        top_k=2
    )

    assert len(results) == 2
    top_match = results[0]
    assert top_match["metadata"]["symbol"] == "login"
    assert top_match["metadata"]["file"] == "auth.py"
    assert top_match["similarity"] > 0.4
    assert 0.0 <= top_match["similarity"] <= 1.0

def test_repository_isolation():
    store = get_vector_store()
    repo_a = "repo-alpha"
    repo_b = "repo-beta"

    store.delete_repository_chunks(repo_a)
    store.delete_repository_chunks(repo_b)

    chunks_a = create_sample_chunks(repo_a)
    store.add_chunks(chunks_a)

    # Search for repo_b should return 0 results
    results_b = store.similarity_search("login", repository_id=repo_b, top_k=5)
    assert len(results_b) == 0

    # Search for repo_a returns results
    results_a = store.similarity_search("login", repository_id=repo_a, top_k=5)
    assert len(results_a) > 0
    for r in results_a:
        assert r["metadata"]["repository_id"] == repo_a

    # Cleanup
    store.delete_repository_chunks(repo_a)
    assert store.get_repository_chunk_count(repo_a) == 0

def test_retriever_context_assembly():
    store = get_vector_store()
    repo_id = "test-repo-retriever"
    store.delete_repository_chunks(repo_id)

    chunks = create_sample_chunks(repo_id)
    store.add_chunks(chunks)

    retriever = get_retriever()
    retrieval_data = retriever.retrieve(
        query="database engine connection",
        repository_id=repo_id,
        top_k=2
    )

    assert retrieval_data["total_retrieved"] == 2
    assert "create_connection" in retrieval_data["context_str"]
    assert len(retrieval_data["sources"]) == 2

    top_source = retrieval_data["sources"][0]
    assert top_source.file == "db.py"
    assert top_source.symbol == "create_connection"
    assert top_source.start_line == 1

    # Cleanup
    store.delete_repository_chunks(repo_id)
