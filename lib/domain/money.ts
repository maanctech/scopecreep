/**
 * Money rules for the Phase 1 revenue workflow.
 *
 * Two units exist in the store and they are never mixed:
 *
 * 1. Legacy "potential revenue" values (ScopeFinding.estimated_revenue and
 *    the older lead/project dollar figures) are stored in DOLLARS. They are
 *    AI suggestions and are never treated as billable amounts.
 * 2. All human-approved amounts (ScopeFinding.approved_amount_cents and
 *    BillingEvent amount fields) are stored in INTEGER CENTS.
 *
 * Rounding rule: converting dollars to cents uses Math.round (round half away
 * from zero for positive values), applied exactly once at conversion time.
 * Stored cent values are integers, so summing them never uses floating-point
 * fractions. Formatting back to dollars happens only at the UI boundary.
 */

export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars)) {
    throw new Error("Cannot convert a non-finite dollar value to cents.");
  }
  return Math.round(dollars * 100);
}

export function assertIntegerCents(value: number, label = "amount_cents"): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents.`);
  }
  return value;
}

/** UI-boundary formatter for integer cents, e.g. 120050 -> "$1,200.50". */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

/** UI-boundary formatter for legacy dollar values, e.g. 13475 -> "$13,475". */
export function formatDollars(dollars: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(dollars);
}
