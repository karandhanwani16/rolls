export const SETTLEMENT_STATUS = {
  PENDING: "PENDING",
  PARTIALLY_SETTLED: "PARTIALLY_SETTLED",
  COMPLETED: "COMPLETED",
  COLLECTED: "COLLECTED",
} as const;

export function normalizeSettlementStatus(status?: string | null) {
  const upper = (status || "PENDING").toUpperCase();
  if (upper === "COLLECTED" || upper === "COMPLETED") return "COMPLETED";
  if (upper === "PARTIALLY_SETTLED") return "PARTIALLY_SETTLED";
  return "PENDING";
}

export function settlementLabel(status?: string | null) {
  const normalized = normalizeSettlementStatus(status);
  if (normalized === "COMPLETED") return "Completed";
  if (normalized === "PARTIALLY_SETTLED") return "Partially settled";
  return "Pending";
}

export function settlementClassName(status?: string | null) {
  const normalized = normalizeSettlementStatus(status);
  if (normalized === "COMPLETED") return "text-green-700 font-medium";
  if (normalized === "PARTIALLY_SETTLED") return "text-amber-800 font-medium";
  return "text-amber-700 font-medium";
}

export function isOutstandingStatus(status?: string | null) {
  return normalizeSettlementStatus(status) !== "COMPLETED";
}
