# RiskGraph AI — Hackathon Execution Plan

This complements `README.md` (the long-term product vision). README describes 10 phases
ending in a production platform with Neo4j, LLM agents, case management, and live Razorpay
integration. That is the right *destination*, but building all of it in hackathon time would
be over-engineering — a half-finished version of everything demos worse than a fully-working
slice. This doc defines the slice we actually build, and explicitly what we cut.

## Scope principle

> Ship a complete, working, explainable pipeline end-to-end. Add exactly one differentiator
> (the graph). Cut everything that trades demo reliability for scope.

Under-engineering risk: a bare risk score with no explanation is forgettable and fails the
README's own success criteria (section 14). Over-engineering risk: Neo4j + LLM agents + case
workflow + Docker + live Razorpay integration, each done shallowly, is fragile on demo day and
burns time that should go into model quality and UI polish.

## What we build (core, in order)

| Stage | From README phase | Deliverable |
|---|---|---|
| 1. Synthetic data | Phase 1 | Reproducible generator: users, devices, IPs, merchants, transactions, with injected fraud patterns (shared device/IP, velocity spikes, odd hours, new-device+high-amount combos) |
| 2. Model | Phase 1 | Feature engineering → Logistic Regression baseline → Random Forest → XGBoost, picked by validation metrics, not assumption |
| 3. Evaluation | Phase 1 / 10 | Precision, recall, F1, ROC-AUC, confusion matrix on a **held-out** 15% split never touched during training/tuning |
| 4. Prediction API | Phase 2 | FastAPI `/predict` — transaction JSON in, risk score + LOW/MEDIUM/HIGH/CRITICAL + top risk factors out. Pydantic request validation, explicit error responses |
| 5. Explainability | Phase 4 | SHAP values on top of the trained model → human-readable "why" per prediction (this is the "AI" story — real and working, not a chatbot) |
| 6. Dashboard | Phase 3 | Next.js + TypeScript + Tailwind: submit/select a transaction → risk score, level, factors, recent transaction context |
| 7. Graph differentiator (lightweight) | Phase 6, descoped | `networkx` in the FastAPI service (no Neo4j) builds an in-memory entity graph (user–device–IP–merchant) for the demo dataset. `/graph/{transaction_id}` returns nodes/edges; frontend renders a force-directed graph highlighting shared-device/IP fraud rings. This is what makes the project match its own name without a database-ops burden. |

## Database

Using PostgreSQL directly (per README section 8), not a SQLite shortcut. Local server is
already running (`postgresql-x64-16` Windows service) with a `riskgraph` database created:

```
psql -U postgres -h localhost -d riskgraph     # user: postgres / password: postgres
```

Schema lives in `server/app/db/schema.sql` (users, devices, ip_addresses, merchants,
transactions, risk_scores — the entities the graph stage relates to each other). Connection
string is read from `server/.env` (`DATABASE_URL`, gitignored) via `server/app/db/connection.py`.
`.env.example` documents the shape without the real credentials for anyone cloning the repo.

Stages 1–5 alone already satisfy every bullet in README section 14 ("Project Success
Criteria"). Stages 6–7 are what make it *demo well* rather than just *pass*.

## What we explicitly cut (and why)

- **Neo4j → networkx.** Gets ~90% of the visual/story value (fraud-ring graph) for ~10% of the
  setup cost. No graph DB to provision, no Cypher to write under time pressure.
- **LLM investigation agents (Phase 7) → skip, or one cheap add-on.** A full tool-calling agent
  is high effort, high failure surface, and easy to get wrong live. If time remains, the only
  LLM add-on worth doing: one call that turns the top SHAP features into a natural-language
  paragraph. That's genuinely useful and low-risk; a multi-step agent is not.
- **Case management (Phase 8) → skip.** Not part of the scoring question ("how risky is this
  transaction, and why?"); adds CRUD surface with no analytical value for a demo.
- **Real-time streaming / velocity monitoring infra (Phase 5) → skip as infra.** The *signal*
  (transaction velocity) is already a model feature computed from historical data in Stage 1–2;
  we don't need a live event-ingestion pipeline to demonstrate that signal works.
- **Docker / Vercel deployment → stretch only, last.** Genuinely cheap to add at the very end
  if time remains (looks good on a resume line), but never worth doing before the model and UI
  are solid. Local run + screen-recorded demo is sufficient if hackathon rules don't require a
  live URL.
- **Razorpay test-mode integration (Phase 9) → thin version, worth doing.** Since this is
  specifically a Razorpay track, mapping one real Razorpay test-mode webhook payload into our
  feature schema (instead of only synthetic API calls) is cheap and shows initiative connecting
  to their actual surface. Keep it to one ingestion path — not a full integration architecture doc.

## Definition of done (demo day)

- [x] Dataset generation is a script, not a one-off notebook — reproducible (`app/data/generate_synthetic_data.py`)
- [x] Model card: which model won, validation metrics, why (`app/model/artifacts/metadata.json`; XGBoost won on validation F1)
- [x] Held-out test metrics reported (precision/recall/F1/ROC-AUC/confusion matrix) — precision 1.0, recall 0.81, F1 0.90, ROC-AUC 0.97
- [x] `/predict` works end-to-end from the UI (Next.js dashboard, verified in a real browser via Playwright, light + dark)
- [x] Every prediction shows real SHAP-derived risk factors, not hardcoded strings
- [x] Fraud-ring graph renders for at least a few planted coordinated-fraud cases (`/graph/{id}`, `/rings` — 6 of 6 injected rings detected cleanly; a 7th shows up from live demo testing reusing the same test device/IP across different User IDs — correct behavior, not a bug)
- [ ] 5-minute demo script written and rehearsed
- [ ] README section 14/16 claims are all actually true of the shipped system

## Frontend (Stage 6)

Next.js dashboard in `frontend/`, plain fetch to the FastAPI backend (`NEXT_PUBLIC_API_URL`,
`.env.local`) — no state library, no chart library. Palette/component choices follow the
`dataviz` skill: status colors map 1:1 to LOW/MEDIUM/HIGH/CRITICAL, risk score is a sequential-hue
meter, graph node types (user/device/ip) use 3 fixed categorical hues, risk factors are a
sequential horizontal-bar list. Entity graph is a deterministic radial SVG layout (hubs in the
center, users on the rim) rather than a physics-based force simulation — the subgraphs this API
returns are small (single-digit node counts), so a force simulation would be complexity with no
visual benefit.

Pages: `/` (KPI row + score-a-transaction form + result panel + recent transactions + detected
rings) and `/transaction/[id]` (persisted detail view, including risk factors read back from
`risk_scores.risk_factors` — required adding that column to the `/transactions/{id}` response,
which it was missing initially).

## Status (2026-08-26)

Backend is fully built and verified: Postgres schema, synthetic data generator, XGBoost model
(beats LR/RF baselines on validation), SHAP explainability, networkx fraud-ring graph, and a
FastAPI service (`/predict`, `/graph/{id}`, `/rings`, `/transactions/recent`, `/transactions/{id}`)
all tested end-to-end against the live database.

Two rounds of real bugs were found and fixed while validating this (not just written and assumed
correct):
1. **Label leakage → suspiciously perfect data.** First data cut gave every model 100%
   precision/recall — a sign the fraud pattern was trivially separable (mainly via shared-device
   count), not that the model was good. Fixed by making standalone fraud a smooth logistic
   function of overlapping signals instead of a hard rule, and adding legit transactions that
   incidentally look risky.
2. **Random-graph giant component.** Device/IP "home" assignment via repeated `random.choice`
   caused incidental multi-user overlap that, once connected-component analysis chased it
   transitively, merged hundreds of unrelated users into one fake "ring" (a classic random-graph
   giant-component effect once average edge count approaches n/2). Fixed by assigning home
   devices/IPs via sampling without replacement (guaranteed-unique) instead of hoping a bigger
   pool made collisions rare enough.
3. **SHAP showed the wrong payment method.** `explain.py` ranked the top-5 SHAP contributors
   before filtering out inactive one-hot `payment_method_*` dummies, so "Paid via upi" could show
   up even when the transaction was paid by card (SHAP legitimately scores every dummy, including
   the ones equal to 0). Fixed: only the payment method actually used is ever shown.
4. **Standalone fraud path was untrained.** A ₹48,000 + new-device + 5-failed-attempts
   transaction with no device/IP sharing scored 1.5/LOW. Audited rather than guessed: XGBoost's
   feature importance was 82% concentrated in `device_user_count` alone, and zero training rows
   existed matching "isolated device + amount>15000 + new device + failed attempts" — because
   amount > ₹15,000 was a ~3.4-sigma tail event under the original single lognormal amount
   distribution, so that combination essentially never occurred in 8,000+ rows. Fixed by (a)
   mixing in a 5% "occasional large purchase" component to the amount distribution (real
   high-amount hard negatives) and (b) explicitly injecting 25 high-conviction standalone-fraud
   rows (extreme amount + new device + failed attempts + night, each on its own singleton
   device/IP). Same scenario now scores 96/CRITICAL; `device_user_count` importance dropped to
   61% with `failed_attempts` (17%) and `is_new_device` (5%) now meaningfully contributing.
   Verified against 10 scenarios (see below) — no single weak signal alone pushes risk up, both
   the graph path and the standalone-extreme path correctly escalate, and the worst combination
   scores highest.

5. **Standalone fraud path was still one bundled archetype.** Live testing found: (a) reusing
   the same device across sequential test submissions for the same user silently flips
   `is_new_device` False on the 2nd+ test (test methodology, not a bug — confirmed by pulling the
   actual persisted rows), and (b) `failed_attempts` scored IDENTICALLY for every value from 5 to
   50 — XGBoost's trees never split beyond the highest threshold seen in training (~5), so the
   model genuinely cannot distinguish 5 from 50 failed attempts. Root cause: all 25 injected
   standalone-fraud examples were one archetype (new device + extreme amount + failed 2-5 +
   night, always together), so the model learned that bundle, not each signal's independent
   effect. Fixed by splitting the injection into three archetypes — (1) new device + extreme
   amount + failed 2-6 + night [10 rows], (2) the user's own KNOWN home device + failed_attempts
   10-30, amount varies [10 rows, credential-stuffing style], (3) new device + modest amount
   (₹3-9k) + failed 4-8 [5 rows] — and adding a rare (2%) legit high-friction case (failed
   attempts 3-15, still the account owner) to the general population so high failed_attempts
   alone isn't a bare tell either. Verified: known-device failed_attempts now shows a real
   gradient (flat near-zero through 10, rising at 15, saturating ~15.6 at 20+) instead of a flat
   5.65 for anything past 3; new-device+modest-amount+failed now reaches MEDIUM (37-44) at 4-8
   failed attempts, up from a flat LOW (2.04); the original ₹48k scenario still scores
   CRITICAL (98).
   **Tradeoff, disclosed not hidden:** held-out F1 dropped from 0.90 to 0.63 (precision 0.91,
   recall 0.48) — an honest cost of a harder, more diverse, better-covered training
   distribution, not a regression to hide. A model that's easy to score well on with one
   bundled archetype was the less trustworthy one.
6. **Train/predict feature leakage (train-serving skew).** `device_user_count`, `ip_user_count`,
   and `amount_ratio_to_user_avg` in `build_features.py` were computed once over the WHOLE
   dataset — so an early (chronologically first) transaction on a device that would eventually
   become a 6-user ring already showed device_user_count=6, and a user's amount_ratio used their
   full history including transactions that hadn't happened yet. `predict.py` never had this
   problem (it can only query what's actually in the DB at scoring time), so training was
   leaking future information the live path could never see — a real train-serving skew, not a
   simplification. Fixed: rewrote both features as running/expanding values ordered by
   `occurred_at` (`_running_entity_user_count`, `_running_amount_ratio` in `build_features.py`),
   and added a matching `occurred_at < :now` filter to every relevant query in `predict.py`
   (which previously assumed "whatever's in the DB" = "prior," true only when scoring with the
   real current time — not true for backdated test timestamps, which this project uses
   throughout). Verified parity empirically (not just by code review): 7 real transactions,
   including an early ring-device row, computed identical values via both paths, 0 mismatches.
   Retrained; metrics dropped again (F1 0.63 → 0.58, ROC-AUC 0.83 → 0.88) — expected, since some
   of the old apparent skill was the model seeing future ring size before the ring had actually
   formed. Live-tested: the 1st transaction on a newly-shared device scored LOW (0.13, correctly
   — no ring evidence yet), the 2nd from a different user immediately flipped to CRITICAL
   (99.28) the moment real sharing evidence existed. That's the live, real-time-correct behavior
   a production system needs, which the leaky version could never have — the same event before
   the fix would have shown high risk on transaction #1, days before anyone else touched that
   device.

## Next action

Demo script + final README/PLAN reconciliation, or graph UI polish (click a node for
users/transactions/risk detail) per your priority order — pending your call on which next.
