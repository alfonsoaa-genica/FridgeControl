import { FC, useCallback, useState } from 'react';
import { useTranslation } from "react-i18next";

import * as SystemApi from "../../api/system";
import { SectionContent } from '../../components';
import { FileUploadConfig } from '../../api/endpoints';

import FirmwareFileUpload from './FirmwareFileUpload';
import FirmwareRestartMonitor from './FirmwareRestartMonitor';

const UploadFirmwareForm: FC = () => {
  const { t } = useTranslation();
  const [restarting, setRestarting] = useState<boolean>();

  const uploadFirmware = useCallback(async (file: File, config?: FileUploadConfig) => {
    const response = await SystemApi.uploadFirmware(file, config);
    setRestarting(true);
    return response;
  }, []);

  return (
    <SectionContent title={t('system.tabs.upload')} titleGutter>
      {
        restarting ?
          <FirmwareRestartMonitor />
          :
          <FirmwareFileUpload uploadFirmware={uploadFirmware} />
      }
    </SectionContent>
  );
};

export default UploadFirmwareForm;
