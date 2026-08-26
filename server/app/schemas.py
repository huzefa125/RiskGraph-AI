from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.config import PAYMENT_METHODS


class TransactionInput(BaseModel):
    user_id: int
    device_fingerprint: str
    ip_address: str
    merchant_id: int
    amount: float = Field(gt=0)
    # kept in sync with app.config.PAYMENT_METHODS (also the one-hot columns the model was
    # trained on) — an unsupported value must be rejected here, not silently one-hot-encoded
    # to all-zero and passed to the model as if it were "none of the above"
    payment_method: Literal[tuple(PAYMENT_METHODS)]  # type: ignore[valid-type]
    failed_attempts: int = Field(ge=0, default=0)
    occurred_at: datetime | None = None


class RiskFactor(BaseModel):
    feature: str
    description: str
    contribution: float


class PredictionResponse(BaseModel):
    transaction_id: int
    user_id: int
    score: float
    risk_level: str
    recommended_action: str
    risk_factors: list[RiskFactor]


class GraphNode(BaseModel):
    id: str
    type: str


class GraphEdge(BaseModel):
    source: str
    target: str


class GraphResponse(BaseModel):
    transaction_id: int
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    is_potential_ring: bool


class FraudRing(BaseModel):
    users: list[str]
    component_size: int
    devices: list[str]
    ips: list[str]
    transaction_ids: list[int]
    transaction_count: int
    total_amount: float
    risk_score: float
    risk_level: str
    representative_transaction_id: int | None = None


class ConfusionMatrix(BaseModel):
    tn: int
    fp: int
    fn: int
    tp: int


class ModelMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    roc_auc: float
    confusion_matrix: ConfusionMatrix


class ModelInfo(BaseModel):
    model_name: str
    feature_columns: list[str]
    validation_metrics: dict[str, ModelMetrics]
    test_metrics: ModelMetrics


class RecentTransaction(BaseModel):
    transaction_id: int
    user_id: int
    amount: float
    payment_method: str
    occurred_at: datetime
    score: float | None = None
    risk_level: str | None = None
    recommended_action: str | None = None
    risk_factors: list[RiskFactor] | None = None


class CaseDecisionInput(BaseModel):
    transaction_id: int
    decision: Literal["Allow", "Review", "Block"]
    reason: str | None = None


class RiskStreamEvent(BaseModel):
    transaction_id: int
    user_id: int
    occurred_at: datetime
    amount: float
    score: float
    risk_level: str
    recommended_action: str
    device_id: int
    device_user_count: int


class Case(BaseModel):
    case_id: int
    transaction_id: int
    user_id: int
    amount: float
    risk_score: float
    risk_level: str
    decision: str
    reason: str | None
    status: str
    created_at: datetime
    updated_at: datetime
