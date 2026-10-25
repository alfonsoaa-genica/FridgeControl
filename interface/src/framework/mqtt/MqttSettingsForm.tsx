import { FC, useRef, useState } from 'react';
import { ValidateFieldsError } from 'async-validator';
import { useTranslation } from "react-i18next";

import { Alert, Button, Checkbox } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import * as MqttApi from "../../api/mqtt";
import { MqttSettings } from '../../types';
import { BlockFormControlLabel, ButtonRow, FormLoader, SectionContent, ValidatedPasswordField, ValidatedTextField } from '../../components';
import { MQTT_SETTINGS_VALIDATOR, validate } from '../../validators';
import { numberValue, updateValue, useRest } from '../../utils';

const isMqttSettings = (value: unknown): value is MqttSettings => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const settings = value as Record<string, unknown>;
  return typeof settings.enabled === 'boolean' &&
    typeof settings.host === 'string' &&
    typeof settings.port === 'number' &&
    typeof settings.username === 'string' &&
    typeof settings.password === 'string' &&
    typeof settings.client_id === 'string' &&
    (settings.base_topic === undefined || typeof settings.base_topic === 'string') &&
    typeof settings.keep_alive === 'number' &&
    typeof settings.clean_session === 'boolean' &&
    typeof settings.max_topic_length === 'number';
};

const MqttSettingsForm: FC = () => {
  const { t } = useTranslation();
  const importFileRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidateFieldsError>();
  const [jsonMessage, setJsonMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const {
    loadData, saving, data, setData, saveData, errorMessage
  } = useRest<MqttSettings>({
    read: MqttApi.readMqttSettings,
    update: MqttApi.updateMqttSettings
  });
  const updateFormValue = updateValue(setData);

  const exportSettings = () => {
    if (!data) {
      return;
    }
    const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mqttSettings.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const imported: unknown = JSON.parse(await file.text());
      if (!isMqttSettings(imported)) {
        throw new Error(t('mqtt.json_invalid'));
      }
      setData(imported);
      setJsonMessage({ severity: 'success', text: t('mqtt.json_imported') });
      setFieldErrors(undefined);
    } catch (error) {
      setJsonMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : t('mqtt.json_invalid'),
      });
    }
  };

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }

    const validateAndSubmit = async () => {
      try {
        setFieldErrors(undefined);
        await validate(MQTT_SETTINGS_VALIDATOR, data);
        saveData();
      } catch (errors: any) {
        setFieldErrors(errors);
      }
    };

    return (
      <>
        <BlockFormControlLabel
          control={
            <Checkbox
              name="enabled"
              checked={data.enabled}
              onChange={updateFormValue}
            />
          }
          label={t('mqtt.fields.enabled')}
        />

        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="host"
          label={t('mqtt.fields.host')}
          fullWidth
          variant="outlined"
          value={data.host}
          onChange={updateFormValue}
          margin="normal"
        />

        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="port"
          label={t('mqtt.fields.port')}
          fullWidth
          variant="outlined"
          value={numberValue(data.port)}
          type="number"
          onChange={updateFormValue}
          margin="normal"
        />

        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="username"
          label={t('mqtt.fields.username')}
          fullWidth
          variant="outlined"
          value={data.username}
          onChange={updateFormValue}
          margin="normal"
        />

        <ValidatedPasswordField
          fieldErrors={fieldErrors}
          name="password"
          label={t('mqtt.fields.password')}
          fullWidth
          variant="outlined"
          value={data.password}
          onChange={updateFormValue}
          margin="normal"
        />

        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="client_id"
          label={t('mqtt.fields.client_id_optional')}
          fullWidth
          variant="outlined"
          value={data.client_id}
          onChange={updateFormValue}
          margin="normal"
        />

        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="base_topic"
          label="Tópico Principal / Raíz (Base Topic)"
          helperText="Ej: genica/dalvi/cavas. El Maestro derivará /cavas, /nodos y /maestro para FUXA."
          fullWidth
          variant="outlined"
          value={data.base_topic || 'genica/dalvi/cavas'}
          onChange={updateFormValue}
          margin="normal"
        />

        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="keep_alive"
          label={t('mqtt.fields.keep_alive')}
          fullWidth
          variant="outlined"
          value={numberValue(data.keep_alive)}
          type="number"
          onChange={updateFormValue}
          margin="normal"
        />

        <BlockFormControlLabel
          control={
            <Checkbox
              name="clean_session"
              checked={data.clean_session}
              onChange={updateFormValue}
            />
          }
          label={t('mqtt.fields.clean_session')}
        />

        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="max_topic_length"
          label={t('mqtt.fields.max_topic_length')}
          fullWidth
          variant="outlined"
          value={numberValue(data.max_topic_length)}
          type="number"
          onChange={updateFormValue}
          margin="normal"
        />
        {jsonMessage && (
          <Alert severity={jsonMessage.severity} onClose={() => setJsonMessage(null)} sx={{ mt: 1 }}>
            {jsonMessage.text}
          </Alert>
        )}
        <input
          ref={importFileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importSettings}
        />
        <ButtonRow mt={1}>
          <Button
            startIcon={<UploadFileIcon />}
            variant="outlined"
            onClick={() => importFileRef.current?.click()}
          >
            {t('mqtt.import_json')}
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
            onClick={exportSettings}
          >
            {t('mqtt.export_json')}
          </Button>
          <Button
            startIcon={<SaveIcon />}
            disabled={saving}
            variant="contained"
            color="primary"
            onClick={validateAndSubmit}
          >
            {t('common.SAVE')}
          </Button>
        </ButtonRow>
      </>
    );
  };

  return (
    <SectionContent title={t('mqtt.tabs.settings')} titleGutter>
      {content()}
    </SectionContent>
  );
};

export default MqttSettingsForm;
