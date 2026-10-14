import { FC, useContext, useEffect, useRef, useState } from 'react';
import { ValidateFieldsError } from 'async-validator';

import { Avatar, Button, Checkbox, IconButton, List, ListItem, ListItemAvatar, ListItemSecondaryAction, ListItemText } from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import LockIcon from '@mui/icons-material/Lock';

import * as WiFiApi from "../../api/wifi";
import { WiFiSettings } from '../../types';
import { BlockFormControlLabel, ButtonRow, FormLoader, SectionContent, ValidatedPasswordField, ValidatedTextField } from '../../components';
import { validate, createWiFiSettingsValidator } from '../../validators';
import { updateValue, useRest } from '../../utils';

import { WiFiConnectionContext } from './WiFiConnectionContext';
import { isNetworkOpen, networkSecurityMode } from './wifiUtils';
import { useTranslation } from "react-i18next"; // 1. Importar

const WiFiSettingsForm: FC = () => {
  const { t } = useTranslation(); // 2. Inicializar
  const { selectedNetwork, deselectNetwork } = useContext(WiFiConnectionContext);

  const initalizedRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<ValidateFieldsError>();

  const {
    loadData, saving, data, setData, saveData, errorMessage
  } = useRest<WiFiSettings>({ read: WiFiApi.readWiFiSettings, update: WiFiApi.updateWiFiSettings });

  useEffect(() => {
    if (!initalizedRef.current && data) {
      if (selectedNetwork) {
        setData({
          ssid: selectedNetwork.ssid,
          password: "",
          hostname: data?.hostname,
          static_ip_config: false,
        });
      }
      initalizedRef.current = true;
    }
  }, [data, setData, selectedNetwork]);

  const updateFormValue = updateValue(setData);

  useEffect(() => deselectNetwork, [deselectNetwork]);

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }

    const validateAndSubmit = async () => {
      try {
        setFieldErrors(undefined);
        await validate(createWiFiSettingsValidator(data), data);
        saveData();
      } catch (errors: any) {
        setFieldErrors(errors);
      }
    };

    return (
      <>
        {
          selectedNetwork ?
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar>
                    {isNetworkOpen(selectedNetwork) ? <LockOpenIcon /> : <LockIcon />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={selectedNetwork.ssid}
                  /* 3. Traducción de etiquetas de seguridad dinámicas */
                  secondary={`${t('wifi.security')}: ${networkSecurityMode(selectedNetwork)},
                   ${t('wifi.channel')}: ${selectedNetwork.channel}`}
                />
                <ListItemSecondaryAction>
                  <IconButton aria-label={t('wifi.manual_config')} onClick={deselectNetwork}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>

              </ListItem>
            </List>
            :
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="ssid"
              label={t('wifi.ssid')} // 4. Placeholder SSID
              fullWidth
              variant="outlined"
              value={data.ssid}
              onChange={updateFormValue}
              margin="normal"
            />
        }
        {
          (!selectedNetwork || !isNetworkOpen(selectedNetwork)) &&
          <ValidatedPasswordField
            fieldErrors={fieldErrors}
            name="password"
            label={t('wifi.password')} // 5. Placeholder Password
            fullWidth
            variant="outlined"
            value={data.password}
            onChange={updateFormValue}
            margin="normal"
          />
        }
        <ValidatedTextField
          fieldErrors={fieldErrors}
          name="hostname"
          label={t('wifi.hostname')} // 6. Placeholder Hostname
          fullWidth
          variant="outlined"
          value={data.hostname}
          onChange={updateFormValue}
          margin="normal"
        />
        <BlockFormControlLabel
          control={
            <Checkbox
              name="static_ip_config"
              checked={data.static_ip_config}
              onChange={updateFormValue}
            />
          }
          label={t('wifi.static_ip_q')} // 7. Placeholder "¿IP Estática?"
        />
        {
          data.static_ip_config &&
          <>
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="local_ip"
              label={t('wifi.ip_address')}
              fullWidth
              variant="outlined"
              value={data.local_ip}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="gateway_ip"
              label={t('wifi.gateway')}
              fullWidth
              variant="outlined"
              value={data.gateway_ip}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="subnet_mask"
              label={t('wifi.subnet')}
              fullWidth
              variant="outlined"
              value={data.subnet_mask}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="dns_ip_1"
              label={t('wifi.dns_ip_1')}
              fullWidth
              variant="outlined"
              value={data.dns_ip_1}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="dns_ip_2"
              label={t('wifi.dns_ip_2')}
              fullWidth
              variant="outlined"
              value={data.dns_ip_2}
              onChange={updateFormValue}
              margin="normal"
            />
          </>
        }
        <ButtonRow mt={1}>
          <Button startIcon={<SaveIcon />} disabled={saving} variant="contained" color="primary" type="submit" onClick={validateAndSubmit}>
            {t('common.SAVE')} {/* 8. Botón Guardar */}
          </Button>
        </ButtonRow>
      </>
    );
  };

  return (
    <SectionContent title={t('wifi.settings_title')} titleGutter>
      {content()}
    </SectionContent>
  );
};

export default WiFiSettingsForm;
