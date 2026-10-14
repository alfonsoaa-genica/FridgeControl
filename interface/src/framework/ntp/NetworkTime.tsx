import { FC, useContext } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Tab } from '@mui/material';

import { RequireAdmin, RouterTabs, useLayoutTitle, useRouterTab } from '../../components';
import { AuthenticatedContext } from '../../contexts/authentication';

import NTPStatusForm from './NTPStatusForm';
import NTPSettingsForm from './NTPSettingsForm';
import { useTranslation } from "react-i18next"; // 1. Importar

const NetworkTime: FC = () => {
  const { t } = useTranslation(); // 2. Inicializar
  // 3. Título de la página traducido
  useLayoutTitle(t('ntp.title'));

  const authenticatedContext = useContext(AuthenticatedContext);
  const { routerTab } = useRouterTab();

  return (
    <>
      <RouterTabs value={routerTab}>
        {/* 4. Etiquetas de las pestañas traducidas */}
        <Tab value="status" label={t('ntp.tabs.status')} />
        <Tab
          value="settings"
          label={t('ntp.tabs.settings')}
          disabled={!authenticatedContext.me.admin}
        />
      </RouterTabs>
      <Routes>
        <Route path="status" element={<NTPStatusForm />} />
        <Route
          path="settings"
          element={
            <RequireAdmin>
              <NTPSettingsForm />
            </RequireAdmin>
          }
        />
        <Route path="/*" element={<Navigate replace to="status" />} />
      </Routes>
    </>
  );

};

export default NetworkTime;
