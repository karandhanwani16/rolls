/**
 * Indian (en-IN) number grouping helpers — e.g. 100000 → 1,00,000
 */

export function parseIndianNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const cleaned = String(raw).replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatIndianNumber(
  value: number | string | null | undefined,
  options?: { allowDecimals?: boolean; maxDecimals?: number; emptyWhenZero?: boolean }
): string {
  const allowDecimals = options?.allowDecimals !== false;
  const maxDecimals = options?.maxDecimals ?? 2;
  const emptyWhenZero = options?.emptyWhenZero ?? false;
  const n = typeof value === "number" ? value : parseIndianNumber(value);

  if (!Number.isFinite(n)) return "";
  if (emptyWhenZero && n === 0) return "";

  return n.toLocaleString("en-IN", {
    maximumFractionDigits: allowDecimals ? maxDecimals : 0,
    minimumFractionDigits: 0,
  });
}

/** Sanitize live typing input and return numeric value + display string */
export function sanitizeIndianInput(
  input: string,
  options?: { allowDecimals?: boolean; maxDecimals?: number }
): { value: number; display: string } {
  const allowDecimals = options?.allowDecimals !== false;
  const maxDecimals = options?.maxDecimals ?? 2;

  let cleaned = input.replace(/[^\d.]/g, "");

  if (!allowDecimals) {
    cleaned = cleaned.replace(/\./g, "");
    const value = cleaned === "" ? 0 : Number(cleaned);
    return {
      value: Number.isFinite(value) ? value : 0,
      display: cleaned === "" ? "" : formatIndianNumber(value, { allowDecimals: false }),
    };
  }

  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    const intPart = cleaned.slice(0, firstDot).replace(/\./g, "") || "0";
    let decPart = cleaned.slice(firstDot + 1).replace(/\./g, "");
    if (decPart.length > maxDecimals) {
      decPart = decPart.slice(0, maxDecimals);
    }
    const endsWithDot = input.replace(/,/g, "").endsWith(".") && decPart === "";
    const numericStr = decPart === "" ? intPart : `${intPart}.${decPart}`;
    const value = Number(numericStr);
    const intFormatted = Number(intPart).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });
    const display = endsWithDot
      ? `${intFormatted}.`
      : decPart === ""
        ? intFormatted
        : `${intFormatted}.${decPart}`;
    return {
      value: Number.isFinite(value) ? value : 0,
      display,
    };
  }

  if (cleaned === "") {
    return { value: 0, display: "" };
  }

  const value = Number(cleaned);
  return {
    value: Number.isFinite(value) ? value : 0,
    display: formatIndianNumber(value, { allowDecimals: true, maxDecimals }),
  };
}
