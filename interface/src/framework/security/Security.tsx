import { FC } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { useTranslation } from "react-i18next";

import { Tab } from '@mui/material';

import { RouterTabs, useRouterTab, useLayoutTitle } from '../../components';

import SecuritySettingsForm from './SecuritySettingsForm';
import ManageUsersForm from './ManageUsersForm';

const Security: FC = () => {
  const { t } = useTranslation();
  // Título del layout traducido
  useLayoutTitle(t('security.title'));
  const { routerTab } = useRouterTab();
  return (
    <>
      <RouterTabs value={routerTab}>
        <Tab
          value="users"
          label={t('security.tabs.users')}
        />
        <Tab
          value="settings"
          label={t('security.tabs.settings')}
        />
      </RouterTabs>
      <Routes>
        <Route path="users" element={<ManageUsersForm />} />
        <Route path="settings" element={<SecuritySettingsForm />} />
        <Route path="/*" element={<Navigate replace to="users" />} />
      </Routes>
    </>
  );
};

export default Security;
