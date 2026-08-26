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
- **Case management (Phase 8) → originally cut, later built.** At hackathon-scope time this
  wasn't part of the scoring question ("how risky is this transaction, and why?") and looked
  like CRUD surface with no analytical value for a demo. That call was revisited — see the
  "Case Management" section below, added 2026-08-26, once the Allow/Review/Block policy needed
  somewhere to persist the analyst's actual decision.
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

## Full codebase audit (2026-08-26)

Read every backend/frontend file and both docs end-to-end before changing anything, per an
explicit 10-phase audit request. Findings and fixes:

7. **README.md rewritten.** Was still the original vision doc claiming "Current phase:
   Phase 1 — ML MVP" despite a fully working system. Now documents what's actually
   implemented vs. explicitly listed as NOT implemented (Neo4j, LLM agents, case
   management, Razorpay integration, Docker, Recharts — none of these exist in the repo).
8. **Real, confirmed build-breaking bug**: `frontend/lib/types.ts`'s `RecentTransaction`
   type had no `risk_factors` field, but `transaction/[id]/page.tsx` read it directly —
   `npx tsc --noEmit` failed with 2 errors before the fix. Fixed by adding the field.
9. **Dead code removed**: `server/app/db/connection.py` defined `SessionLocal`/`get_db()`
   (an unused FastAPI dependency pattern) — confirmed via repo-wide grep that nothing
   imports either; every route uses `engine.connect()`/`engine.begin()` directly. Removed.
10. **Parity test promoted from scratch script to the repo**: `server/app/tests/test_feature_parity.py`
    (pytest, added as a dependency) — dynamically samples real transactions (earliest,
    latest, one from a shared device) and asserts training-time and predict-time
    device/IP/amount-ratio features match exactly. Passing.
11. **Graph UX (Phase 6)**: `FraudGraph` is now interactive — click a node for a detail
    panel (connected users for a device/IP hub, "shares with users #X, #Y" for a user),
    the investigated transaction's own user is visually distinguished (ring), and
    shared/suspicious hubs get a red ring. Required one additive API field
    (`PredictionResponse.user_id`, non-breaking) so the frontend knows which user is
    "under investigation" without an extra round-trip.
12. **Real bug found and fixed while verifying the above**: converting `FraudGraph` to a
    client component surfaced a genuine SSR hydration mismatch on `/transaction/[id]`
    (confirmed via Playwright `pageerror`, not the earlier ColorZilla-extension false
    positive — headless Chromium has no extensions). Root cause, found by diffing actual
    server vs. client HTML: React's SSR renders a `<title>` *element* empty when nested
    inside SVG shapes (it special-cases that tag name for the document title). Fixed by
    dropping the native hover-tooltip `<title>` entirely — `aria-label` covers
    accessibility, and the click-to-select detail panel already shows richer information
    than a hover tooltip would.
13. **Risk-explanation UX (Phase 7)**: `RiskFactorList` now groups factors into "Model
    evidence" vs. "Graph evidence" (the latter = `device_user_count`/`ip_user_count`),
    each with a distinct color and label, instead of one undifferentiated list.
14. **Frontend polish (Phase 9)**: added loading-skeleton states to `StatTile`,
    `RecentTransactionsTable`, and `RingsList` for the initial dashboard fetch (previously
    showed bare `—` placeholders with no loading indication).
15. **AI investigation summary (Phase 8): deliberately skipped.** No LLM is configured in
    this project; adding one would introduce a new dependency, an API key requirement,
    and cost for a feature explicitly marked optional — "if adding the LLM would make the
    project less reliable, skip it." The deterministic risk system (model + SHAP + graph)
    remains fully authoritative and sufficient on its own.

All of the above verified: `pytest` passing, `npm run lint` clean, `npm run build` clean
(including the TypeScript fix), full Playwright browser pass with zero console errors on
both `/` and `/transaction/[id]`, live-tested legitimate + suspicious + ring-shared
transactions through `/predict`, `/graph/{id}`, and `/rings`.

## Ring-scoring asymmetry fix (2026-08-26)

Reported bug: ₹100, 0 failed attempts, device/IP shared by 4+ users scored LOW instead of
flagging the ring. Reproduced directly (not assumed): a device shared by 4 real users, IP
NOT shared, scored 0.25/LOW despite device_user_count=5; the SAME device_user_count when
IP was also shared scored CRITICAL. Root cause found in the training data itself: 89
examples of "device shared, IP NOT shared" existed, but 88 of them were the legit 2-user
family-device pattern and only 1 was fraud — the model correctly learned that
device-only sharing is usually safe, because in this dataset it almost always was. The
"IP shared, device NOT shared" combination had essentially zero training rows (1 total).

Fixed the same way as the earlier standalone-fraud gap: added real training examples
instead of hand-tuning weights. `build_partial_sharing_ring_transactions()` in
`generate_synthetic_data.py` injects two new archetypes — rings that share ONLY a device
(each member keeps a distinct IP) and rings that share ONLY an IP (each member keeps a
distinct device) — 3 rings each, 3-6 members per ring, same burst/amount/failed-attempts
distribution as the existing "both shared" rings. New disjoint device/IP pools guarantee
no accidental cross-contamination with home/family/existing-ring pools (same
sampling-without-replacement discipline as every other pool in this file).

Result: device-only sharing now correctly reads as a strong signal (SHAP contribution on
`device_user_count` alone: 1.7 → 7.2 for the same test case) instead of being swamped by
the family-device hard-negative pattern. Held-out test metrics *improved* as a side
effect of the added real signal — precision 1.0, recall 0.72, F1 0.84, ROC-AUC 0.95 (up
from F1 0.58 previously) — because this was filling a genuine training gap, not
overfitting to the reported case (no hardcoding: the fix is a synthetic-data generation
pattern, not a rule keyed on any specific transaction).

Verified: `pytest` parity test still passing (untouched — only the data generator
changed, not feature computation or `/predict`), the 10-scenario calibration sweep still
clean (no single weak signal alone triggers risk), all 5 requested scenarios pass live:

| Scenario | Score | Level | vs. requested |
|---|---|---|---|
| ₹500 trusted device | 0.01 | LOW | ✅ |
| ₹50K + failures + new device | 93.33 | CRITICAL | requested HIGH — lands one band higher, still correctly high-risk, not a regression |
| ₹5L + failures + shared device | 98.33 | CRITICAL | ✅ |
| ₹100 + shared device/IP (the reported bug) | 99.59 | CRITICAL | ✅ (also verified device-only-sharing specifically: 88.07 CRITICAL) |
| ₹2L trusted device | 0.19 | LOW | ✅ |

Reset to a clean state afterward (8,179 transactions, 0 scored).

## Fraud Ring Investigation view (2026-08-26)

New dedicated page (`frontend/app/rings/page.tsx`) built entirely on the existing
`/rings` and `/graph/{id}` endpoints — no new backend endpoint, no new ML model, no new
dependency. Two additive backend changes made this possible:

1. `detect_fraud_rings()` (`graph/build_graph.py`) now also returns, per ring: shared
   devices, shared IPs, transaction IDs, transaction count, total amount, and a
   `risk_score`/`risk_level`. Severity reuses the *actual trained model* (mean
   `predict_proba` over every transaction belonging to the ring, via the same
   point-in-time `compute_features`) rather than a new ad hoc formula — the same model
   already used everywhere else, not a parallel scoring system. `representative_transaction_id`
   (the ring's lowest transaction_id) lets the UI reuse `/graph/{transaction_id}` verbatim
   for "click a ring to inspect its entity graph" — no new graph endpoint needed.
2. `predict.py`'s `_get_model()` renamed to public `get_model()` so `build_graph.py` can
   share the same cached model load instead of loading it twice.

`FraudRing` schema/type extended additively (old consumers of `users`/`component_size`,
e.g. the existing dashboard `RingsList`, are unaffected). New `FraudRingCard` component
reuses `FraudGraph` (the exact same interactive graph from the transaction detail page)
for the expand-to-inspect view, and `RISK_LEVEL_COLOR`/`RISK_LEVEL_ICON` from `lib/risk.ts`
for the severity badge — same visual language as the rest of the dashboard, not a new style.

Verified: `/rings` responds in ~2.1s (acceptable for a dedicated investigation page, not a
hot path), `pytest` still passing (untouched), `tsc`/`npm run build`/`npm run lint` all
clean, full Playwright pass (dashboard → "Full investigation view" link → ring list →
expand graph) with zero console errors. Confirmed live that device-only and IP-only rings
(from the earlier asymmetry fix) correctly show an empty `ips`/`devices` column
respectively, rather than being hidden or miscategorized.

## Transaction Investigation panel (2026-08-26)

New `TransactionInvestigationPanel` component consolidates everything about one
transaction in one place: recommended action, risk meter, model-vs-graph-evidence risk
factors (reused from the ring work), a connected-entities summary (users/devices/IPs
derived from the existing `/graph/{id}` response, no new endpoint), and fraud-ring status
(cross-referencing the existing `/rings` endpoint by checking `transaction_ids`
membership — same pattern as the ring page, no new endpoint). One additive backend
change: `config.level_to_action()` — a fixed lookup table (LOW→Allow, MEDIUM/HIGH→Review,
CRITICAL→Block), added to `PredictionResponse` and `RecentTransaction`. This is the
deterministic policy layer README section 11 always described but never had code for —
the model still never authorizes/blocks anything itself.

Both the dashboard's result panel and the transaction detail page now render this one
component instead of duplicating RiskMeter/RiskFactorList/FraudGraph inline — a real
de-duplication, not just a new feature. Verified: `pytest`/`tsc`/build/lint clean, full
Playwright pass on both usages with zero console errors.

## Case Management (2026-08-26)

Added the `cases` table (one row per transaction — `transaction_id UNIQUE` — recording a
new decision upserts rather than duplicates) and a small `app/cases.py` service:
`record_decision()` snapshots the risk score/level at decision time from `risk_scores`
(immutable copy, not a live join — what the analyst saw never changes retroactively),
derives `status` from the decision itself (Review → open, Allow/Block → resolved), and
rejects decisions on unscored transactions (verified: returns 400, not a crash). Two new
endpoints, `POST /cases` and `GET /cases` — no other backend surface touched, no ORM,
same raw-SQL-via-SQLAlchemy style as everywhere else in this codebase.

Frontend: `CaseDecisionForm` (reason textarea + Allow/Review/Block buttons, upserts via
the same endpoint) is embedded directly in `TransactionInvestigationPanel`; a new `/cases`
page (`CasesList` + status filter tabs) mirrors the `/rings` page's established pattern.
`cases` CASCADE-truncates on dataset reset (FK to `transactions`) — made explicit in
`generate_synthetic_data.py`'s TRUNCATE list rather than relying on implicit cascade.

Verified end-to-end via Playwright: score a transaction → record a Review decision with a
reason → escalate to Block (confirmed same case_id, status flips to resolved, not a
duplicate row) → visit Cases & Review → filter to Resolved. Zero console errors,
`pytest`/`tsc`/build/lint all clean. Reset to a clean state afterward (8,179 transactions,
0 risk_scores, 0 cases).

## Next action

Demo script + rehearsal. Everything else on the original priority list (audit, SHAP fix,
scenario testing, metric validation, parity fix, graph UX, evidence-source UX, ring
asymmetry, ring investigation view, transaction investigation panel, case management) is
done.
