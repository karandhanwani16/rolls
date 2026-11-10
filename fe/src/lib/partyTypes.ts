/** Presentation helpers — backend still uses Customer with type "watav" */

export const WATAV_CUSTOMER_TYPE = "watav";

export function isWatavVendor(party: { type?: string | null } | null | undefined): boolean {
  return (party?.type || "").toLowerCase() === WATAV_CUSTOMER_TYPE;
}

export function getRegularCustomers<T extends { type?: string | null }>(parties: T[] = []): T[] {
  return parties.filter((p) => !isWatavVendor(p));
}

export function getWatavVendors<T extends { type?: string | null }>(parties: T[] = []): T[] {
  return parties.filter((p) => isWatavVendor(p));
}
