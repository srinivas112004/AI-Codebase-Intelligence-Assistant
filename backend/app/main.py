from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.schemas import HealthResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite database tables
    init_db()
    yield
    # Shutdown logic if needed

app = FastAPI(
    title="AI Codebase Intelligence Assistant API",
    description="Backend API for code-aware RAG, AST analysis, and Transformer Self-Attention visualization.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.repositories import router as repositories_router
from app.api.chat import router as chat_router
from app.api.transformer import router as transformer_router
from app.api.security import router as security_router

app.include_router(repositories_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(transformer_router, prefix="/api")
app.include_router(security_router, prefix="/api")

@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Health check endpoint to verify backend status, database connection, and config."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        embedding_model=settings.EMBEDDING_MODEL,
        database="sqlite"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
