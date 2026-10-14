import { FC, useState } from 'react';
import { ValidateFieldsError } from 'async-validator';
import { range } from 'lodash';

import { Button, Checkbox, MenuItem } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

import * as APApi from "../../api/ap";
import { APProvisionMode, APSettings, isAPEnabled } from '../../types';
import { BlockFormControlLabel, ButtonRow, FormLoader, SectionContent, ValidatedPasswordField, ValidatedTextField } from '../../components';
import { createAPSettingsValidator, validate } from '../../validators';
import { numberValue, updateValue, useRest } from '../../utils';
import { useTranslation } from 'react-i18next';

const APSettingsForm: FC = () => {
  const { t } = useTranslation();
  const [fieldErrors, setFieldErrors] = useState<ValidateFieldsError>();
  const {
    loadData, saving, data, setData, saveData, errorMessage
  } = useRest<APSettings>({ read: APApi.readAPSettings, update: APApi.updateAPSettings });

  const updateFormValue = updateValue(setData);

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }

    const validateAndSubmit = async () => {
      try {
        setFieldErrors(undefined);
        await validate(createAPSettingsValidator(data), data);
        saveData();
      } catch (errors: any) {
        setFieldErrors(errors);
      }
    };

    return (
      <>
        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="provision_mode"
          label={t('ap.provide access point')}
          value={data.provision_mode}
          fullWidth
          select
          variant="outlined"
          onChange={updateFormValue}
          margin="normal"
        >
          <MenuItem value={APProvisionMode.AP_MODE_ALWAYS}>{t('ap.provisioning.MODE_LABEL')}</MenuItem>
          <MenuItem value={APProvisionMode.AP_MODE_DISCONNECTED}>{t('ap.provisioning.MODE_DISCONNECTED')}</MenuItem>
          <MenuItem value={APProvisionMode.AP_NEVER}>{t('ap.provisioning.MODE_NEVER')}</MenuItem>
        </ValidatedTextField>
        {
          isAPEnabled(data) &&
          <>
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="ssid"
              label={t('ap.ssid')}
              fullWidth
              variant="outlined"
              value={data.ssid}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedPasswordField
              fieldErrors={fieldErrors}
              name="password"
              label={t('ap.password')}
              fullWidth
              variant="outlined"
              value={data.password}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="channel"
              label={t('ap.channel')}
              value={numberValue(data.channel)}
              fullWidth
              select
              type="number"
              variant="outlined"
              onChange={updateFormValue}
              margin="normal"
            >
              {
                range(1, 14).map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)
              }
            </ValidatedTextField>
            <BlockFormControlLabel
              control={
                <Checkbox
                  name="ssid_hidden"
                  checked={data.ssid_hidden}
                  onChange={updateFormValue}
                />
              }
              label={t('ap.hide_ssid')}
            />
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="max_clients"
              label={t('ap.max_clients')}
              value={numberValue(data.max_clients)}
              fullWidth
              select
              type="number"
              variant="outlined"
              onChange={updateFormValue}
              margin="normal"
            >
              {
                range(1, 9).map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)
              }
            </ValidatedTextField>
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="local_ip"
              label={t('ap.local_ip')}
              fullWidth
              variant="outlined"
              value={data.local_ip}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="gateway_ip"
              label={t('ap.gateway')}
              fullWidth
              variant="outlined"
              value={data.gateway_ip}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="subnet_mask"
              label={t('ap.subnet')}
              fullWidth
              variant="outlined"
              value={data.subnet_mask}
              onChange={updateFormValue}
              margin="normal"
            />
          </>
        }
        <ButtonRow mt={1}>
          <Button startIcon={<SaveIcon />} disabled={saving} variant="contained" color="primary" type="submit" onClick={validateAndSubmit}>
            {t('common.SAVE')}
          </Button>
        </ButtonRow>
      </>
    );
  };

  return (
    <SectionContent title={t('ap.settings')} titleGutter>
      {content()}
    </SectionContent>
  );

};

export default APSettingsForm;
