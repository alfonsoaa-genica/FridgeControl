import { FC, useState } from 'react';
import { ValidateFieldsError } from 'async-validator';
import { useTranslation } from "react-i18next";

import { Button, Checkbox } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

import * as MqttApi from "../../api/mqtt";
import { MqttSettings } from '../../types';
import { BlockFormControlLabel, ButtonRow, FormLoader, SectionContent, ValidatedPasswordField, ValidatedTextField } from '../../components';
import { MQTT_SETTINGS_VALIDATOR, validate } from '../../validators';
import { numberValue, updateValue, useRest } from '../../utils';

const MqttSettingsForm: FC = () => {
  const { t } = useTranslation();
  const [fieldErrors, setFieldErrors] = useState<ValidateFieldsError>();
  const {
    loadData, saving, data, setData, saveData, errorMessage
  } = useRest<MqttSettings>({
    read: MqttApi.readMqttSettings,
    update: MqttApi.updateMqttSettings
  });
  const updateFormValue = updateValue(setData);
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
        <ButtonRow mt={1}>
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
