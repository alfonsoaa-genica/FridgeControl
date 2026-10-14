import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as SystemApi from "../../api/system";
import { SectionContent, MessageBox, SingleUpload, useFileUpload } from '../../components';
import { FileUploadConfig } from '../../api/endpoints';

import FirmwareRestartMonitor from './FirmwareRestartMonitor';

const UploadFSForm: FC = () => {
  const { t } = useTranslation();
  const [restarting, setRestarting] = useState<boolean>(false);

  const uploadFS = useCallback(async (file: File, config?: FileUploadConfig) => {
    const response = await SystemApi.uploadFS(file, config);
    setRestarting(true);
    return response;
  }, []);

  const [uploadFile, cancelUpload, uploading, uploadProgress] = useFileUpload({ upload: uploadFS });

  return (
    <SectionContent title={t('system.tabs.uploadfs')} titleGutter>
      {restarting ? (
        <FirmwareRestartMonitor />
      ) : (
        <>
          <MessageBox
            message={t('system.uploadfs.warning')}
            level="warning"
            my={2}
          />
          <SingleUpload
            accept={{ 'application/octet-stream': ['.bin'] }}
            onDrop={uploadFile}
            onCancel={cancelUpload}
            uploading={uploading}
            progress={uploadProgress}
          />
        </>
      )}
    </SectionContent>
  );
};

export default UploadFSForm;
