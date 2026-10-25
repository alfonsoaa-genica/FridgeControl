import axios from 'axios';
import { CavaState, DiagnosticStat, DiscoveredSlave, PingResponse, SignalingNodeData, TrendPoint } from '../types/cavas';

export const fetchCavas = async (): Promise<CavaState[]> => {
  const res = await axios.get<{ cavas: CavaState[] }>('/rest/cavas');
  return res.data.cavas || [];
};

export const fetchCavaHistory = async (cavaId: string): Promise<TrendPoint[]> => {
  const res = await axios.get<string | TrendPoint[]>(`/rest/history?cava=${encodeURIComponent(cavaId)}`, {
    responseType: 'text',
  });
  if (typeof res.data === 'string') {
    const lines = res.data.split('\n').filter((l) => l.trim().length > 0);
    const points: TrendPoint[] = [];
    for (const line of lines) {
      try {
        points.push(JSON.parse(line));
      } catch (e) {
        // Ignore malformed line
      }
    }
    return points;
  }
  return (res.data as any) || [];
};

export const setCavaSetpoint = async (
  cava: string,
  variable: 'temp' | 'hr',
  value: number,
  pin?: string
): Promise<{ success: boolean; message?: string }> => {
  const res = await axios.post('/rest/setpoint', { cava, variable, value, pin });
  return res.data;
};

export const fetchDiagnosticStats = async (): Promise<DiagnosticStat[]> => {
  const res = await axios.get<{ stats: DiagnosticStat[] }>('/rest/diagnostic/stats');
  return res.data.stats || [];
};

export const startBusScan = async (start = 1, end = 32, reset = false): Promise<any> => {
  const params = new URLSearchParams();
  params.append('start', start.toString());
  params.append('end', end.toString());
  if (reset) {params.append('reset', 'true');}
  const res = await axios.post('/rest/diagnostic/scan', params);
  return res.data;
};

export const getScanStatus = async (): Promise<{ status?: string; current_id?: number } | DiscoveredSlave[]> => {
  const res = await axios.get('/rest/diagnostic/scan');
  return res.data;
};

export const pingSlave = async (id: number): Promise<PingResponse> => {
  const params = new URLSearchParams();
  params.append('id', id.toString());
  const res = await axios.post<PingResponse>('/rest/diagnostic/ping', params);
  return res.data;
};

export const fetchSignalingNodes = async (): Promise<SignalingNodeData[]> => {
  const res = await axios.get<{ nodes: SignalingNodeData[] }>('/rest/signaling/nodes');
  return res.data.nodes || [];
};

export const triggerSignalingTest = async (
  nodeId: number,
  mode: 'lamp_test' | 'all_off' | 'stop_test' | 'custom' | 'toggle_bit',
  coilsByte?: number,
  durationSec = 5,
  bitIndex?: number
) => {
  const params = new URLSearchParams();
  params.append('node_id', nodeId.toString());
  params.append('mode', mode);
  params.append('duration_sec', durationSec.toString());
  if (coilsByte !== undefined) params.append('coils_byte', coilsByte.toString());
  if (bitIndex !== undefined) params.append('bit_index', bitIndex.toString());
  const res = await axios.post('/rest/signaling/test', params);
  return res.data;
};

export const updateSignalingMapping = async (nodeId: number, cavaA: string, cavaB: string) => {
  const params = new URLSearchParams();
  params.append('node_id', nodeId.toString());
  params.append('cava_a', cavaA);
  params.append('cava_b', cavaB);
  const res = await axios.post('/rest/signaling/mapping', params);
  return res.data;
};

export const updateCavaAlarmConfig = async (
  cavaId: string,
  config: {
    door_grace_sec?: number;
    door_buzzer_sec?: number;
    ack_grace_sec?: number;
    temp_alarm_delta?: number;
    temp_alarm_delay_sec?: number;
  }
) => {
  const params = new URLSearchParams();
  params.append('cava_id', cavaId);
  if (config.door_grace_sec !== undefined) params.append('door_grace_sec', config.door_grace_sec.toString());
  if (config.door_buzzer_sec !== undefined) params.append('door_buzzer_sec', config.door_buzzer_sec.toString());
  if (config.ack_grace_sec !== undefined) params.append('ack_grace_sec', config.ack_grace_sec.toString());
  if (config.temp_alarm_delta !== undefined) params.append('temp_alarm_delta', config.temp_alarm_delta.toString());
  if (config.temp_alarm_delay_sec !== undefined) params.append('temp_alarm_delay_sec', config.temp_alarm_delay_sec.toString());
  const res = await axios.post('/rest/cavas/alarm_config', params);
  return res.data;
};

export const updateCavaMeta = async (
  cavaId: string,
  meta: {
    new_id?: string;
    descripcion?: string;
    tipo?: 'conservacion' | 'maduracion';
    has_humidity?: boolean;
  }
) => {
  const params = new URLSearchParams();
  params.append('cava_id', cavaId);
  if (meta.new_id) params.append('new_id', meta.new_id);
  if (meta.descripcion) params.append('descripcion', meta.descripcion);
  if (meta.tipo) params.append('tipo', meta.tipo);
  if (meta.has_humidity !== undefined) params.append('has_humidity', meta.has_humidity ? 'true' : 'false');
  const res = await axios.post('/rest/cavas/update_meta', params);
  return res.data;
};

export const fetchCavasConfig = async (): Promise<CavaState[]> => {
  const res = await axios.get<{ cavas: CavaState[] }>('/rest/cavas/config');
  return res.data.cavas || [];
};

export const saveCavaConfig = async (data: {
  id: string;
  original_id?: string;
  modbus_id: number;
  descripcion: string;
  tipo: 'conservacion' | 'maduracion';
  has_humidity: boolean;
  temp_sp?: number;
  temp_alarm_delta?: number;
  hr_sp?: number;
}) => {
  const params = new URLSearchParams();
  params.append('id', data.id);
  if (data.original_id) params.append('original_id', data.original_id);
  params.append('modbus_id', data.modbus_id.toString());
  params.append('descripcion', data.descripcion);
  params.append('tipo', data.tipo);
  params.append('has_humidity', data.has_humidity ? 'true' : 'false');
  if (data.temp_sp !== undefined) params.append('temp_sp', data.temp_sp.toString());
  if (data.temp_alarm_delta !== undefined) params.append('temp_alarm_delta', data.temp_alarm_delta.toString());
  if (data.hr_sp !== undefined) params.append('hr_sp', data.hr_sp.toString());
  const res = await axios.post('/rest/cavas/save', params);
  return res.data;
};

export const deleteCavaConfig = async (id: string) => {
  const params = new URLSearchParams();
  params.append('id', id);
  const res = await axios.post('/rest/cavas/delete', params);
  return res.data;
};

export const initCavasTemplate = async (count: number) => {
  const params = new URLSearchParams();
  params.append('count', count.toString());
  const res = await axios.post('/rest/cavas/init_template', params);
  return res.data;
};
