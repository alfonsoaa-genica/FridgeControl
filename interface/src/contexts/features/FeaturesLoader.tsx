import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as FeaturesApi from '../../api/features';

import { extractErrorMessage, RequiredChildrenProps } from '../../utils';
import { Features } from '../../types';
import {ApplicationError, LoadingSpinner} from '../../components';

import { FeaturesContext } from '.';

const FeaturesLoader: FC<RequiredChildrenProps> = (props) => {
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [features, setFeatures] = useState<Features>();

  const loadFeatures = useCallback(async () => {
    try {
      const response = await FeaturesApi.readFeatures();
      setFeatures(response.data);
    } catch (error: any) {
      setErrorMessage(extractErrorMessage(error, t('system.features.fetch_failed')));
    }
  }, [t]);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  if (features) {
    return (
      <FeaturesContext.Provider
        value={{
          features
        }}
      >
        {props.children}
      </FeaturesContext.Provider>
    );
  }

  if (errorMessage) {
    return (
      <ApplicationError message={errorMessage} />
    );
  }

  return (
    <LoadingSpinner height="100vh" />
  );

};

export default FeaturesLoader;
