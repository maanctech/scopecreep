export function requireSinglePublicOrganization(rows: Array<{ id: string }>) {
  if (rows.length === 0) {
    throw new Error("Public audit intake is not configured.");
  }

  if (rows.length !== 1) {
    throw new Error("Public audit intake must be enabled for exactly one organization.");
  }

  return rows[0].id;
}
