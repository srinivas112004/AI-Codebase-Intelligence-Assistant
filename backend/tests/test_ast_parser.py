import json
from app.services.ast_parser import parse_python_code

SAMPLE_PYTHON_CODE = '''import os
from typing import List, Optional

class UserService:
    """Service handling user account operations."""

    def __init__(self, db_client):
        self.db = db_client

    @classmethod
    def create_user(cls, username: str, email: str, role: str = "member"):
        """Create a new user record in database."""
        return {"username": username, "email": email, "role": role}

    def delete_user(self, user_id: int):
        pass

def login(username, password, *args, **kwargs):
    """Authenticate credentials and generate token."""
    if username == "admin":
        return True
    return False
'''

def test_extract_classes_and_methods():
    symbols = parse_python_code(SAMPLE_PYTHON_CODE, "user_service.py")

    # Find class
    class_syms = [s for s in symbols if s["symbol_type"] == "class"]
    assert len(class_syms) == 1
    user_service = class_syms[0]
    assert user_service["name"] == "UserService"
    assert user_service["docstring"] == "Service handling user account operations."
    assert user_service["start_line"] == 4

    # Find methods under UserService
    methods = [s for s in symbols if s["symbol_type"] == "method" and s["parent_symbol"] == "UserService"]
    assert len(methods) == 3

    method_names = [m["name"] for m in methods]
    assert "__init__" in method_names
    assert "create_user" in method_names
    assert "delete_user" in method_names

    # Check create_user method details
    create_method = next(m for m in methods if m["name"] == "create_user")
    args = json.loads(create_method["args"])
    assert "cls" in args
    assert "username" in args
    assert "email" in args
    assert "role" in args
    assert create_method["docstring"] == "Create a new user record in database."
    decorators = json.loads(create_method["decorators"])
    assert "classmethod" in decorators

def test_extract_standalone_function():
    symbols = parse_python_code(SAMPLE_PYTHON_CODE, "user_service.py")

    functions = [s for s in symbols if s["symbol_type"] == "function"]
    assert len(functions) == 1
    login_fn = functions[0]
    assert login_fn["name"] == "login"
    assert login_fn["parent_symbol"] is None
    args = json.loads(login_fn["args"])
    assert "username" in args
    assert "password" in args
    assert "*args" in args
    assert "**kwargs" in args
    assert login_fn["docstring"] == "Authenticate credentials and generate token."
    assert "def login" in login_fn["source_code"]

def test_extract_imports():
    symbols = parse_python_code(SAMPLE_PYTHON_CODE, "user_service.py")

    imports = [s for s in symbols if s["symbol_type"] == "import"]
    assert len(imports) == 2
    import_names = [i["name"] for i in imports]
    assert "import os" in import_names
    assert "from typing import List, Optional" in import_names

def test_syntax_error_handling():
    broken_code = "def broken_syntax(:\n    return missing_paren"
    # Should not raise exception
    symbols = parse_python_code(broken_code, "broken.py")
    assert symbols == []

def test_empty_source():
    assert parse_python_code("", "empty.py") == []
    assert parse_python_code("   \n\n  ", "whitespace.py") == []
