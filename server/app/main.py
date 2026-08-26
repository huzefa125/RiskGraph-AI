import json

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from starlette.concurrency import run_in_threadpool

from app.cases import list_cases, record_decision
from app.config import METADATA_PATH, level_to_action
from app.db.connection import engine
from app.graph.build_graph import detect_fraud_rings, get_transaction_subgraph
from app.model.predict import score_transaction
from app.schemas import (
    Case,
    CaseDecisionInput,
    FraudRing,
    GraphResponse,
    ModelInfo,
    PredictionResponse,
    RecentTransaction,
    RiskStreamEvent,
    TransactionInput,
)
from app.ws_manager import manager

app = FastAPI(title="RiskGraph AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(FileNotFoundError)
async def model_not_trained_handler(request: Request, exc: FileNotFoundError):
    # the only FileNotFoundError this service can hit in normal operation is the trained
    # model artifact being missing (predict/rings both load it) — surface that plainly
    # instead of a bare 500 with a traceback
    return JSONResponse(status_code=404, content={"detail": "model not trained yet"})


@app.exception_handler(OperationalError)
async def database_unavailable_handler(request: Request, exc: OperationalError):
    return JSONResponse(status_code=503, content={"detail": "database unavailable"})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
async def predict(transaction: TransactionInput):
    try:
        # score_transaction is sync (blocking DB + model calls) — run it off the event
        # loop so the WebSocket broadcast below never has to compete with it
        result = await run_in_threadpool(score_transaction, **transaction.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    manager.broadcast_nowait(RiskStreamEvent(**result).model_dump(mode="json"))
    return result


@app.websocket("/ws/risk-stream")
async def risk_stream(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # this stream is broadcast-only; block here until the client disconnects
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)


@app.get("/graph/{transaction_id}", response_model=GraphResponse)
def graph(transaction_id: int):
    try:
        return get_transaction_subgraph(transaction_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/rings", response_model=list[FraudRing])
def rings():
    return detect_fraud_rings()


@app.get("/model/info", response_model=ModelInfo)
def model_info():
    if not METADATA_PATH.exists():
        raise HTTPException(status_code=404, detail="model not trained yet")
    return json.loads(METADATA_PATH.read_text())


@app.post("/cases", response_model=Case)
def create_case_decision(input: CaseDecisionInput):
    try:
        return record_decision(input.transaction_id, input.decision, input.reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/cases", response_model=list[Case])
def get_cases(status: str | None = None):
    return list_cases(status)


def _with_recommended_action(row: dict) -> dict:
    row = dict(row)
    row["recommended_action"] = level_to_action(row["risk_level"]) if row.get("risk_level") else None
    return row


@app.get("/transactions/recent", response_model=list[RecentTransaction])
def recent_transactions(limit: int = Query(20, gt=0, le=500)):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT t.transaction_id, t.user_id, t.amount, t.payment_method,
                       t.occurred_at, r.score, r.risk_level
                FROM transactions t
                LEFT JOIN risk_scores r ON r.transaction_id = t.transaction_id
                ORDER BY t.occurred_at DESC
                LIMIT :limit
            """),
            {"limit": limit},
        ).mappings().all()
    return [_with_recommended_action(row) for row in rows]


@app.get("/transactions/{transaction_id}", response_model=RecentTransaction)
def transaction_detail(transaction_id: int):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT t.transaction_id, t.user_id, t.amount, t.payment_method,
                       t.occurred_at, r.score, r.risk_level, r.risk_factors
                FROM transactions t
                LEFT JOIN risk_scores r ON r.transaction_id = t.transaction_id
                WHERE t.transaction_id = :tid
            """),
            {"tid": transaction_id},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"unknown transaction_id {transaction_id}")
    return _with_recommended_action(row)
