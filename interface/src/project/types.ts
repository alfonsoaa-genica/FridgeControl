export interface LightState {
  led_on: boolean;
}

export interface LightMqttSettings {
  unique_id: string;
  name: string;
  mqtt_path: string;
}

export enum SystemTab {
  Status = 'status',
  OTA = 'ota',
  Upload = 'upload',
  Language = 'language' // <-- Añade esta línea
}
