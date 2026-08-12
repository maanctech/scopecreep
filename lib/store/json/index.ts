export type { LeadInput, AuditRequestInput, ProjectInput } from "@/lib/store/json/intake";
export { resetLocalDemoStore, createLead, updateLeadStatus, createAuditRequest, createProject } from "@/lib/store/json/intake";
export type { AppDashboard } from "@/lib/store/json/dashboard";
export {
  getAppDashboard,
  getProjectDetail,
  getFindings,
  getFindingDetail,
  getBillingEvents,
  getProjectFindingEvents
} from "@/lib/store/json/dashboard";
export { saveMessageWithFinding, updateFindingDetails, performFindingAction } from "@/lib/store/json/findings";
export {
  readAuditReport,
  generateAuditReport,
  getReportHistory,
  getReportVersion,
  exportFindingsCsv,
  getBusinessDashboard,
  getSalesTemplates
} from "@/lib/store/json/reports";
