import { FC, useContext } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Tab } from '@mui/material';

import { RequireAdmin, RouterTabs, useLayoutTitle, useRouterTab } from '../../components';
import { AuthenticatedContext } from '../../contexts/authentication';

import MqttStatusForm from './MqttStatusForm';
import MqttSettingsForm from './MqttSettingsForm';
import { useTranslation } from "react-i18next";

const Mqtt: FC = () => {
  const { t } = useTranslation();
  // Usamos la traducción para el título del Layout
  useLayoutTitle(t('mqtt.title'));

  const authenticatedContext = useContext(AuthenticatedContext);
  const { routerTab } = useRouterTab();

  return (
    <>
      <RouterTabs value={routerTab}>
        {/* Pestañas con etiquetas traducidas */}
        <Tab
          value="status"
          label={t('mqtt.tabs.status')}
        />
        <Tab
          value="settings"
          label={t('mqtt.tabs.settings')}
          disabled={!authenticatedContext.me.admin}
        />
      </RouterTabs>
      <Routes>
        <Route path="status" element={<MqttStatusForm />} />
        <Route
          path="settings"
          element={
            <RequireAdmin>
              <MqttSettingsForm />
            </RequireAdmin>
          }
        />
        <Route path="/*" element={<Navigate replace to="status" />} />
      </Routes>
    </>
  );
};

export default Mqtt;
