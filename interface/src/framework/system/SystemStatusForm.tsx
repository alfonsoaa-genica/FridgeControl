import { FC, useContext, useState } from "react";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";

import {
  Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, List, ListItem, ListItemAvatar, ListItemText
} from "@mui/material";
import DevicesIcon from '@mui/icons-material/Devices';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import MemoryIcon from '@mui/icons-material/Memory';
import AppsIcon from '@mui/icons-material/Apps';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import FolderIcon from '@mui/icons-material/Folder';
import RefreshIcon from '@mui/icons-material/Refresh';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';

import * as SystemApi from "../../api/system";
import { EspPlatform, SystemStatus } from "../../types";
import { ButtonRow, FormLoader, SectionContent } from "../../components";
import { extractErrorMessage, useRest } from "../../utils";
import { AuthenticatedContext } from "../../contexts/authentication";

const SystemStatusForm: FC = () => {
  const { t, i18n } = useTranslation();
  const { loadData, data, errorMessage } = useRest<SystemStatus>({ read: SystemApi.readSystemStatus });

  const { me } = useContext(AuthenticatedContext);
  const [confirmRestart, setConfirmRestart] = useState<boolean>(false);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();

  // Formateador de números basado en el idioma actual
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(i18n.language).format(num);
  };

  const restart = async () => {
    setProcessing(true);
    try {
      await SystemApi.restart();
      enqueueSnackbar(t('system.messages.restarting'), { variant: 'info' });
    } catch (error: any) {
      enqueueSnackbar(extractErrorMessage(error, t('system.errors.restart_failed')), { variant: 'error' });
    } finally {
      setConfirmRestart(false);
      setProcessing(false);
    }
  };

  const factoryReset = async () => {
    setProcessing(true);
    try {
      await SystemApi.factoryReset();
      enqueueSnackbar(t('system.messages.factory_reset_done'), { variant: 'info' });
    } catch (error: any) {
      enqueueSnackbar(extractErrorMessage(error, t('system.errors.factory_reset_failed')), { variant: 'error' });
    } finally {
      setConfirmFactoryReset(false);
      setProcessing(false);
    }
  };

  const renderRestartDialog = () => (
    <Dialog open={confirmRestart} onClose={() => setConfirmRestart(false)}>
      <DialogTitle>{t('system.dialogs.restart_title')}</DialogTitle>
      <DialogContent dividers>
        {t('system.dialogs.restart_content')}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => setConfirmRestart(false)} color="secondary">
          {t('common.CANCEL')}
        </Button>
        <Button
          startIcon={<PowerSettingsNewIcon />}
          variant="contained"
          onClick={restart}
          disabled={processing}
          color="primary"
          autoFocus
        >
          {t('system.actions.restart')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderFactoryResetDialog = () => (
    <Dialog open={confirmFactoryReset} onClose={() => setConfirmFactoryReset(false)}>
      <DialogTitle>{t('system.dialogs.factory_reset_title')}</DialogTitle>
      <DialogContent dividers>
        {t('system.dialogs.factory_reset_content')}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => setConfirmFactoryReset(false)} color="secondary">
          {t('common.CANCEL')}
        </Button>
        <Button
          startIcon={<SettingsBackupRestoreIcon />}
          variant="contained"
          onClick={factoryReset}
          disabled={processing}
          autoFocus
          color="error"
        >
          {t('system.actions.factory_reset')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }
    // Extraemos la lógica aquí para que el JSX quede limpio y cumpla con 'max-len'
    const heapInfo = `${formatNumber(data.free_heap)} / ${formatNumber(data.max_alloc_heap)} bytes`;
    const fragmentationInfo = data.esp_platform === EspPlatform.ESP8266
      ? ` (${data.heap_fragmentation}% ${t('system.status_fields.fragmentation')})`
      : '';
    return (
      <>
        <List>
          <ListItem>
            <ListItemAvatar>
              <Avatar><DevicesIcon /></Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('system.status_fields.device')}
              secondary={`${data.esp_platform} / ${data.sdk_version}`}
            />
          </ListItem>
          <Divider variant="inset" component="li" />

          <ListItem>
            <ListItemAvatar>
              <Avatar><ShowChartIcon /></Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('system.status_fields.cpu_freq')}
              secondary={`${data.cpu_freq_mhz} MHz`}
            />
          </ListItem>
          <Divider variant="inset" component="li" />

          <ListItem>
            <ListItemAvatar>
              <Avatar><MemoryIcon /></Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('system.status_fields.heap')}
              secondary={`${heapInfo}${fragmentationInfo}`}
            />
          </ListItem>
          {data.esp_platform === EspPlatform.ESP32 && data.psram_size > 0 && (
            <>
              <Divider variant="inset" component="li" />
              <ListItem>
                <ListItemAvatar>
                  <Avatar><AppsIcon /></Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={t('system.status_fields.psram')}
                  secondary={`${formatNumber(data.psram_size)} / ${formatNumber(data.free_psram)} bytes`}
                />
              </ListItem>
            </>
          )}

          <Divider variant="inset" component="li" />
          <ListItem>
            <ListItemAvatar>
              <Avatar><DataUsageIcon /></Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('system.status_fields.sketch')}
              secondary={`${formatNumber(data.sketch_size)} / ${formatNumber(data.free_sketch_space)} bytes`}
            />
          </ListItem>

          <Divider variant="inset" component="li" />
          <ListItem>
            <ListItemAvatar>
              <Avatar><SdStorageIcon /></Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('system.status_fields.flash_chip')}
              secondary={`${formatNumber(data.flash_chip_size)} bytes / ${(data.flash_chip_speed / 1000000).toFixed(0)} MHz`}
            />
          </ListItem>

          <Divider variant="inset" component="li" />
          <ListItem>
            <ListItemAvatar>
              <Avatar><FolderIcon /></Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={t('system.status_fields.fs')}
              secondary={
                `${formatNumber(data.fs_used)} / ${formatNumber(data.fs_total)} bytes ` +
                `(${formatNumber(data.fs_total - data.fs_used)} ${t('system.status_fields.free')})`
              }
            />
          </ListItem>
          <Divider variant="inset" component="li" />
        </List>

        <Box display="flex" flexWrap="wrap">
          <Box flexGrow={1}>
            <ButtonRow mt={1}>
              <Button startIcon={<RefreshIcon />} variant="contained" color="secondary" onClick={loadData}>
                {t('common.REFRESH')}
              </Button>
            </ButtonRow>
          </Box>
          {me.admin && (
            <Box flexWrap="nowrap" whiteSpace="nowrap">
              <ButtonRow mt={1}>
                <Button startIcon={<PowerSettingsNewIcon />} variant="contained" color="primary" onClick={() => setConfirmRestart(true)}>
                  {t('system.actions.restart')}
                </Button>
                <Button
                  startIcon={<SettingsBackupRestoreIcon />}
                  variant="contained"
                  onClick={() => setConfirmFactoryReset(true)}
                  color="error"
                >
                  {t('system.actions.factory_reset')}
                </Button>
              </ButtonRow>
            </Box>
          )}
        </Box>
        {renderRestartDialog()}
        {renderFactoryResetDialog()}
      </>
    );
  };

  return (
    <SectionContent title={t('system.tabs.status')} titleGutter>
      {content()}
    </SectionContent>
  );
};

export default SystemStatusForm;
