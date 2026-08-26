from datetime import datetime

from pydantic import BaseModel, Field


class TransactionInput(BaseModel):
    user_id: int
    device_fingerprint: str
    ip_address: str
    merchant_id: int
    amount: float = Field(gt=0)
    payment_method: str
    failed_attempts: int = Field(ge=0, default=0)
    occurred_at: datetime | None = None


class RiskFactor(BaseModel):
    feature: str
    description: str
    contribution: float


class PredictionResponse(BaseModel):
    transaction_id: int
    score: float
    risk_level: str
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
    risk_factors: list[RiskFactor] | None = None
