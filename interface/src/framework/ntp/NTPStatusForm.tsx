import { FC, useContext, useState } from "react";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";

import {
  Avatar, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Grid, List, ListItem, ListItemAvatar, ListItemText, TextField, Theme, Typography, useTheme
} from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SwapVerticalCircleIcon from '@mui/icons-material/SwapVerticalCircle';
import UpdateIcon from '@mui/icons-material/Update';
import DnsIcon from '@mui/icons-material/Dns';
import AvTimerIcon from '@mui/icons-material/AvTimer';

import * as NTPApi from "../../api/ntp";
import { NTPStatus, NTPSyncStatus } from "../../types";
import { ButtonRow, FormLoader, SectionContent } from "../../components";
import { extractErrorMessage, formatDateTime, formatDuration, formatLocalDateTime, useRest } from "../../utils";
import { AuthenticatedContext } from "../../contexts/authentication";

const isNtpActive = ({ status }: NTPStatus) => status === NTPSyncStatus.NTP_ACTIVE;

const ntpStatusHighlight = ({ status }: NTPStatus, theme: Theme) => {
  switch (status) {
    case NTPSyncStatus.NTP_INACTIVE:
      return theme.palette.info.main;
    case NTPSyncStatus.NTP_ACTIVE:
      return theme.palette.success.main;
    default:
      return theme.palette.error.main;
  }
};

const NTPStatusForm: FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { loadData: loadNtpData, data, errorMessage } = useRest<NTPStatus>({ read: NTPApi.readNTPStatus });
  const [localTime, setLocalTime] = useState<string>('');
  const [settingTime, setSettingTime] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();
  const { me } = useContext(AuthenticatedContext);

  const ntpStatusText = (status: NTPSyncStatus) => {
    switch (status) {
      case NTPSyncStatus.NTP_INACTIVE:
        return t('ntp.status_list.inactive');
      case NTPSyncStatus.NTP_ACTIVE:
        return t('ntp.status_list.active');
      default:
        return t('ntp.status_list.unknown');
    }
  };

  const updateLocalTime = (event: React.ChangeEvent<HTMLInputElement>) => setLocalTime(event.target.value);

  const openSetTime = () => {
    setLocalTime(formatLocalDateTime(new Date()));
    setSettingTime(true);
  };

  const configureTime = async () => {
    setProcessing(true);
    try {
      await NTPApi.updateTime({
        local_time: formatLocalDateTime(new Date(localTime))
      });
      enqueueSnackbar(t('ntp.messages.time_set_success'), { variant: 'success' });
      setSettingTime(false);
      loadNtpData();
    } catch (error: any) {
      enqueueSnackbar(extractErrorMessage(error, t('ntp.messages.time_set_error')), { variant: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const renderSetTimeDialog = () => {
    return (
      <Dialog
        open={settingTime}
        onClose={() => setSettingTime(false)}
      >
        <DialogTitle>{t('ntp.dialog.title')}</DialogTitle>
        <DialogContent dividers>
          <Box mb={2}>{t('ntp.dialog.description')}</Box>
          <TextField
            label={t('ntp.fields.local_time')}
            type="datetime-local"
            value={localTime}
            onChange={updateLocalTime}
            disabled={processing}
            variant="outlined"
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSettingTime(false)} color="secondary">
            {t('common.CANCEL')}
          </Button>
          <Button
            startIcon={<AccessTimeIcon />}
            variant="contained"
            onClick={configureTime}
            disabled={processing}
            color="primary"
            autoFocus
          >
            {t('ntp.dialog.submit')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadNtpData} errorMessage={errorMessage} />);
    }

    return (
      <>
        <Grid container spacing={3}>
          {/* Tarjeta de Estado del Cliente NTP del Sistema */}
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                  <UpdateIcon color="primary" /> {t('ntp.status_title')}
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: ntpStatusHighlight(data, theme) }}>
                        <UpdateIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={t('ntp.status')} secondary={ntpStatusText(data.status)} />
                  </ListItem>
                  <Divider variant="inset" component="li" />
                  {isNtpActive(data) && (
                    <>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar>
                            <DnsIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={t('ntp.fields.server')} secondary={data.server} />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </>
                  )}

                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <AccessTimeIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={t('ntp.fields.local_time')} secondary={formatDateTime(data.local_time)} />
                  </ListItem>
                  <Divider variant="inset" component="li" />

                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <SwapVerticalCircleIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={t('ntp.fields.utc_time')} secondary={formatDateTime(data.utc_time)} />
                  </ListItem>
                  <Divider variant="inset" component="li" />

                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <AvTimerIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={t('ntp.fields.uptime')} secondary={formatDuration(data.uptime)} />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box display="flex" flexWrap="wrap" gap={1} mt={3}>
          <Box flexGrow={1} display="flex" gap={1} flexWrap="wrap">
            <ButtonRow mt={1}>
              <Button startIcon={<RefreshIcon />} variant="contained" color="secondary" onClick={loadNtpData}>
                {t('common.REFRESH')}
              </Button>
            </ButtonRow>
          </Box>
          {
            me.admin && data && !isNtpActive(data) && (
              <Box flexWrap="nowrap" whiteSpace="nowrap">
                <ButtonRow mt={1}>
                  <Button onClick={openSetTime} variant="contained" color="primary" startIcon={<AccessTimeIcon />}>
                    {t('ntp.dialog.submit')}
                  </Button>
                </ButtonRow>
              </Box>
            )
          }
        </Box>
        {renderSetTimeDialog()}
      </>
    );
  };

  return (
    <SectionContent title={t('ntp.status_title')} titleGutter>
      {content()}
    </SectionContent>
  );
};

export default NTPStatusForm;
