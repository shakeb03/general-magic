import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.seed.load import load_seed
from app.scheduler.conversation_runner import start_scheduler, stop_scheduler
from app.routes import conversations, messages, stream, reset

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Cell Co-Pilot backend...")
    load_seed()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Backend shutdown complete.")


app = FastAPI(title="Cell Co-Pilot API", lifespan=lifespan)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(stream.router)
app.include_router(reset.router)
