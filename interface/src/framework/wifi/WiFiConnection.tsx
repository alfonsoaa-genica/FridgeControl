import { FC, useCallback, useContext, useState } from 'react';
import { Navigate, Routes, Route, useNavigate } from 'react-router-dom';

import { Tab } from '@mui/material';

import { RequireAdmin, RouterTabs, useLayoutTitle, useRouterTab } from '../../components';
import { WiFiNetwork } from '../../types';
import { AuthenticatedContext } from '../../contexts/authentication';

import { WiFiConnectionContext } from './WiFiConnectionContext';
import WiFiStatusForm from './WiFiStatusForm';
import WiFiNetworkScanner from './WiFiNetworkScanner';
import WiFiSettingsForm from './WiFiSettingsForm';
import { useTranslation } from "react-i18next";

const WiFiConnection: FC = () => {
  const { t } = useTranslation();
  useLayoutTitle(t('wifi.title'));

  const authenticatedContext = useContext(AuthenticatedContext);
  const navigate = useNavigate();
  const { routerTab } = useRouterTab();

  const [selectedNetwork, setSelectedNetwork] = useState<WiFiNetwork>();

  const selectNetwork = useCallback((network: WiFiNetwork) => {
    setSelectedNetwork(network);
    navigate('settings');
  }, [navigate]);

  const deselectNetwork = useCallback(() => {
    setSelectedNetwork(undefined);
  }, []);

  return (
    <WiFiConnectionContext.Provider
      value={{
        selectedNetwork,
        selectNetwork,
        deselectNetwork
      }}
    >
      <RouterTabs value={routerTab}>
        <Tab value="status" label={t('wifi.status')} />
        <Tab value="scan" label={t('wifi.scan')} disabled={!authenticatedContext.me.admin} />
        <Tab value="settings" label={t('wifi.settings_title')} disabled={!authenticatedContext.me.admin} />
      </RouterTabs>
      <Routes>
        <Route path="status" element={<WiFiStatusForm />} />
        <Route
          path="scan"
          element={
            <RequireAdmin>
              <WiFiNetworkScanner />
            </RequireAdmin>
          }
        />
        <Route
          path="settings"
          element={
            <RequireAdmin>
              <WiFiSettingsForm />
            </RequireAdmin>
          }
        />
        <Route path="/*" element={<Navigate replace to="status" />} />
      </Routes>
    </WiFiConnectionContext.Provider>
  );

};

export default WiFiConnection;
