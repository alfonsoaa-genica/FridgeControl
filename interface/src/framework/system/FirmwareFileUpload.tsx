import { AxiosPromise } from 'axios';
import { FC } from 'react';
import { useTranslation } from "react-i18next";

import { FileUploadConfig } from '../../api/endpoints';
import { MessageBox, SingleUpload, useFileUpload } from '../../components';

interface UploadFirmwareProps {
  uploadFirmware: ((file: File, config?: FileUploadConfig) => AxiosPromise<void>);
}

const FirmwareFileUpload: FC<UploadFirmwareProps> = ({ uploadFirmware }) => {
  const { t } = useTranslation();
  const [uploadFile, cancelUpload, uploading, uploadProgress] = useFileUpload({ upload: uploadFirmware });

  return (
    <>
      <MessageBox
        message={t('system.upload.warning')}
        level="warning"
        my={2}
      />
      <SingleUpload
        accept={{
          'application/octet-stream': ['.bin']
        }}
        onDrop={uploadFile}
        onCancel={cancelUpload}
        uploading={uploading}
        progress={uploadProgress}
        // Si el componente SingleUpload soporta etiquetas traducidas, podrías pasarlas aquí
      />
    </>
  );
};

export default FirmwareFileUpload;
