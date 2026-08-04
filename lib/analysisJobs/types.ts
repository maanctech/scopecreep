export type Row = Record<string, unknown>;

export type AnalysisMessageRow = {
  id: string;
  source: string;
  sender: string | null;
  sender_email: string | null;
  subject: string | null;
  message_text: string;
  character_count: number;
  message_date: Date | null;
  created_at: Date;
  finding_id: string | null;
  active_job_id: string | null;
  active_job_status: string | null;
};

export type AnalysisJobRow = {
  id: string;
  client_message_id: string | null;
  status: string;
  provider: string;
  model: string;
  progress: number;
  attempt_count: number;
  max_attempts: number;
  error_message: string | null;
  result: { findingId?: string; classification?: string } | null;
  cancel_requested_at: Date | null;
  created_at: Date;
};
