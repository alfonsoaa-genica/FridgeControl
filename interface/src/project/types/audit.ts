export interface AuditEvent {
  ts: number;
  user: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
}
