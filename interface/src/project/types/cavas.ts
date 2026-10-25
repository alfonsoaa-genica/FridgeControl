export interface CavaState {
  id: string;               // "C1", "C6A", "C2", etc.
  descripcion: string;     // "Cava 1 - Conservación Agua Helada"
  modbus_id: number;       // 1, 6, 16, 2, etc.
  tipo: 'conservacion' | 'maduracion';
  has_humidity: boolean;

  temp_pv: number;
  temp_sp: number;
  temp_evap: number;
  temp_diff: number;

  hr_pv: number | null;
  hr_sp: number | null;
  hr_diff: number | null;

  alarm_temp_high: boolean;
  alarm_hr_low: boolean;
  alarm_hr_high: boolean;
  alarm_active: boolean;

  cooling_active: boolean;
  fan_active: boolean;
  defrost_active: boolean;
  heating_active: boolean;
  humid_active: boolean;
  exhaust_active: boolean;

  online: boolean;
  last_seen: number;
  quality_percent: number;

  // Parámetros de Alarma y Tiempos ISA-18.2
  door_grace_sec?: number;
  door_buzzer_sec?: number;
  ack_grace_sec?: number;
  temp_alarm_delta?: number;
  temp_alarm_delay_sec?: number;
}

export interface TrendPoint {
  ts: number;
  tp: number;
  hr: number | null;
}

export interface DiagnosticStat {
  cava: string;
  cava_id?: string;
  modbus_id: number;
  type?: 'KIDE' | 'FRIDGE_IO';
  controller_name?: string;
  tx_frames: number;
  rx_success: number;
  timeouts: number;
  crc_errors: number;
  last_rtt_ms: number;
  quality_percent: number;
  online: boolean;
}

export interface DiscoveredSlave {
  id: number;
  model: string;
  rtt_ms: number;
  temp: number;
  hr?: number;
}

export interface PingResponse {
  id: number;
  success: boolean;
  rtt_ms: number;
  model: string;
  temp_pv: number;
  hr_pv?: number;
}

export interface SignalingNodeData {
  modbus_id: number;
  online: boolean;
  last_seen: number;
  cava_a: string;
  cava_b: string;

  // Entradas
  door_closed_a: boolean;
  ack_pressed_a: boolean;
  kide_alarm_a: boolean;
  door_closed_b: boolean;
  ack_pressed_b: boolean;
  kide_alarm_b: boolean;

  // Salidas
  green_a: boolean;
  yellow_a: boolean;
  red_a: boolean;
  buzzer_a: boolean;
  green_b: boolean;
  yellow_b: boolean;
  red_b: boolean;
  buzzer_b: boolean;

  quality_percent: number;
  enable_1wire: boolean;
  onewire_device_count: number;
  temp_backup_a: number;
  temp_backup_b: number;
}
