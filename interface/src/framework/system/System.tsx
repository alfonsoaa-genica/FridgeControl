import { FC, useContext } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { useTranslation } from "react-i18next";

import { Tab } from '@mui/material';

import { useRouterTab, RouterTabs, useLayoutTitle, RequireAdmin } from '../../components';
import { AuthenticatedContext } from '../../contexts/authentication';
import { FeaturesContext } from '../../contexts/features';
import UploadFSForm from './UploadFSForm';
import UploadFirmwareForm from './UploadFirmwareForm';
import SystemStatusForm from './SystemStatusForm';
import OTASettingsForm from './OTASettingsForm';
import LanguageSettingsForm from '../../project/LanguageSettingsForm';
import FileManager from '../system/FileManager';

const System: FC = () => {
  const { t } = useTranslation();
  const { me } = useContext(AuthenticatedContext);
  const { features } = useContext(FeaturesContext);
  const { routerTab } = useRouterTab();

  // Título del Layout traducido
  useLayoutTitle(t('system.title'));

  return (
    <>
      <RouterTabs value={routerTab}>
        <Tab
          value="status"
          label={t('system.tabs.status')}
        />
        {features.ota && (
          <Tab
            value="ota"
            label={t('system.tabs.ota')}
            disabled={!me.admin}
          />
        )}
        {features.upload_firmware && (
          <Tab
            value="upload"
            label={t('system.tabs.upload')}
            disabled={!me.admin}
          />
        )}
        {features.upload_filesystem && (
          <Tab value="uploadfs" label={t('system.tabs.uploadfs')} disabled={!me.admin} />
        )}
        <Tab value="filemgr" label={t('system.tabs.filemgr')} disabled={!me.admin} />
        {features.use_language && (
          <Tab value="language" label={t('system.tabs.language')} disabled={!me.admin} />
        )}
      </RouterTabs>

      <Routes>
        <Route path="status" element={<SystemStatusForm />} />
        <Route path="filemgr" element={<FileManager />} />
        <Route path="language" element={<LanguageSettingsForm />} />
        {features.ota && (
          <Route
            path="ota"
            element={
              <RequireAdmin>
                <OTASettingsForm />
              </RequireAdmin>
            }
          />
        )}

        {features.upload_filesystem && (
          <Route
            path="uploadfs"
            element={
              <RequireAdmin>
                <UploadFSForm />
              </RequireAdmin>
            }
          />
        )}
        {features.upload_firmware && (
          <Route
            path="upload"
            element={
              <RequireAdmin>
                <UploadFirmwareForm />
              </RequireAdmin>
            }
          />
        )}
        <Route path="/*" element={<Navigate replace to="status" />} />
      </Routes>
    </>
  );
};

export default System;
