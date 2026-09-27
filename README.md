# ⚡ AI Codebase Intelligence Assistant

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.2+-ee4c2c.svg?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.4+-orange.svg)](https://www.trychroma.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev/)
[![Tests Passing](https://img.shields.io/badge/Tests-35%20Passed-emerald.svg)](backend/tests/)

An interview-ready, full-stack AI system that deeply understands Python codebases through **native AST parsing**, **symbol-boundary chunking**, **Sentence Transformers (`all-MiniLM-L6-v2`)**, **persistent ChromaDB vector storage**, **grounded RAG via Google Gemini**, an educational **PyTorch Self-Attention Laboratory**, and automated **Bandit SAST security scanning**.

Zero external microservices, Docker, or Kubernetes required—everything runs locally on standard CPU hardware with SQLite and ChromaDB.

---

## 🌟 Key Capabilities & Architecture

```text
 ┌────────────────┐      ┌─────────────────┐      ┌──────────────────┐
 │  Code Ingestion│ ───► │Python AST Parser│ ───► │Code-Aware Chunker│
 │ (ZIP / GitHub) │      │ (ast.NodeVisitor│      │(Symbol Boundaries│
 └────────────────┘      └─────────────────┘      └──────────────────┘
                                                           │
                                                           ▼
 ┌────────────────┐      ┌─────────────────┐      ┌──────────────────┐
 │  Grounded RAG  │ ◄─── │ ChromaDB Vector │ ◄─── │SentenceTransform │
 │ (Gemini Flash) │      │ (HNSW Cosine)   │      │ (all-MiniLM-L6-v2│
 └────────────────┘      └─────────────────┘      └──────────────────┘
```

1. **Deterministic Code Ingestion & Safety**:
   - Ingest codebases via **ZIP archive upload** (with strict Zip-Slip path traversal defense) or **public GitHub repository clone** (`git clone --depth 1`).
   - Multi-tenant directory isolation and non-Python file filtering.

2. **Native Python Abstract Syntax Tree (AST) Parsing**:
   - Uses Python's native `ast.NodeVisitor` to extract classes, standalone functions, methods, docstrings, argument signatures, and exact line bounds with zero hallucination.
   - Syntax-error tolerant with graceful fallback for partial or invalid scripts.

3. **Code-Aware Semantic Chunking**:
   - Chunks along natural AST symbol boundaries rather than arbitrary token breaks.
   - Preserves module preamble (imports, constants) across chunks and windows oversized functions with line-based overlapping fallbacks.

4. **Dense Vector Embeddings & Persistent ChromaDB**:
   - `SentenceTransformer('all-MiniLM-L6-v2')` producing 384-dimensional unit-normalized embeddings locally on CPU.
   - ChromaDB persistent storage with HNSW cosine distance indexing and repository metadata filtering (`where={"repository_id": ...}`).

5. **Grounded RAG with Google Gemini**:
   - Grounded context synthesis via `google-genai` and `gemini-2.5-flash`.
   - Strict zero-hallucination prompt ensuring answers are derived **only** from retrieved chunks with exact source attribution badges `[file.py (lines X-Y)]`.
   - Deterministic refusal guard when 0 chunks match the user query.

6. **Educational PyTorch Self-Attention Laboratory**:
   - Pure PyTorch implementation of linear projections ($Q, K, V$), scaled dot-product attention $\text{Softmax}\left(\frac{Q K^T}{\sqrt{d_k}}\right) V$, and an interactive 2D attention heatmap.

7. **Bandit SAST Security Scanner**:
   - Programmatic Bandit vulnerability scanner detecting insecure code patterns, CWE classifications, and severity rankings with automated AI remediation guides.

8. **Executive Developer Dashboard**:
   - Sleek developer UI with glassmorphic navbar, 5 KPI cards, interactive 5-stage architecture pipeline visualizer, live search/filtering, grid/table view toggles, and deep links into every module.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn, Python-Multipart |
| **Vector & AI** | ChromaDB 0.4+, Sentence Transformers (`all-MiniLM-L6-v2`), Google Gemini (`google-genai` 2.25+) |
| **Deep Learning** | PyTorch 2.2+ (CPU inference), Hugging Face Transformers |
| **Static Analysis** | Python `ast`, Bandit SAST 1.7+ |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Axios, Lucide React, JetBrains Mono |
| **Storage** | SQLite (`data/app.db`), Persistent ChromaDB (`data/chroma`) |
| **Testing** | Pytest, Pytest-Asyncio, HTTPX TestClient (35 passed tests) |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python**: 3.10+ (tested on Python 3.12)
- **Node.js**: 18+ (tested with npm 10+)
- **Git**
- *(Optional)* Free **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

---

### 2. Clone Repository & Setup Environment

```bash
# Clone the repository
git clone https://github.com/your-username/ai-codebase-intelligence-assistant.git
cd ai-codebase-intelligence-assistant

# Create your .env file from the example
cp .env.example .env
```

Open `.env` and add your Gemini API key:
```env
GEMINI_API_KEY=AIzaSyYourActualKeyHere
GEMINI_MODEL=gemini-2.5-flash
```

---

### 3. Backend Setup & Startup

```powershell
# Navigate to the backend directory
cd backend

# Create virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI backend server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 4. Frontend Setup & Startup

In a **separate terminal**:

```powershell
# Navigate to the frontend directory
cd frontend

# Install npm dependencies
npm install

# Start the Vite development server
npm run dev
```

Open your browser at **[http://localhost:5173](http://localhost:5173)**.

---

## 🧪 Running Automated Tests

### Backend Test Suite (35 Tests)
```powershell
cd backend
.\venv\Scripts\python.exe -m pytest -v
```

```text
======================= 35 passed, 2 warnings in ~16s =======================
```

### Frontend Typecheck & Build
```powershell
cd frontend
npm run build
```

---

## 📂 Repository Structure

```text
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git ignore rules (secrets, venvs, DBs)
├── README.md                     # Project documentation
├── backend/
│   ├── app/
│   │   ├── api/                  # FastAPI routers
│   │   │   ├── repositories.py   # Ingestion (ZIP, GitHub), files, symbols
│   │   │   ├── chat.py           # RAG Q&A, chat history, symbol explain
│   │   │   ├── transformer.py    # PyTorch self-attention endpoint
│   │   │   └── security.py       # Bandit SAST security scanner
│   │   ├── models/               # SQLAlchemy ORM models (Repository, File, Symbol, Chat)
│   │   ├── schemas/              # Pydantic v2 validation models
│   │   ├── services/             # Core business logic
│   │   │   ├── ast_parser.py     # Python AST NodeVisitor symbol extractor
│   │   │   ├── chunker.py        # Symbol-boundary code chunker
│   │   │   ├── embeddings.py     # SentenceTransformer singleton
│   │   │   ├── file_processor.py # Safe ZIP extraction & Git shallow cloning
│   │   │   ├── llm.py            # GeminiService & MockLLMService abstraction
│   │   │   ├── rag_pipeline.py   # Grounded prompt synthesis & citation extractor
│   │   │   ├── security.py       # Programmatic Bandit SAST runner
│   │   │   ├── vector_store.py   # Persistent ChromaDB HNSW store
│   │   │   └── transformer/      # Pure PyTorch self-attention computation
│   │   ├── config.py             # Pydantic-settings configuration
│   │   ├── database.py           # SQLAlchemy SQLite session engine
│   │   └── main.py               # FastAPI application factory & CORS
│   ├── tests/                    # 35 Pytest unit and integration tests
│   ├── pytest.ini                # Pytest configuration
│   └── requirements.txt          # Python dependencies
├── data/                         # Local storage (excluded from Git)
│   ├── app.db                    # SQLite database
│   ├── chroma/                   # ChromaDB persistent vector database
│   └── repos/                    # Ingested codebase files
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Navbar.tsx        # Glassmorphic navigation & live status capsule
    │   ├── pages/
    │   │   ├── Dashboard.tsx     # Executive KPI metrics & architecture pipeline
    │   │   ├── Repository.tsx    # File explorer, AST symbols & AI explanation
    │   │   ├── Assistant.tsx     # RAG Chat, citations & execution pipeline explorer
    │   │   ├── TransformerLab.tsx# PyTorch self-attention interactive heatmap
    │   │   └── Security.tsx      # Bandit SAST scanner & AI remediation modal
    │   ├── services/
    │   │   └── api.ts            # Typed Axios API client
    │   ├── types/
    │   │   └── index.ts          # TypeScript interfaces
    │   ├── App.tsx               # Main routing & layout
    │   └── index.css             # Tailwind CSS & custom styling
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    └── vite.config.ts
```

---

## 🔒 Security & Privacy Notice

- **No Secrets in Source Control**: `.env` and local database files are strictly excluded via `.gitignore`.
- **Zip-Slip Defense**: Archive extractions validate canonical path resolution (`dest / member`).
- **Grounded Verification**: The RAG prompt strictly restricts the LLM to retrieved code context, preventing hallucinated API calls or functions.
- **Local Vector Processing**: Embeddings are computed locally using CPU-friendly Sentence Transformers without sending code out of your network during indexing.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
