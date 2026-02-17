from fastapi import FastAPI

from .routers import generate, batch, health

app = FastAPI(title="X Post Agents", version="0.1.0")

app.include_router(health.router)
app.include_router(generate.router)
app.include_router(batch.router)
