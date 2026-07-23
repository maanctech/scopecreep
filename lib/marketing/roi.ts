export type RoiEstimate = {
  monthlyLeakage: number;
  annualLeakage: number;
  serviceLow: number | null;
  serviceHigh: number | null;
  projectRisk: number;
};

function bounded(value: number, maximum: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, maximum);
}

export function calculateRoiEstimate(input: {
  hourlyRate: number;
  unbilledHours: number;
  activeProjects: number;
  projectValue: number;
}): RoiEstimate {
  const hourlyRate = bounded(input.hourlyRate, 10_000);
  const unbilledHours = bounded(input.unbilledHours, 1_000);
  const activeProjects = Math.floor(bounded(input.activeProjects, 1_000));
  const projectValue = bounded(input.projectValue, 100_000_000);
  const monthlyLeakage = Math.round(hourlyRate * unbilledHours * activeProjects);
  const annualLeakage = monthlyLeakage * 12;

  return {
    monthlyLeakage,
    annualLeakage,
    serviceLow: monthlyLeakage > 0 ? Math.max(750, Math.round(monthlyLeakage * 0.1)) : null,
    serviceHigh: monthlyLeakage > 0 ? Math.max(1500, Math.round(monthlyLeakage * 0.2)) : null,
    projectRisk: projectValue ? Math.round((monthlyLeakage / projectValue) * 100) : 0
  };
}
