import { FC, useState, useCallback, useContext } from "react";
import {
  Avatar, Button, Divider, List, ListItem, ListItemAvatar, ListItemText, Theme, useTheme,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from "@mui/material";
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import PermScanWifiIcon from '@mui/icons-material/PermScanWifi';
import DnsIcon from '@mui/icons-material/Dns';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";

import * as WiFiApi from "../../api/wifi";
import { WiFiConnectionStatus, WiFiStatus } from "../../types";
import { ButtonRow, FormLoader, SectionContent } from "../../components";
import { useRest } from "../../utils";
import { useTranslation } from "react-i18next";
import { AuthenticatedContext } from "../../contexts/authentication";

const isConnected = ({ status }: WiFiStatus) => status === WiFiConnectionStatus.WIFI_STATUS_CONNECTED;

const wifiStatusHighlight = ({ status }: WiFiStatus, theme: Theme) => {
  switch (status) {
    case WiFiConnectionStatus.WIFI_STATUS_IDLE:
    case WiFiConnectionStatus.WIFI_STATUS_DISCONNECTED:
    case WiFiConnectionStatus.WIFI_STATUS_NO_SHIELD:
      return theme.palette.info.main;
    case WiFiConnectionStatus.WIFI_STATUS_CONNECTED:
      return theme.palette.success.main;
    case WiFiConnectionStatus.WIFI_STATUS_CONNECT_FAILED:
    case WiFiConnectionStatus.WIFI_STATUS_CONNECTION_LOST:
      return theme.palette.error.main;
    default:
      return theme.palette.warning.main;
  }
};

const wifiStatus = (status: WiFiConnectionStatus): string => {
  switch (status) {
    case WiFiConnectionStatus.WIFI_STATUS_NO_SHIELD:
      return "wifi_status.INACTIVE";
    case WiFiConnectionStatus.WIFI_STATUS_IDLE:
      return "wifi_status.IDLE";
    case WiFiConnectionStatus.WIFI_STATUS_NO_SSID_AVAIL:
      return "wifi_status.NO_SSID";
    case WiFiConnectionStatus.WIFI_STATUS_CONNECTED:
      return "wifi_status.CONNECTED";
    case WiFiConnectionStatus.WIFI_STATUS_CONNECT_FAILED:
      return "wifi_status.CONNECT_FAILED";
    case WiFiConnectionStatus.WIFI_STATUS_CONNECTION_LOST:
      return "wifi_status.CONNECTION_LOST";
    case WiFiConnectionStatus.WIFI_STATUS_DISCONNECTED:
      return "wifi_status.DISCONNECTED";
    default:
      return "wifi_status.UNKNOWN";
  }
};

const dnsServers = ({ dns_ip_1, dns_ip_2 }: WiFiStatus) => {
  if (!dns_ip_1) {
    return "none";
  }
  return dns_ip_1 + (dns_ip_2 ? ',' + dns_ip_2 : '');
};

const WiFiStatusForm: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const authenticatedContext = useContext(AuthenticatedContext);
  const isAdmin = authenticatedContext?.me?.admin ?? true;

  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);
  const [forgetting, setForgetting] = useState(false);

  const {
    loadData, data, errorMessage
  } = useRest<WiFiStatus>({ read: WiFiApi.readWiFiStatus });

  const theme = useTheme();

  const handleForgetNetwork = useCallback(async () => {
    try {
      setForgetting(true);
      await WiFiApi.updateWiFiSettings({
        ssid: "",
        password: "",
        hostname: "",
        static_ip_config: false
      });
      enqueueSnackbar(t('wifi.forgot_success', { defaultValue: 'Red Wi-Fi olvidada. Redirigiendo a escaneo...' }), { variant: 'info' });
      setForgetDialogOpen(false);
      navigate('../scan');
    } catch (_err: any) {
      enqueueSnackbar(t('wifi.forgot_error', { defaultValue: 'Error al olvidar la red Wi-Fi' }), { variant: 'error' });
    } finally {
      setForgetting(false);
    }
  }, [enqueueSnackbar, navigate, t]);

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }

    const hasConfiguredNetwork = isConnected(data) || (Boolean(data.ssid) && data.ssid.length > 0);

    return (
      <>
        <List>
          <ListItem>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: wifiStatusHighlight(data, theme) }}>
                <WifiIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('wifi.status')}
              secondary={t(wifiStatus(data.status))}
            />
          </ListItem>
          <Divider variant="inset" component="li" />
          {
            isConnected(data) &&
            <>
              <ListItem>
                <ListItemAvatar>
                  <Avatar>
                    <SettingsInputAntennaIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={t('wifi.ssid')} secondary={data.ssid} />
              </ListItem>
              <Divider variant="inset" component="li" />
              <ListItem>
                <ListItemAvatar>
                  <Avatar>IP</Avatar>
                </ListItemAvatar>
                <ListItemText primary={t('wifi.ip_address')} secondary={data.local_ip} />
              </ListItem>
              <Divider variant="inset" component="li" />
              <ListItem>
                <ListItemAvatar>
                  <Avatar>
                    <DeviceHubIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={t('wifi.mac_address')} secondary={data.mac_address} />
              </ListItem>
              <Divider variant="inset" component="li" />
              <ListItem>
                <ListItemAvatar>
                  <Avatar>#</Avatar>
                </ListItemAvatar>
                <ListItemText primary={t('wifi.subnet')} secondary={data.subnet_mask} />
              </ListItem>
              <Divider variant="inset" component="li" />
              <ListItem>
                <ListItemAvatar>
                  <Avatar>
                    <SettingsInputComponentIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={t('wifi.gateway')} secondary={data.gateway_ip || "none"} />
              </ListItem>
              <Divider variant="inset" component="li" />
              <ListItem>
                <ListItemAvatar>
                  <Avatar>
                    <DnsIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={t('wifi.dns')} secondary={dnsServers(data)} />
              </ListItem>
              <Divider variant="inset" component="li" />
            </>
          }
        </List>

        <ButtonRow pt={2} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {isAdmin && (
            <Button
              startIcon={<PermScanWifiIcon />}
              variant="contained"
              color="primary"
              onClick={() => navigate('../scan')}
            >
              {t('wifi.scan_new', { defaultValue: 'Buscar Redes' })}
            </Button>
          )}

          {isAdmin && hasConfiguredNetwork && (
            <Button
              startIcon={<WifiOffIcon />}
              variant="outlined"
              color="error"
              onClick={() => setForgetDialogOpen(true)}
            >
              {t('wifi.forget_network', { defaultValue: 'Olvidar esta Red' })}
            </Button>
          )}

          <Button startIcon={<RefreshIcon />} variant="outlined" color="secondary" onClick={loadData}>
            {t('common.REFRESH')}
          </Button>
        </ButtonRow>

        <Dialog open={forgetDialogOpen} onClose={() => !forgetting && setForgetDialogOpen(false)}>
          <DialogTitle>{t('wifi.forget_title', { defaultValue: '¿Olvidar red Wi-Fi actual?' })}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('wifi.forget_confirm', {
                defaultValue: 'El módulo se desconectará de la red Wi-Fi y eliminará las credenciales guardadas. ' +
                  'Podrás escanear y conectarte a un punto de acceso diferente.',
                ssid: data.ssid
              })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setForgetDialogOpen(false)} disabled={forgetting}>
              {t('common.CANCEL')}
            </Button>
            <Button
              onClick={handleForgetNetwork}
              variant="contained"
              color="error"
              disabled={forgetting}
              startIcon={<WifiOffIcon />}
            >
              {forgetting ? t('common.LOADING') : t('wifi.forget_action', { defaultValue: 'Olvidar y Escanear' })}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  };

  return (
    <SectionContent title={t('wifi.title')} titleGutter>
      {content()}
    </SectionContent>
  );

};

export default WiFiStatusForm;
