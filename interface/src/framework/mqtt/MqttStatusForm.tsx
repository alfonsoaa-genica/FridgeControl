import { FC } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, Button, Divider, List, ListItem, ListItemAvatar, ListItemText, Theme, useTheme } from "@mui/material";
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReportIcon from '@mui/icons-material/Report';

import * as MqttApi from "../../api/mqtt";
import { MqttStatus, MqttDisconnectReason } from "../../types";
import { ButtonRow, FormLoader, SectionContent } from "../../components";
import { useRest } from "../../utils";

// Funciones auxiliares privadas (sin export) para evitar errores de Fast Refresh
const mqttStatusHighlight = ({ enabled, connected }: MqttStatus, theme: Theme) => {
  if (!enabled) {
    return theme.palette.info.main;
  }
  if (connected) {
    return theme.palette.success.main;
  }
  return theme.palette.error.main;
};

const MqttStatusForm: FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { loadData, data, errorMessage } = useRest<MqttStatus>({ read: MqttApi.readMqttStatus });

  // Lógica de textos de estado con llaves de traducción correctas
  const getMqttStatusText = ({ enabled, connected }: MqttStatus) => {
    if (!enabled) { return t('mqtt.status_list.disabled'); }
    if (connected) { return t('mqtt.status_list.connected'); }
    return t('mqtt.status_list.disconnected');
  };

  const getDisconnectReasonText = ({ disconnect_reason }: MqttStatus) => {
    switch (disconnect_reason) {
      case MqttDisconnectReason.USER_OK:
        return t('mqtt.reasons.user_ok');
      case MqttDisconnectReason.MQTT_UNACCEPTABLE_PROTOCOL_VERSION:
        return t('mqtt.reasons.unacceptable_protocol');
      case MqttDisconnectReason.MQTT_IDENTIFIER_REJECTED:
        return t('mqtt.reasons.id_rejected');
      case MqttDisconnectReason.MQTT_SERVER_UNAVAILABLE:
        return t('mqtt.reasons.server_unavailable');
      case MqttDisconnectReason.MQTT_MALFORMED_CREDENTIALS:
        return t('mqtt.reasons.malformed_credentials');
      case MqttDisconnectReason.MQTT_NOT_AUTHORIZED:
        return t('mqtt.reasons.not_authorized');
      case MqttDisconnectReason.TLS_BAD_FINGERPRINT:
        return t('mqtt.reasons.bad_fingerprint');
      case MqttDisconnectReason.TCP_DISCONNECTED:
        return t('mqtt.reasons.tcp_disconnected');
      default:
        return `${t('mqtt.reasons.unknown')} (${disconnect_reason})`;
    }
  };

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }

    const renderConnectionStatus = () => {
      if (data.connected) {
        return (
          <>
            <ListItem>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>#</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={t('mqtt.fields.client_id')}
                secondary={data.client_id}
              />
            </ListItem>
            <Divider variant="inset" component="li" />
          </>
        );
      }
      return (
        <>
          <ListItem>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: theme.palette.error.light }}>
                <ReportIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('mqtt.fields.disconnect_reason')}
              secondary={getDisconnectReasonText(data)}
            />
          </ListItem>
          <Divider variant="inset" component="li" />
        </>
      );
    };

    return (
      <>
        <List>
          <ListItem>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: mqttStatusHighlight(data, theme) }}>
                <DeviceHubIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('mqtt.status')}
              secondary={getMqttStatusText(data)}
            />
          </ListItem>
          <Divider variant="inset" component="li" />
          {data.enabled && renderConnectionStatus()}
        </List >
        <ButtonRow pt={1}>
          <Button
            startIcon={<RefreshIcon />}
            variant="contained"
            color="secondary"
            onClick={loadData}
          >
            {t('common.REFRESH')}
          </Button>
        </ButtonRow>
      </>
    );
  };

  return (
    <SectionContent title={t('mqtt.status')} titleGutter>
      {content()}
    </SectionContent>
  );
};

export default MqttStatusForm;
