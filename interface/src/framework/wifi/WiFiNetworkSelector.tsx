import { FC, useContext } from 'react';
import { Avatar, Badge, List, ListItem, ListItemAvatar, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import WifiIcon from '@mui/icons-material/Wifi';

import { WiFiNetwork, WiFiNetworkList } from '../../types';
import { MessageBox } from '../../components';

import { WiFiConnectionContext } from './WiFiConnectionContext';
import { isNetworkOpen, networkSecurityMode } from './wifiUtils';
import { useTranslation } from "react-i18next"; // 1. Importar

interface WiFiNetworkSelectorProps {
  networkList: WiFiNetworkList;
}

const WiFiNetworkSelector: FC<WiFiNetworkSelectorProps> = ({ networkList }) => {
  const { t } = useTranslation(); // 2. Inicializar
  const wifiConnectionContext = useContext(WiFiConnectionContext);

  const renderNetwork = (network: WiFiNetwork) => {
    return (
      <ListItem key={network.bssid} disablePadding>
        <ListItemButton onClick={() => wifiConnectionContext.selectNetwork(network)}>
          <ListItemAvatar>
            <Avatar>
              {isNetworkOpen(network) ? <LockOpenIcon /> : <LockIcon />}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={network.ssid}
            /* 3. Traducción de etiquetas técnicas */
            secondary={`${t('wifi.security')}: ${networkSecurityMode(network)}, ${t('wifi.channel')}: ${network.channel}`}
          />
          <ListItemIcon>
            <Badge badgeContent={network.rssi + "dB"}>
              <WifiIcon />
            </Badge>
          </ListItemIcon>
        </ListItemButton>
      </ListItem>
    );
  };

  if (networkList.networks.length === 0) {
    return (
      /* 4. Traducción de mensaje de lista vacía */
      <MessageBox mt={2} mb={1} message={t('wifi.no_networks')} level="info" />
    );
  }

  return (
    <List>
      {networkList.networks.map(renderNetwork)}
    </List>
  );
};

export default WiFiNetworkSelector;
