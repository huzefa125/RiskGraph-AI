"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PredictionResponse } from "@/lib/types";

const PAYMENT_METHODS = ["card", "upi", "netbanking", "wallet"];

const inputClass =
  "w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-2";

export function TransactionForm({
  onResult,
}: {
  onResult: (result: PredictionResponse) => void;
}) {
  const [userId, setUserId] = useState("1");
  const [deviceFingerprint, setDeviceFingerprint] = useState("new-device-001");
  const [ipAddress, setIpAddress] = useState("203.0.113.5");
  const [merchantId, setMerchantId] = useState("1");
  const [amount, setAmount] = useState("48000");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [failedAttempts, setFailedAttempts] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.predict({
        user_id: Number(userId),
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress,
        merchant_id: Number(merchantId),
        amount: Number(amount),
        payment_method: paymentMethod,
        failed_attempts: Number(failedAttempts),
      });
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to score transaction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
          User ID
          <input
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            type="number"
            required
          />
        </label>
        <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Merchant ID
          <input
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            type="number"
            required
          />
        </label>
        <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Device fingerprint
          <input
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
            value={deviceFingerprint}
            onChange={(e) => setDeviceFingerprint(e.target.value)}
            required
          />
        </label>
        <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
          IP address
          <input
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            required
          />
        </label>
        <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Amount (₹)
          <input
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            required
          />
        </label>
        <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Failed attempts
          <input
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
            value={failedAttempts}
            onChange={(e) => setFailedAttempts(e.target.value)}
            type="number"
            min="0"
            required
          />
        </label>
        <label className="col-span-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          Payment method
          <select
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--seq-500)" }}
      >
        {loading ? "Scoring…" : "Score transaction"}
      </button>
    </form>
  );
}
