import { useEffect, FC, useState, useCallback, useRef } from 'react';
import { useSnackbar } from 'notistack';

import { Button, } from '@mui/material';
import PermScanWifiIcon from '@mui/icons-material/PermScanWifi';

import * as WiFiApi from "../../api/wifi";
import { WiFiNetwork, WiFiNetworkList } from '../../types';
import { ButtonRow, FormLoader, SectionContent } from '../../components';
import { extractErrorMessage } from '../../utils';

import WiFiNetworkSelector from './WiFiNetworkSelector';
import useInterval from '../../utils/useInterval';
import { useTranslation } from "react-i18next"; // 1. Importar hook

const NUM_POLLS = 24;
const POLLING_FREQUENCY = 500;

const compareNetworks = (network1: WiFiNetwork, network2: WiFiNetwork) => {
  if (network1.rssi < network2.rssi) {
    return 1;
  }
  if (network1.rssi > network2.rssi) {
    return -1;
  }
  return 0;
};

const WiFiNetworkScanner: FC = () => {
  const { t } = useTranslation(); // 2. Inicializar traductor
  const { enqueueSnackbar } = useSnackbar();

  const pollCount = useRef(0);
  const [networkList, setNetworkList] = useState<WiFiNetworkList>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [pollingDelay, setPollingDelay] = useState<number | undefined>(undefined);

  const stopPolling = useCallback(() => {
    setPollingDelay(undefined);
    pollCount.current = 0;
  }, []);

  const finishedWithError = useCallback((message: string) => {
    enqueueSnackbar(message, { variant: 'error' });
    setNetworkList(undefined);
    setErrorMessage(message);
    stopPolling();
  }, [enqueueSnackbar, stopPolling]);

  const pollNetworkList = useCallback(async () => {
    try {
      const response = await WiFiApi.listNetworks();
      if (response.status === 202) {
        pollCount.current += 1;
        if (pollCount.current >= NUM_POLLS) {
          finishedWithError(t('wifi.scanner.timeout_error'));
        }
      } else {
        const newNetworkList = response.data;
        newNetworkList.networks.sort(compareNetworks);
        setNetworkList(newNetworkList);
        stopPolling();
      }
    } catch (error: any) {
      // Si la radio está saltando canales en ese instante, reintentar hasta agotar NUM_POLLS
      pollCount.current += 1;
      if (pollCount.current >= NUM_POLLS) {
        finishedWithError(extractErrorMessage(error, t('wifi.scanner.list_error')));
      }
    }
  }, [finishedWithError, stopPolling, t]);

  useInterval(pollNetworkList, pollingDelay);

  const startNetworkScan = useCallback(async () => {
    setNetworkList(undefined);
    setErrorMessage(undefined);
    pollCount.current = 0;

    try {
      await WiFiApi.scanNetworks();
      setPollingDelay(POLLING_FREQUENCY);
    } catch (_error: any) {
      // Si la petición inicial tuvo un hipo transitorio de radio, iniciar sondeo igualmente
      setPollingDelay(POLLING_FREQUENCY);
    }
  }, []);

  useEffect(() => {
    startNetworkScan();
  }, [startNetworkScan]);

  const renderNetworkScanner = () => {
    if (!networkList) {
      // 6. Traducción del mensaje de carga (escaneando...)
      return (<FormLoader message={t('wifi.scanner.scanning')} errorMessage={errorMessage} />);
    }
    return (
      <WiFiNetworkSelector networkList={networkList} />
    );
  };

  return (
    <SectionContent title={t('wifi.scanner.title')}>
      {renderNetworkScanner()}
      <ButtonRow pt={1}>
        <Button
          startIcon={<PermScanWifiIcon />}
          variant="contained"
          color="secondary"
          onClick={startNetworkScan}
          disabled={!errorMessage && !networkList}
        >
          {/* 7. Traducción del botón */}
          {t('wifi.scanner.scan_again')}
        </Button>
      </ButtonRow>
    </SectionContent>
  );

};

export default WiFiNetworkScanner;
