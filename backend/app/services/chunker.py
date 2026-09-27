import re
import uuid
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from app.services.ast_parser import parse_python_code

# Max character limit before triggering fallback line-based sub-chunking
# all-MiniLM-L6-v2 handles up to 256/512 tokens (~1500-2000 chars)
MAX_CHUNK_CHARS = 1800
CHUNK_OVERLAP_LINES = 10

@dataclass
class CodeChunk:
    chunk_id: str
    repository_id: str
    file_path: str
    symbol_name: str
    chunk_type: str  # "function", "method", "class", "module", "documentation"
    start_line: int
    end_line: int
    content: str
    token_estimate: int

    def to_metadata(self) -> Dict[str, Any]:
        """ChromaDB metadata dictionary (values must be str, int, float, or bool)."""
        return {
            "repository_id": self.repository_id,
            "file": self.file_path,
            "symbol": self.symbol_name,
            "type": self.chunk_type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "token_estimate": self.token_estimate,
        }

    def to_searchable_text(self) -> str:
        """
        Embeddable text incorporating file and symbol context for enhanced semantic retrieval.
        Prefixing file name and symbol type allows semantic search to match both keyword references
        and structural code logic.
        """
        header = f"# File: {self.file_path}\n# Symbol: {self.symbol_name} ({self.chunk_type})\n# Lines: {self.start_line}-{self.end_line}\n"
        return header + self.content

def _estimate_tokens(text: str) -> int:
    """Rough estimation of token count (~4 characters per token)."""
    return max(1, len(text) // 4)

def _split_oversized_content(
    content: str,
    start_line: int,
    file_path: str,
    symbol_name: str,
    chunk_type: str,
    repository_id: str,
) -> List[CodeChunk]:
    """
    Fallback splitting strategy for unusually large functions or classes.
    Splits by line boundaries with sliding overlap to preserve context continuity.
    """
    lines = content.splitlines()
    if not lines:
        return []

    chunks: List[CodeChunk] = []
    lines_per_chunk = 60
    step = lines_per_chunk - CHUNK_OVERLAP_LINES

    part = 1
    for i in range(0, len(lines), step):
        chunk_lines = lines[i : i + lines_per_chunk]
        chunk_content = "\n".join(chunk_lines)
        chunk_start = start_line + i
        chunk_end = chunk_start + len(chunk_lines) - 1

        sub_symbol = f"{symbol_name} (part {part})"
        chunk_id = f"{repository_id}:{file_path}:{symbol_name}:p{part}:{chunk_start}"

        chunks.append(
            CodeChunk(
                chunk_id=chunk_id,
                repository_id=repository_id,
                file_path=file_path,
                symbol_name=sub_symbol,
                chunk_type=chunk_type,
                start_line=chunk_start,
                end_line=chunk_end,
                content=chunk_content,
                token_estimate=_estimate_tokens(chunk_content),
            )
        )
        part += 1

        if i + lines_per_chunk >= len(lines):
            break

    return chunks

def chunk_python_code(
    source_code: str,
    file_path: str,
    repository_id: str
) -> List[CodeChunk]:
    """
    Extract meaningful code-aware chunks using Python AST symbol boundaries.
    Produces chunks for:
    1. Module-level preamble (docstrings + imports)
    2. Classes (headers & declarations)
    3. Methods (with enclosing class context)
    4. Standalone functions
    Applies token-based fallback splitting if any symbol exceeds MAX_CHUNK_CHARS.
    """
    if not source_code or not source_code.strip():
        return []

    source_lines = source_code.splitlines()
    symbols = parse_python_code(source_code, file_path=file_path)
    chunks: List[CodeChunk] = []

    # 1. Module-level imports & preamble chunk
    import_symbols = [s for s in symbols if s["symbol_type"] == "import"]
    non_import_symbols = [s for s in symbols if s["symbol_type"] != "import"]

    first_symbol_line = min([s["start_line"] for s in non_import_symbols]) if non_import_symbols else len(source_lines) + 1
    if first_symbol_line > 1:
        preamble_lines = source_lines[: first_symbol_line - 1]
        preamble_text = "\n".join(preamble_lines).strip()
        if preamble_text:
            chunks.append(
                CodeChunk(
                    chunk_id=f"{repository_id}:{file_path}:module_preamble:1",
                    repository_id=repository_id,
                    file_path=file_path,
                    symbol_name="module_preamble",
                    chunk_type="module",
                    start_line=1,
                    end_line=first_symbol_line - 1,
                    content=preamble_text,
                    token_estimate=_estimate_tokens(preamble_text),
                )
            )

    # 2. Symbol-based chunks (classes, methods, functions)
    for sym in non_import_symbols:
        content = sym["source_code"].strip()
        if not content:
            continue

        sym_name = sym["name"]
        if sym["parent_symbol"]:
            sym_name = f"{sym['parent_symbol']}.{sym_name}"

        # If symbol exceeds threshold, apply fallback chunking
        if len(content) > MAX_CHUNK_CHARS:
            sub_chunks = _split_oversized_content(
                content=sym["source_code"],
                start_line=sym["start_line"],
                file_path=file_path,
                symbol_name=sym_name,
                chunk_type=sym["symbol_type"],
                repository_id=repository_id,
            )
            chunks.extend(sub_chunks)
        else:
            chunk_id = f"{repository_id}:{file_path}:{sym_name}:{sym['start_line']}"
            chunks.append(
                CodeChunk(
                    chunk_id=chunk_id,
                    repository_id=repository_id,
                    file_path=file_path,
                    symbol_name=sym_name,
                    chunk_type=sym["symbol_type"],
                    start_line=sym["start_line"],
                    end_line=sym["end_line"],
                    content=content,
                    token_estimate=_estimate_tokens(content),
                )
            )

    # If file contains no functions or classes (e.g. simple configuration script), chunk entire file
    if not non_import_symbols and source_lines:
        content = source_code.strip()
        if len(content) > MAX_CHUNK_CHARS:
            chunks.extend(
                _split_oversized_content(
                    content=source_code,
                    start_line=1,
                    file_path=file_path,
                    symbol_name="module",
                    chunk_type="module",
                    repository_id=repository_id,
                )
            )
        else:
            chunks.append(
                CodeChunk(
                    chunk_id=f"{repository_id}:{file_path}:module:1",
                    repository_id=repository_id,
                    file_path=file_path,
                    symbol_name="module",
                    chunk_type="module",
                    start_line=1,
                    end_line=len(source_lines),
                    content=content,
                    token_estimate=_estimate_tokens(content),
                )
            )

    return chunks

def chunk_markdown(
    markdown_text: str,
    file_path: str,
    repository_id: str
) -> List[CodeChunk]:
    """
    Chunk Markdown files by header boundaries (#, ##, ###) or paragraphs.
    """
    if not markdown_text or not markdown_text.strip():
        return []

    lines = markdown_text.splitlines()
    chunks: List[CodeChunk] = []

    current_section = "intro"
    current_lines: List[str] = []
    section_start = 1

    header_pattern = re.compile(r"^(#{1,3})\s+(.+)$")

    for idx, line in enumerate(lines):
        line_num = idx + 1
        match = header_pattern.match(line.strip())

        if match:
            if current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    chunks.append(
                        CodeChunk(
                            chunk_id=f"{repository_id}:{file_path}:{current_section}:{section_start}",
                            repository_id=repository_id,
                            file_path=file_path,
                            symbol_name=current_section,
                            chunk_type="documentation",
                            start_line=section_start,
                            end_line=line_num - 1,
                            content=content,
                            token_estimate=_estimate_tokens(content),
                        )
                    )
            current_section = match.group(2).strip()
            current_lines = [line]
            section_start = line_num
        else:
            current_lines.append(line)

    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            chunks.append(
                CodeChunk(
                    chunk_id=f"{repository_id}:{file_path}:{current_section}:{section_start}",
                    repository_id=repository_id,
                    file_path=file_path,
                    symbol_name=current_section,
                    chunk_type="documentation",
                    start_line=section_start,
                    end_line=len(lines),
                    content=content,
                    token_estimate=_estimate_tokens(content),
                )
            )

    return chunks

def create_chunks_for_file(
    content: str,
    file_path: str,
    language: str,
    repository_id: str
) -> List[CodeChunk]:
    """Dispatch file content to appropriate code-aware chunker based on language."""
    if language == "python":
        return chunk_python_code(content, file_path, repository_id)
    elif language == "markdown":
        return chunk_markdown(content, file_path, repository_id)
    else:
        # Fallback line chunker for other files (.json, .yaml)
        lines = content.splitlines()
        return [
            CodeChunk(
                chunk_id=f"{repository_id}:{file_path}:file:1",
                repository_id=repository_id,
                file_path=file_path,
                symbol_name="config",
                chunk_type="configuration",
                start_line=1,
                end_line=max(1, len(lines)),
                content=content[:MAX_CHUNK_CHARS],
                token_estimate=_estimate_tokens(content[:MAX_CHUNK_CHARS]),
            )
        ]
