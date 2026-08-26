"""Generates a synthetic payments dataset and loads it into Postgres.

Deliberately noisy rather than perfectly separable: a handful of legit users share a
family device (2 users, below the fraud-ring threshold), some clearly risky-looking
legit transactions are NOT fraud, and standalone fraud probability is a smooth logistic
function of risk signals rather than a hard rule. A model that gets 100% on this data
would mean the data is leaking the label, not that the model is good — real fraud data
always has overlap between the classes.

Home devices/IPs and one-off switches are assigned by SAMPLING WITHOUT REPLACEMENT
(or a running counter), not by repeated random.choice() over a "big enough" pool.
Repeated random draws collide far more than intuition suggests — the birthday paradox
means expected collisions scale with draws^2/pool_size, not draws/pool_size — and even a
few dozen incidental 2-user edges, once connected-component analysis chains them
transitively, merge into a giant unrelated cluster (the classic random-graph
giant-component effect: hundreds of legit users ended up in one "fraud ring" across two
earlier attempts at this that just made the pool bigger). Guaranteeing uniqueness by
construction removes the problem outright instead of making collisions merely rare.
Family devices (exactly 2 users) and ring devices (3-6 users) remain the only
intentional multi-user sharing in the dataset.

Amount is a mixture (95% everyday spend, 5% an occasional large purchase) rather than a
single lognormal — with a single tight lognormal, amount > 15000 was a ~3.4-sigma tail
event that essentially never co-occurred with new-device + failed-attempts in 8000 rows,
so the model had zero training examples of "high amount, no device sharing" fraud OR
legit and fell back entirely on device_user_count (which then carried ~82% of its
learned importance). The mixture's large-purchase component gives real density of
high-amount LEGIT transactions (genuine hard negatives), and N_STANDALONE_FRAUD injects
explicit high-conviction fraud with no device sharing at all, so the model actually gets
to learn that path instead of extrapolating blind into it.

Run: python -m app.data.generate_synthetic_data
"""
import math
import random
from datetime import datetime, timedelta

from sqlalchemy import text

from app.config import PAYMENT_METHODS, RANDOM_SEED
from app.db.connection import engine

random.seed(RANDOM_SEED)

N_USERS = 300
N_MERCHANTS = 25
N_TRANSACTIONS = 8000
N_FRAUD_RINGS = 6          # groups of users coordinating fraud through a shared device/IP
RING_SIZE = (3, 6)          # users per ring
N_FAMILY_DEVICES = 8       # legit devices shared by exactly 2 users each — below the ring threshold
N_STANDALONE_FRAUD = 25    # explicit high-amount/new-device/failed-attempt fraud, no device sharing

# disjoint device/IP pools — see module docstring for why these must not overlap.
# Sized exactly to what's sampled without replacement, so uniqueness is guaranteed by
# construction rather than by hoping a big pool makes collisions rare.
N_HOME = N_USERS                              # one unique home device/IP per user
N_RARE = int(N_TRANSACTIONS * 0.10)           # generous cap on one-off switch events
N_FAMILY = N_FAMILY_DEVICES
N_RING = N_FRAUD_RINGS
N_STANDALONE = N_STANDALONE_FRAUD

HOME_START = 0
RARE_START = HOME_START + N_HOME
FAMILY_START = RARE_START + N_RARE
RING_START = FAMILY_START + N_FAMILY
STANDALONE_START = RING_START + N_RING
TOTAL_DEVICES = TOTAL_IPS = STANDALONE_START + N_STANDALONE

START = datetime(2025, 1, 1)
END = datetime(2025, 8, 1)


def random_datetime(start: datetime, end: datetime) -> datetime:
    delta = end - start
    seconds = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=seconds)


def build_entities():
    users = [
        {"account_created": random_datetime(START - timedelta(days=730), START), "is_flagged": False}
        for _ in range(N_USERS)
    ]
    devices = [{"fingerprint": f"device-{i}"} for i in range(TOTAL_DEVICES)]
    ips = [{"address": f"10.{i // 250}.{(i * 7) % 250}.{i % 250}"} for i in range(TOTAL_IPS)]
    merchants = [{"name": f"merchant-{i}"} for i in range(N_MERCHANTS)]
    return users, devices, ips, merchants


def sample_amount() -> float:
    """95% everyday spend, 5% an occasional large purchase — without this second
    component, amount>15000 is a ~3.4-sigma tail event (see module docstring)."""
    if random.random() < 0.05:
        return round(random.lognormvariate(mu=9.0, sigma=0.5), 2)
    return round(random.lognormvariate(mu=6.5, sigma=0.9), 2)


def standalone_fraud_probability(amount: float, failed_attempts: int, hour: int, is_new_device: bool) -> float:
    """Smooth logistic risk model so standalone fraud isn't a hard-rule cutoff — a
    real classifier has to weigh overlapping evidence, not memorize an AND rule."""
    logit = -6.5
    logit += 1.6 if amount > 15000 else 0.0
    logit += 0.9 * min(failed_attempts, 3)
    logit += 1.1 if hour < 6 else 0.0
    logit += 1.6 if is_new_device else 0.0
    return 1 / (1 + math.exp(-logit))


def build_normal_transactions(user_ids, home_ids, rare_ids, merchant_ids, count, family_devices):
    """Each user mostly reuses one home device/IP. A few users additionally share one
    family device with exactly one other person — legit, but looks graph-suspicious.
    home_ids/rare_ids are (devices, ips) tuples of disjoint pools. Assignment is by
    sampling without replacement / a running counter — see module docstring."""
    home_devices, home_ips = home_ids
    rare_devices, rare_ips = rare_ids

    # each user gets a DISTINCT home device/IP — random.sample guarantees no two users
    # ever share one by chance (unlike repeated random.choice)
    user_home_device = dict(zip(user_ids, random.sample(home_devices, len(user_ids))))
    user_home_ip = dict(zip(user_ids, random.sample(home_ips, len(user_ids))))
    family_device_of = {}
    for device_id, (user_a, user_b) in family_devices:
        family_device_of[user_a] = device_id
        family_device_of[user_b] = device_id

    # one-off switches hand out the next never-reused slot from the rare pool, so two
    # different one-off events can never accidentally land on the same device/IP either
    next_rare_device = iter(rare_devices)
    next_rare_ip = iter(rare_ips)

    rows = []
    for _ in range(count):
        user_id = random.choice(user_ids)

        if user_id in family_device_of and random.random() < 0.25:
            device_id = family_device_of[user_id]
        elif random.random() < 0.04:
            device_id = next(next_rare_device)  # one-off switch — guaranteed unique
        else:
            device_id = user_home_device[user_id]

        ip_id = next(next_rare_ip) if random.random() < 0.05 else user_home_ip[user_id]
        occurred_at = random_datetime(START, END)
        amount = sample_amount()
        failed_attempts = random.choices([0, 1, 2], weights=[0.9, 0.08, 0.02])[0]

        rows.append({
            "user_id": user_id,
            "device_id": device_id,
            "ip_id": ip_id,
            "merchant_id": random.choice(merchant_ids),
            "amount": amount,
            "payment_method": random.choice(PAYMENT_METHODS),
            "occurred_at": occurred_at,
            "failed_attempts": failed_attempts,
            "is_fraud": False,  # standalone rows get their label after is_new_device is known
        })
    return rows


def build_fraud_ring_transactions(user_ids, ring_devices, ring_ips, merchant_ids):
    """Several distinct users transacting in a burst through one shared device/IP —
    the pattern the graph stage is meant to surface. Amounts overlap the legit tail
    on purpose so the model can't rely on amount alone. Each ring gets its own
    dedicated device/IP from a pool never used anywhere else, so a ring can only ever
    connect its own members — not some unrelated user's home device."""
    rows = []
    for ring_index in range(N_FRAUD_RINGS):
        ring_users = random.sample(user_ids, random.randint(*RING_SIZE))
        shared_device = ring_devices[ring_index]
        shared_ip = ring_ips[ring_index]
        burst_start = random_datetime(START, END - timedelta(hours=1))
        for user_id in ring_users:
            for _ in range(random.randint(2, 4)):
                occurred_at = burst_start + timedelta(minutes=random.randint(0, 45))
                rows.append({
                    "user_id": user_id,
                    "device_id": shared_device,
                    "ip_id": shared_ip,
                    "merchant_id": random.choice(merchant_ids),
                    "amount": round(random.lognormvariate(mu=7.6, sigma=0.7), 2),
                    "payment_method": random.choice(PAYMENT_METHODS),
                    "occurred_at": occurred_at,
                    "failed_attempts": random.choices([0, 1, 2, 3], weights=[0.5, 0.25, 0.15, 0.1])[0],
                    "is_fraud": True,
                })
    return rows


def build_standalone_fraud_transactions(user_ids, standalone_devices, standalone_ips, merchant_ids):
    """High-amount, new-device, failed-attempt fraud with NO device/IP sharing at all —
    each row gets its own dedicated singleton device/IP (device_user_count/ip_user_count
    always 1). Without these, the model never sees this pattern and can't learn it;
    with them, it can score standalone anomalies on their own merits, not just via the
    graph signal."""
    rows = []
    chosen_users = random.sample(user_ids, N_STANDALONE_FRAUD)
    for i, user_id in enumerate(chosen_users):
        night_hour = random.randint(0, 4)
        occurred_at = random_datetime(START, END).replace(
            hour=night_hour, minute=random.randint(0, 59), second=random.randint(0, 59)
        )
        rows.append({
            "user_id": user_id,
            "device_id": standalone_devices[i],
            "ip_id": standalone_ips[i],
            "merchant_id": random.choice(merchant_ids),
            "amount": round(random.uniform(20000, 90000), 2),
            "payment_method": random.choice(PAYMENT_METHODS),
            "occurred_at": occurred_at,
            "failed_attempts": random.randint(2, 5),
            "is_fraud": True,
        })
    return rows


def assign_new_device_flags(transactions):
    """is_new_device = first time this (user, device) pair appears, in time order —
    computed post-hoc so it's consistent regardless of which branch generated the row."""
    seen = set()
    for t in sorted(transactions, key=lambda r: r["occurred_at"]):
        key = (t["user_id"], t["device_id"])
        t["is_new_device"] = key not in seen
        seen.add(key)


def assign_standalone_fraud_labels(transactions):
    """Ring rows already carry is_fraud=True and are left untouched; everything else
    gets labeled now that is_new_device is known (must run after assign_new_device_flags)."""
    for t in transactions:
        if t["is_fraud"]:
            continue
        probability = standalone_fraud_probability(
            t["amount"], t["failed_attempts"], t["occurred_at"].hour, t["is_new_device"]
        )
        t["is_fraud"] = random.random() < probability


def _bulk_insert_and_get_ids(conn, table: str, id_column: str, columns: list[str], rows: list[dict]) -> list[int]:
    """Batch insert then re-select ordered by id — relies on this being the only writer
    and on Postgres assigning SERIAL ids in insertion order, both true for this script."""
    placeholders = ", ".join(f":{c}" for c in columns)
    conn.execute(text(f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"), rows)
    return conn.execute(text(f"SELECT {id_column} FROM {table} ORDER BY {id_column}")).scalars().all()


def load_into_postgres(users, devices, ips, merchants, transactions):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE risk_scores, transactions, users, devices, ip_addresses, merchants RESTART IDENTITY CASCADE"))

        user_ids = _bulk_insert_and_get_ids(conn, "users", "user_id", ["account_created", "is_flagged"], users)
        device_ids = _bulk_insert_and_get_ids(conn, "devices", "device_id", ["fingerprint"], devices)
        ip_ids = _bulk_insert_and_get_ids(conn, "ip_addresses", "ip_id", ["address"], ips)
        merchant_ids = _bulk_insert_and_get_ids(conn, "merchants", "merchant_id", ["name"], merchants)

        for t in transactions:
            t["user_id"] = user_ids[t["user_id"]]
            t["device_id"] = device_ids[t["device_id"]]
            t["ip_id"] = ip_ids[t["ip_id"]]
            t["merchant_id"] = merchant_ids[t["merchant_id"]]

        conn.execute(
            text("""
                INSERT INTO transactions
                    (user_id, device_id, ip_id, merchant_id, amount, payment_method,
                     occurred_at, failed_attempts, is_new_device, is_fraud)
                VALUES
                    (:user_id, :device_id, :ip_id, :merchant_id, :amount, :payment_method,
                     :occurred_at, :failed_attempts, :is_new_device, :is_fraud)
            """),
            transactions,
        )

    return user_ids, device_ids, ip_ids, merchant_ids


def main():
    users, devices, ips, merchants = build_entities()
    user_ids = list(range(N_USERS))
    merchant_ids = list(range(N_MERCHANTS))

    home_devices = list(range(HOME_START, HOME_START + N_HOME))
    home_ips = list(range(HOME_START, HOME_START + N_HOME))
    rare_devices = list(range(RARE_START, RARE_START + N_RARE))
    rare_ips = list(range(RARE_START, RARE_START + N_RARE))
    family_pool = list(range(FAMILY_START, FAMILY_START + N_FAMILY))
    ring_devices = list(range(RING_START, RING_START + N_RING))
    ring_ips = list(range(RING_START, RING_START + N_RING))
    standalone_devices = list(range(STANDALONE_START, STANDALONE_START + N_STANDALONE))
    standalone_ips = list(range(STANDALONE_START, STANDALONE_START + N_STANDALONE))

    family_devices = []
    used_users = set()
    for device_id in family_pool:
        pair = random.sample([u for u in user_ids if u not in used_users], 2)
        family_devices.append((device_id, pair))
        used_users.update(pair)

    normal_txns = build_normal_transactions(
        user_ids, (home_devices, home_ips), (rare_devices, rare_ips), merchant_ids, N_TRANSACTIONS, family_devices
    )
    ring_txns = build_fraud_ring_transactions(user_ids, ring_devices, ring_ips, merchant_ids)
    standalone_txns = build_standalone_fraud_transactions(user_ids, standalone_devices, standalone_ips, merchant_ids)
    transactions = normal_txns + ring_txns + standalone_txns
    assign_new_device_flags(transactions)
    assign_standalone_fraud_labels(transactions)
    random.shuffle(transactions)

    load_into_postgres(users, devices, ips, merchants, transactions)

    fraud_count = sum(1 for t in transactions if t["is_fraud"])
    print(f"Loaded {len(transactions)} transactions ({fraud_count} fraud, "
          f"{fraud_count / len(transactions):.1%}) across {N_USERS} users, "
          f"{TOTAL_DEVICES} devices, {TOTAL_IPS} IPs, {N_MERCHANTS} merchants.")


if __name__ == "__main__":
    main()
