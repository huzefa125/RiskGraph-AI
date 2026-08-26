# RiskGraph AI

AI-powered payment risk detection and investigation platform built for the Razorpay AI Risk Manager track.

> This README describes the CURRENTLY IMPLEMENTED system. For the original long-term
> vision and the hackathon-scoped execution plan (what was built, what was cut, and why),
> see [`PLAN.md`](PLAN.md) — it also documents every bug found and fixed along the way.

---

## 1. What this is

RiskGraph AI scores a payment transaction for fraud risk, explains *why* using real SHAP
values (not hardcoded text), detects coordinated fraud rings by graph analysis of shared
devices/IPs across users, and lets an analyst record a real Allow/Review/Block decision
against a deterministic policy — not the model itself. It answers one question
end-to-end, live:

> **How risky is this payment transaction, and why — and what should we do about it?**

---

## 2. Currently implemented

| Area | Status |
|---|---|
| Synthetic transaction dataset (Postgres-backed, reproducible generator) | done |
| Point-in-time feature engineering (velocity, device/IP sharing, spend ratio) | done |
| Train/predict feature parity, verified by an automated test | done |
| ML: Logistic Regression / Random Forest / XGBoost, selected by validation F1 | done |
| Held-out test evaluation: precision, recall, F1, ROC-AUC, confusion matrix | done |
| SHAP explainability on every prediction | done |
| NetworkX fraud-ring detection (shared device/IP, 3+ users; device-only and IP-only patterns both covered) | done |
| FastAPI service: predict, graph, rings, model info, transaction history, cases | done |
| Next.js dashboard: scoring form, risk meter, risk factors, entity graph, history | done |
| Interactive entity graph (click a node for detail, focal-user highlighting) | done |
| Model evidence vs. graph evidence shown separately in the UI | done |
| Fraud Ring Investigation page (severity, members, shared entities, click-to-inspect graph) | done |
| Transaction Investigation panel (score, factors, connected entities, ring status, recommended action) | done |
| Deterministic Allow/Review/Block policy (fixed lookup table, not the model) | done |
| Case management — analyst decision + reason persisted, Cases & Review page (open/resolved) | done (simple: one case per transaction, no assignment or full audit log) |

### Example (live)

```text
Amount: Rs 48,000
New device: Yes
Failed attempts: 5

Risk Score: 75.5/100
Risk Level: HIGH
Recommended action: Review

Top risk factors:
1. Multiple failed attempts         (model evidence)
2. New device                       (model evidence)
3. Unusually high transaction amount (model evidence)
4. Paid via card                    (model evidence)
```

```text
Amount: Rs 100 (trivial)
Device and IP shared with several other users
Risk Score: 99.7/100
Risk Level: CRITICAL
Recommended action: Block

Top risk factors:
1. IP address shared across many users (graph evidence)
2. Device shared across many users     (graph evidence)
3. New device                          (model evidence)
4. New or young account                (model evidence)
5. Unusually high transaction amount    (model evidence)
```

The second example is the point of the graph stage: a tiny transaction is still flagged
because of *who else* is using the same device/IP — amount alone never decides risk.

---

## 3. Not implemented (future / planned)

These appear in the long-term vision but do **not** exist in this repository. Nothing
below should be assumed present:

- Neo4j (graph analysis is NetworkX, in-process, computed from Postgres — see PLAN.md
  for why this was chosen over Neo4j)
- LLM / AI investigation agent or generated investigation summaries
- Case assignment to specific analysts, or a full per-case audit log (current case
  management keeps only the latest decision per transaction, not a history of every
  change)
- Real-time streaming ingestion or live alerting
- Razorpay test-mode or production payment integration
- Docker packaging or a deployed/hosted environment
- Recharts or any charting library (the dashboard's meters/graphs are hand-built SVG)

---

## 4. Architecture (actual)

```text
                    Next.js frontend
                    (dashboard, /predict form,
                     entity graph, detail page,
                     rings + cases pages)
                              |
                        fetch (JSON)
                              v
                         FastAPI
              /predict /graph /rings
              /model/info /cases
                              |
              +---------------+---------------+
              v               v               v
       PostgreSQL      XGBoost model      NetworkX
      transactions       + SHAP          shared-entity
     history + cases    explainer           graph
```

Deterministic policy, not an agent, decides the final risk level (`score_to_level`) and
recommended action (`level_to_action`) — both are fixed lookup tables. SHAP and the graph
explain; a human analyst decides via the case-management workflow; nothing "decides" on
its own outside that.

---

## 5. Technology stack (actual)

| Layer | Tech |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, Uvicorn |
| ML | pandas, NumPy, scikit-learn, XGBoost, SHAP |
| Database | PostgreSQL |
| Graph | NetworkX |
| Testing | pytest (train/predict feature-parity test) |

---

## 6. Running it locally

### Backend

```bash
cd server
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt      # (or .venv/bin/pip on macOS/Linux)

# create the `riskgraph` Postgres database (adjust user/password to your local Postgres):
psql -U postgres -h localhost -c "CREATE DATABASE riskgraph;"
psql -U postgres -h localhost -d riskgraph -f app/db/schema.sql

cp .env.example .env    # set DATABASE_URL if different from the default

python -m app.data.generate_synthetic_data   # generates + loads the synthetic dataset
python -m app.model.train                    # trains LR/RF/XGBoost, saves the winner
python -m pytest app/tests/ -v               # verifies train/predict feature parity
python -m uvicorn app.main:app --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, defaults to localhost:8000
npm run dev
```

Dashboard at `http://localhost:3000`, API at `http://localhost:8000` (interactive docs at
`/docs`).

---

## 7. API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness check |
| POST | `/predict` | score a transaction — inserts it, returns score/level/action/SHAP factors |
| GET | `/graph/{transaction_id}` | entity subgraph (user/device/IP) around a transaction |
| GET | `/rings` | all detected fraud rings, with severity, members, shared entities, totals |
| GET | `/model/info` | which model won, validation + held-out test metrics |
| GET | `/transactions/recent?limit=` | recent transaction history with risk scores |
| GET | `/transactions/{transaction_id}` | one transaction's detail, including risk factors |
| POST | `/cases` | record (or update) an analyst's Allow/Review/Block decision |
| GET | `/cases?status=` | list cases, optionally filtered to `open` or `resolved` |

---

## 8. Model evaluation (current)

Reproducible via a fixed random seed. Held-out test set (15%) is only ever touched once,
for final reporting — never used for tuning. Latest run:

| Model | Validation F1 | Validation ROC-AUC |
|---|---|---|
| Logistic Regression | 0.36 | 0.91 |
| Random Forest | 0.68 | 0.88 |
| **XGBoost (selected)** | **0.73** | **0.88** |

**Held-out test set** (never used in model selection):

| Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|
| 1.00 | 0.72 | 0.84 | 0.95 |

Confusion matrix: `{tn: 1195, fp: 0, fn: 9, tp: 23}`.

These numbers moved around several times over this project's history — see PLAN.md for
the full log of what made earlier versions look better than they were (label leakage, a
single bundled fraud archetype, train/predict feature leakage, an asymmetric ring
signal) and why fixing each one changed the metrics, for better or worse, as a side
effect rather than a goal in itself.

---

## 9. Known limitations

- `device_user_count`/`ip_user_count` in the live `/predict` path only reflect prior
  history *before* the transaction being scored; a device only reveals itself as part of
  a ring once a second distinct user has actually transacted through it. This is correct,
  real-time behavior, not a bug — but it means a ring's very first transaction cannot be
  flagged by graph evidence alone, only by whatever standalone signals it independently
  carries.
- Case management is intentionally simple: one case per transaction (a new decision
  updates it in place), no analyst assignment, no per-change audit trail — only "the
  latest decision" is kept.
- Test coverage is one automated pytest test (train/predict feature parity). No broader
  unit/integration suite exists yet.
- Entirely synthetic data; no connection to a live payments system.

---

## 10. Project philosophy

- Explainable — every prediction ships with real SHAP-derived reasons, not templated text.
- Measurable — every model claim is backed by a held-out metric, never asserted.
- Reproducible — fixed seeds, a script-driven dataset, no manual data massaging.
- Honest about limitations — documented above and in PLAN.md, not hidden.
- Simple over impressive — no Neo4j, no agent framework, no unnecessary dependency, until
  the simpler option has actually been tried and found insufficient.
