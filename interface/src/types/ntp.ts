export enum NTPSyncStatus {
  NTP_INACTIVE = 0,
  NTP_ACTIVE = 1
}

export interface NTPStatus {
  status: NTPSyncStatus;
  utc_time: string;
  local_time: string;
  server: string;
  uptime: number;
}

export interface NTPSettings {
  enabled: boolean;
  server: string;
  tz_label: string;
  tz_format: string;
}

export interface Time {
  local_time: string;
}

export interface RTCStatus {
  available: boolean;
  model: string;
  temperature: string;
  synced: boolean;
  last_sync_epoch: number;
  last_sync_iso: string;
  drift_sec: number;
  rtc_time_iso: string;
  eeprom_available: boolean;
  eeprom_size: number;
}

export interface RTCSyncResponse {
  success: boolean;
  drift_sec: number;
  temperature: string;
  rtc_time_iso: string;
  message: string;
}
