import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import METADATA_PATH
from app.db.connection import engine
from app.graph.build_graph import detect_fraud_rings, get_transaction_subgraph
from app.model.predict import score_transaction
from app.schemas import (
    FraudRing,
    GraphResponse,
    ModelInfo,
    PredictionResponse,
    RecentTransaction,
    TransactionInput,
)

app = FastAPI(title="RiskGraph AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(transaction: TransactionInput):
    try:
        return score_transaction(**transaction.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


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


@app.get("/transactions/recent", response_model=list[RecentTransaction])
def recent_transactions(limit: int = 20):
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
    return list(rows)


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
    return row
