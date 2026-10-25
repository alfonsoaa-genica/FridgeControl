import { FC, useContext, useEffect, useRef, useState } from 'react';
import { ValidateFieldsError } from 'async-validator';

import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Typography,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import LockIcon from '@mui/icons-material/Lock';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';

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
  const importFileRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidateFieldsError>();
  const [jsonMessage, setJsonMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

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

  const exportSettings = () => {
    if (!data) {
      return;
    }
    const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wifiSettings.json';
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
      if (
        !imported ||
        typeof imported !== 'object' ||
        !('ssid' in imported) ||
        !('password' in imported) ||
        !('hostname' in imported) ||
        !('static_ip_config' in imported) ||
        typeof imported.ssid !== 'string' ||
        typeof imported.password !== 'string' ||
        typeof imported.hostname !== 'string' ||
        typeof imported.static_ip_config !== 'boolean'
      ) {
        throw new Error(t('wifi.json_invalid'));
      }

      const settings = imported as WiFiSettings;
      const optionalFields: (keyof WiFiSettings)[] = ['local_ip', 'gateway_ip', 'subnet_mask', 'dns_ip_1', 'dns_ip_2'];
      if (optionalFields.some((key) => settings[key] !== undefined && typeof settings[key] !== 'string')) {
        throw new Error(t('wifi.json_invalid'));
      }

      setData(settings);
      setJsonMessage({ severity: 'success', text: t('wifi.json_imported') });
      setFieldErrors(undefined);
    } catch (error) {
      setJsonMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : t('wifi.json_invalid'),
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
            {t('wifi.import_json')}
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
            onClick={exportSettings}
          >
            {t('wifi.export_json')}
          </Button>
          <Button startIcon={<SaveIcon />} disabled={saving} variant="contained" color="primary" type="submit" onClick={validateAndSubmit}>
            {t('common.SAVE')} {/* 8. Botón Guardar */}
          </Button>
        </ButtonRow>
        <Typography variant="caption" color="text.secondary">
          {t('wifi.json_help')}
        </Typography>
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
