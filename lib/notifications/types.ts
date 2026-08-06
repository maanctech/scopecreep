export type ProfessionalNotification = {
  id: string;
  notification_type: string;
  project_id: string | null;
  finding_id: string | null;
  analysis_job_id: string | null;
  connection_id: string | null;
  title: string;
  detail: string;
  read_at: string | null;
  created_at: string;
  project_name: string | null;
  client_name: string | null;
  href: string;
};
