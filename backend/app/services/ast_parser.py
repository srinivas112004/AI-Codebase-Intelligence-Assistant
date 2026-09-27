import ast
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

def _get_decorator_name(decorator_node: ast.AST) -> str:
    """Extract a readable decorator representation from an AST node."""
    try:
        return ast.unparse(decorator_node)
    except Exception:
        if isinstance(decorator_node, ast.Name):
            return decorator_node.id
        elif isinstance(decorator_node, ast.Attribute):
            return f"{_get_decorator_name(decorator_node.value)}.{decorator_node.attr}"
        elif isinstance(decorator_node, ast.Call):
            return _get_decorator_name(decorator_node.func)
        return "decorator"

def _extract_arguments(args_node: ast.arguments) -> List[str]:
    """Extract list of parameter names including pos-only, standard, varargs, and kwargs."""
    params: List[str] = []

    # Positional-only parameters (Python 3.8+)
    for arg in getattr(args_node, "posonlyargs", []):
        params.append(arg.arg)

    # Standard positional arguments
    for arg in args_node.args:
        params.append(arg.arg)

    # *vararg (e.g. *args)
    if args_node.vararg:
        params.append(f"*{args_node.vararg.arg}")

    # Keyword-only arguments
    for arg in getattr(args_node, "kwonlyargs", []):
        params.append(arg.arg)

    # **kwarg (e.g. **kwargs)
    if args_node.kwarg:
        params.append(f"**{args_node.kwarg.arg}")

    return params

def _slice_source(source_lines: List[str], start_line: int, end_line: int) -> str:
    """Extract source code corresponding to 1-indexed start and end line bounds."""
    start_idx = max(0, start_line - 1)
    end_idx = min(len(source_lines), end_line)
    return "\n".join(source_lines[start_idx:end_idx])

def parse_python_code(source_code: str, file_path: str = "") -> List[Dict[str, Any]]:
    """
    Parse Python source code using Python's native AST module.
    Extracts classes, methods, functions, docstrings, decorators, parameters, and line numbers.

    Resilient: Syntax errors in a single file will not crash the indexing pipeline.
    """
    if not source_code or not source_code.strip():
        return []

    try:
        tree = ast.parse(source_code, filename=file_path)
    except SyntaxError as e:
        logger.warning(f"Syntax error in '{file_path}' line {e.lineno}: {e.msg}. Skipping AST extraction for this file.")
        return []
    except Exception as e:
        logger.warning(f"Failed to parse AST for '{file_path}': {str(e)}. Skipping.")
        return []

    source_lines = source_code.splitlines()
    symbols: List[Dict[str, Any]] = []

    def process_function(
        fn_node: ast.FunctionDef | ast.AsyncFunctionDef,
        parent_class: Optional[str] = None
    ) -> Dict[str, Any]:
        start_line = fn_node.lineno
        end_line = getattr(fn_node, "end_lineno", start_line)
        docstring = ast.get_docstring(fn_node)
        decorators = [_get_decorator_name(d) for d in fn_node.decorator_list]
        args = _extract_arguments(fn_node.args)
        symbol_type = "method" if parent_class else "function"
        symbol_source = _slice_source(source_lines, start_line, end_line)

        return {
            "name": fn_node.name,
            "symbol_type": symbol_type,
            "parent_symbol": parent_class,
            "start_line": start_line,
            "end_line": end_line,
            "docstring": docstring,
            "args": json.dumps(args),
            "decorators": json.dumps(decorators),
            "source_code": symbol_source,
        }

    def process_class(class_node: ast.ClassDef) -> List[Dict[str, Any]]:
        class_symbols: List[Dict[str, Any]] = []
        start_line = class_node.lineno
        end_line = getattr(class_node, "end_lineno", start_line)
        docstring = ast.get_docstring(class_node)
        decorators = [_get_decorator_name(d) for d in class_node.decorator_list]
        class_source = _slice_source(source_lines, start_line, end_line)

        # Base classes
        bases: List[str] = []
        for b in class_node.bases:
            try:
                bases.append(ast.unparse(b))
            except Exception:
                pass

        class_symbol = {
            "name": class_node.name,
            "symbol_type": "class",
            "parent_symbol": None,
            "start_line": start_line,
            "end_line": end_line,
            "docstring": docstring,
            "args": json.dumps(bases),  # store base classes in args field for classes
            "decorators": json.dumps(decorators),
            "source_code": class_source,
        }
        class_symbols.append(class_symbol)

        # Extract methods within the class
        for body_item in class_node.body:
            if isinstance(body_item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                method_symbol = process_function(body_item, parent_class=class_node.name)
                class_symbols.append(method_symbol)
            elif isinstance(body_item, ast.ClassDef):
                # Nested class support
                nested_symbols = process_class(body_item)
                class_symbols.extend(nested_symbols)

        return class_symbols

    # Walk top-level module items
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            symbols.append(process_function(node))
        elif isinstance(node, ast.ClassDef):
            symbols.extend(process_class(node))
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            start_line = node.lineno
            end_line = getattr(node, "end_lineno", start_line)
            names = [alias.name for alias in node.names]
            module_name = getattr(node, "module", "") or ""
            display_name = f"from {module_name} import {', '.join(names)}" if module_name else f"import {', '.join(names)}"

            symbols.append({
                "name": display_name,
                "symbol_type": "import",
                "parent_symbol": None,
                "start_line": start_line,
                "end_line": end_line,
                "docstring": None,
                "args": json.dumps(names),
                "decorators": json.dumps([]),
                "source_code": _slice_source(source_lines, start_line, end_line),
            })

    return symbols
