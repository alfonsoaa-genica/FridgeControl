import axios from 'axios';
import { AuditEvent } from '../types/audit';

export const fetchAuditEvents = async (): Promise<AuditEvent[]> => {
  const res = await axios.get<{ events: AuditEvent[] }>('/rest/audit');
  return res.data.events || [];
};

export const clearAuditEvents = async (): Promise<void> => {
  await axios.post('/rest/audit/clear');
};
