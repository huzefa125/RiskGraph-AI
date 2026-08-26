-- RiskGraph AI schema
-- Run with: psql -U postgres -h localhost -d riskgraph -f schema.sql

CREATE TABLE IF NOT EXISTS users (
    user_id         SERIAL PRIMARY KEY,
    account_created TIMESTAMP NOT NULL,
    is_flagged      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS devices (
    device_id   SERIAL PRIMARY KEY,
    fingerprint TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ip_addresses (
    ip_id   SERIAL PRIMARY KEY,
    address INET NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS merchants (
    merchant_id SERIAL PRIMARY KEY,
    name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id   SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(user_id),
    device_id        INTEGER NOT NULL REFERENCES devices(device_id),
    ip_id            INTEGER NOT NULL REFERENCES ip_addresses(ip_id),
    merchant_id      INTEGER NOT NULL REFERENCES merchants(merchant_id),
    amount           NUMERIC(12, 2) NOT NULL,
    payment_method   TEXT NOT NULL,
    occurred_at      TIMESTAMP NOT NULL,
    failed_attempts  INTEGER NOT NULL DEFAULT 0,
    is_new_device    BOOLEAN NOT NULL DEFAULT FALSE,
    -- ground truth for training/eval only; never exposed to the live /predict response
    is_fraud         BOOLEAN NOT NULL DEFAULT FALSE
);

-- transaction lookups are always by user or by time range in the dashboard
CREATE INDEX IF NOT EXISTS idx_transactions_user_time ON transactions (user_id, occurred_at);

CREATE TABLE IF NOT EXISTS risk_scores (
    transaction_id INTEGER PRIMARY KEY REFERENCES transactions(transaction_id),
    score          NUMERIC(5, 2) NOT NULL,
    risk_level     TEXT NOT NULL,
    risk_factors   JSONB NOT NULL,
    scored_at       TIMESTAMP NOT NULL DEFAULT now()
);
