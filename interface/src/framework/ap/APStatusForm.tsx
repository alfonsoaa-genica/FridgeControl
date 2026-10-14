import { FC } from "react";

import { Avatar, Button, Divider, List, ListItem, ListItemAvatar, ListItemText, Theme, useTheme } from "@mui/material";
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import ComputerIcon from '@mui/icons-material/Computer';
import RefreshIcon from '@mui/icons-material/Refresh';

import * as APApi from "../../api/ap";
import { APNetworkStatus, APStatus } from "../../types";
import { ButtonRow, FormLoader, SectionContent } from "../../components";
import { useRest } from "../../utils";
import { useTranslation } from "react-i18next";

const apStatusHighlight = ({ status }: APStatus, theme: Theme) => {
  switch (status) {
    case APNetworkStatus.ACTIVE:
      return theme.palette.success.main;
    case APNetworkStatus.INACTIVE:
      return theme.palette.info.main;
    case APNetworkStatus.LINGERING:
      return theme.palette.warning.main;
    default:
      return theme.palette.warning.main;
  }
};

const APStatusForm: FC = () => {
  const { t } = useTranslation();
  const { loadData, data, errorMessage } = useRest<APStatus>({ read: APApi.readAPStatus });

  const theme = useTheme();

  const apStatus = ({ status }: APStatus) => {
    switch (status) {
      case APNetworkStatus.ACTIVE:
        return t('ap.status_list.ACTIVE');
      case APNetworkStatus.INACTIVE:
        return t('ap.status_list.INACTIVE');
      case APNetworkStatus.LINGERING:
        return t('ap.status_list.LINGERING');
      default:
        return t('ap.status_list.UNKNOWN');
    }
  };

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }

    return (
      <>
        <List>
          <ListItem>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: apStatusHighlight(data, theme) }}>
                <SettingsInputAntennaIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={t('ap.status')} secondary={apStatus(data)} />
          </ListItem>
          <Divider variant="inset" component="li" />
          <ListItem>
            <ListItemAvatar>
              <Avatar>IP</Avatar>
            </ListItemAvatar>
            <ListItemText primary={t('ap.ip_address')} secondary={data.ip_address} />
          </ListItem>
          <Divider variant="inset" component="li" />
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <DeviceHubIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={t('ap.mac_address')} secondary={data.mac_address} />
          </ListItem>
          <Divider variant="inset" component="li" />
          <ListItem>
            <ListItemAvatar>
              <Avatar>
                <ComputerIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={t('ap.connected_clients')} secondary={data.station_num} />
          </ListItem>
          <Divider variant="inset" component="li" />
        </List>
        <ButtonRow pt={1}>
          <Button startIcon={<RefreshIcon />} variant="contained" color="secondary" onClick={loadData}>
            {t('common.REFRESH')}
          </Button>
        </ButtonRow>
      </>
    );
  };

  return (
    <SectionContent title={t('ap.status')} titleGutter>
      {content()}
    </SectionContent>
  );

};

export default APStatusForm;
