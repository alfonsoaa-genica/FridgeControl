import { FC, useState } from 'react';
import { ValidateFieldsError } from 'async-validator';

import { Button, Checkbox, MenuItem } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

import * as NTPApi from "../../api/ntp";
import { NTPSettings } from '../../types';
import { BlockFormControlLabel, ButtonRow, FormLoader, SectionContent, ValidatedTextField } from '../../components';
import { validate, NTP_SETTINGS_VALIDATOR } from '../../validators';
import { updateValue, useRest } from '../../utils';
import { useTranslation } from 'react-i18next';
import { selectedTimeZone, timeZoneSelectItems, TIME_ZONES } from './TZ';

const NTPSettingsForm: FC = () => {
  const { t } = useTranslation();
  const [fieldErrors, setFieldErrors] = useState<ValidateFieldsError>();
  const {
    loadData, saving, data, setData, saveData, errorMessage
  } = useRest<NTPSettings>({ read: NTPApi.readNTPSettings, update: NTPApi.updateNTPSettings });

  const updateFormValue = updateValue(setData);

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }

    const validateAndSubmit = async () => {
      try {
        setFieldErrors(undefined);
        await validate(NTP_SETTINGS_VALIDATOR, data);
        saveData();
      } catch (errors: any) {
        setFieldErrors(errors);
      }
    };

    const changeTimeZone = (event: React.ChangeEvent<HTMLInputElement>) => {
      setData({
        ...data,
        tz_label: event.target.value,
        tz_format: TIME_ZONES[event.target.value]
      });
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
          label={t('ntp.enable')}
        />
        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="server"
          label={t('ntp_settings.server')}

          fullWidth
          variant="outlined"
          value={data.server}
          onChange={updateFormValue}
          margin="normal"
        />
        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="tz_label"
          label={t('ntp_settings.time_zone')}
          fullWidth
          variant="outlined"
          value={selectedTimeZone(data.tz_label, data.tz_format)}
          onChange={changeTimeZone}
          margin="normal"
          select
        >
          <MenuItem disabled>{t('ntp_settings.time_zone_placeholder')}</MenuItem>
          {timeZoneSelectItems()}

        </ValidatedTextField>
        <ButtonRow mt={1}>
          <Button startIcon={<SaveIcon />} disabled={saving} variant="contained" color="primary" type="submit" onClick={validateAndSubmit}>
            {t('common.SAVE')}
          </Button>
        </ButtonRow>
      </>
    );
  };

  return (
    <SectionContent title={t('ntp.tabs.settings')} titleGutter>
      {content()}
    </SectionContent>
  );

};

export default NTPSettingsForm;
