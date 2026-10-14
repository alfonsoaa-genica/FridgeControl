import React, { useEffect, useState, useCallback, useContext } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Tooltip,
  CircularProgress,
  Divider,
  Alert,
  Stack,
  useTheme,
  useMediaQuery,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  SelectChangeEvent,
} from '@mui/material';
import {
  AcUnit as CoolIcon,
  Air as FanIcon,
  Whatshot as DefrostIcon,
  WaterDrop as HumidIcon,
  Fullscreen as FocusIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  CheckCircle as OkIcon,
  Warning as AlertIcon,
  WifiOff as OfflineIcon,
  ShowChart as ChartIcon,
  Tune as AlarmTuneIcon,
  MeetingRoom as DoorOpenIcon,
  Thermostat as TempAlarmIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { fetchCavas, fetchCavaHistory, setCavaSetpoint, updateCavaAlarmConfig, updateCavaMeta } from './api/cavas';
import { CavaState, TrendPoint } from './types/cavas';
import useInterval from '../utils/useInterval';
import { useLayoutTitle } from '../components/layout/context';
import { AuthenticatedContext } from '../contexts/authentication';

export const CavasDashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  useLayoutTitle(t('cavas.liveView', 'Cavas en Vivo'));

  const authenticatedContext = useContext(AuthenticatedContext);
  const isAdmin = authenticatedContext?.me?.admin ?? false;

  const [cavas, setCavas] = useState<CavaState[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCava, setSelectedCava] = useState<CavaState | null>(null);
  const [history, setHistory] = useState<TrendPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Modal para cambio de consigna
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [targetVar, setTargetVar] = useState<'temp' | 'hr'>('temp');
  const [newSetpoint, setNewSetpoint] = useState<string>('5.0');
  const [adminPin, setAdminPin] = useState<string>('');
  const [spError, setSpError] = useState<string>('');
  const [spSuccess, setSpSuccess] = useState<string>('');
  const [savingSp, setSavingSp] = useState<boolean>(false);

  // Modal para configuración de alarmas y tiempos ISA-18.2
  const [alarmDialogOpen, setAlarmDialogOpen] = useState<boolean>(false);
  const [alarmCava, setAlarmCava] = useState<CavaState | null>(null);
  const [doorGraceSec, setDoorGraceSec] = useState<number>(90);
  const [doorBuzzerSec, setDoorBuzzerSec] = useState<number>(180);
  const [ackGraceMin, setAckGraceMin] = useState<number>(10);
  const [tempAlarmDelta, setTempAlarmDelta] = useState<number>(2.5);
  const [tempAlarmDelaySec, setTempAlarmDelaySec] = useState<number>(300);
  const [savingAlarm, setSavingAlarm] = useState<boolean>(false);
  const [alarmMsg, setAlarmMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal de edición rápida de metadatos de cava
  const [editMetaCava, setEditMetaCava] = useState<CavaState | null>(null);
  const [editMetaOpen, setEditMetaOpen] = useState<boolean>(false);
  const [editMetaId, setEditMetaId] = useState<string>('');
  const [editMetaDesc, setEditMetaDesc] = useState<string>('');
  const [editMetaTipo, setEditMetaTipo] = useState<'conservacion' | 'maduracion'>('conservacion');
  const [editMetaHumidity, setEditMetaHumidity] = useState<boolean>(false);
  const [savingMeta, setSavingMeta] = useState<boolean>(false);
  const [metaMsg, setMetaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleOpenEditMeta = (cava: CavaState) => {
    setEditMetaCava(cava);
    setEditMetaId(cava.id);
    setEditMetaDesc(cava.descripcion || '');
    setEditMetaTipo(cava.tipo);
    setEditMetaHumidity(cava.has_humidity);
    setMetaMsg(null);
    setEditMetaOpen(true);
  };

  const handleSaveEditMeta = async () => {
    if (!editMetaCava) return;
    setSavingMeta(true);
    setMetaMsg(null);
    try {
      await updateCavaMeta(editMetaCava.id, {
        new_id: editMetaId,
        descripcion: editMetaDesc,
        tipo: editMetaTipo,
        has_humidity: editMetaHumidity,
      });
      setMetaMsg({ type: 'success', text: 'Datos de la cava actualizados exitosamente.' });
      setTimeout(() => {
        setEditMetaOpen(false);
        loadCavas();
      }, 1000);
    } catch (e: any) {
      setMetaMsg({ type: 'error', text: e.response?.data?.error || 'Error al guardar metadatos' });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleOpenAlarmSettings = (cava: CavaState) => {
    setAlarmCava(cava);
    setDoorGraceSec(cava.door_grace_sec || 90);
    setDoorBuzzerSec(cava.door_buzzer_sec || 180);
    setAckGraceMin(Math.round((cava.ack_grace_sec || 600) / 60));
    setTempAlarmDelta(cava.temp_alarm_delta || 2.5);
    setTempAlarmDelaySec(cava.temp_alarm_delay_sec || 300);
    setAlarmMsg(null);
    setAlarmDialogOpen(true);
  };

  const handleSaveAlarmSettings = async () => {
    if (!alarmCava) return;
    setSavingAlarm(true);
    setAlarmMsg(null);
    try {
      await updateCavaAlarmConfig(alarmCava.id, {
        door_grace_sec: doorGraceSec,
        door_buzzer_sec: doorBuzzerSec,
        ack_grace_sec: ackGraceMin * 60,
        temp_alarm_delta: tempAlarmDelta,
        temp_alarm_delay_sec: tempAlarmDelaySec,
      });
      setAlarmMsg({ type: 'success', text: 'Parámetros ISA-18.2 guardados exitosamente.' });
      setTimeout(() => {
        setAlarmDialogOpen(false);
        loadCavas();
      }, 1200);
    } catch (e: any) {
      setAlarmMsg({ type: 'error', text: e.response?.data?.error || e.message || 'Error guardando parámetros' });
    } finally {
      setSavingAlarm(false);
    }
  };

  // Muestra la descripción personalizada configurada por el usuario
  const getCavaDescription = (cava: CavaState) => {
    return cava.descripcion || `${cava.id} - ${cava.tipo === 'maduracion' ? 'Maduración' : 'Conservación'}`;
  };

  const loadCavas = useCallback(async () => {
    try {
      const data = await fetchCavas();
      setCavas(data);
      if (selectedCava) {
        const updated = data.find((c) => c.id === selectedCava.id);
        if (updated) setSelectedCava(updated);
      }
    } catch (e) {
      console.error('Error fetching cavas:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCava]);

  useEffect(() => {
    loadCavas();
  }, []);

  // Actualización periódica REST (cada 4s) como respaldo
  useInterval(() => {
    loadCavas();
  }, 4000);

  // Escuchar WebSocket en tiempo real
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'CAVAS_UPDATE' && Array.isArray(data.cavas)) {
            setCavas((prev) =>
              prev.map((c) => {
                const u = data.cavas.find((item: any) => item.id === c.id);
                if (!u) return c;
                return {
                  ...c,
                  temp_pv: parseFloat(u.temp ?? c.temp_pv),
                  temp_sp: parseFloat(u.sp ?? c.temp_sp),
                  hr_pv: u.hr !== undefined ? parseFloat(u.hr) : c.hr_pv,
                  hr_sp: u.hr_sp !== undefined ? parseFloat(u.hr_sp) : c.hr_sp,
                  cooling_active: !!u.cooling,
                  fan_active: !!u.fan,
                  defrost_active: !!u.defrost,
                  heating_active: !!u.heat,
                  humid_active: !!u.humid,
                  exhaust_active: !!u.exhaust,
                  alarm_active: !!u.alarm,
                  online: !!u.online,
                };
              })
            );
          }
        } catch (err) {
          console.debug('WS parse error', err);
        }
      };
    } catch (err) {
      console.debug('WS init error', err);
    }
    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleOpenFocus = async (cava: CavaState) => {
    setSelectedCava(cava);
    setLoadingHistory(true);
    try {
      const pts = await fetchCavaHistory(cava.id);
      setHistory(pts);
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenEditSp = (variable: 'temp' | 'hr') => {
    if (!selectedCava) return;
    setTargetVar(variable);
    setNewSetpoint(
      variable === 'temp'
        ? selectedCava.temp_sp.toFixed(1)
        : (selectedCava.hr_sp || 85.0).toFixed(1)
    );
    setAdminPin('');
    setSpError('');
    setSpSuccess('');
    setEditDialogOpen(true);
  };

  const handleSaveSetpoint = async () => {
    if (!selectedCava) return;
    const val = parseFloat(newSetpoint);
    if (isNaN(val)) {
      setSpError(t('cavas.invalidNumeric'));
      return;
    }
    setSavingSp(true);
    setSpError('');
    setSpSuccess('');
    try {
      const res = await setCavaSetpoint(selectedCava.id, targetVar, val, adminPin);
      if (res.success) {
        setSpSuccess(t('cavas.setpointQueued'));
        setTimeout(() => {
          setEditDialogOpen(false);
          loadCavas();
        }, 1200);
      } else {
        setSpError(res.message || t('cavas.setpointError'));
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || t('cavas.commError');
      setSpError(msg);
    } finally {
      setSavingSp(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      {/* Encabezado Superior */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary">
            {t('cavas.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('cavas.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            icon={<OkIcon />}
            label={`${cavas.filter((c) => c.online && !c.alarm_active).length} ${t('cavas.normal')}`}
            color="success"
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<AlertIcon />}
            label={`${cavas.filter((c) => c.alarm_active).length} ${t('cavas.alarm')}`}
            color="error"
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<OfflineIcon />}
            label={`${cavas.filter((c) => !c.online).length} ${t('cavas.offline')}`}
            color="default"
            size="small"
            variant="outlined"
          />
          <IconButton onClick={loadCavas} size="small" color="primary">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      {/* Grid de Cavas */}
      {loading && cavas.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : cavas.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('cavas.noCavasFound')}
        </Alert>
      ) : (
        <Grid container spacing={2.5}>
          {cavas.map((cava) => {
            const isAlarm = cava.alarm_active;
            const isOffline = !cava.online;

            let cardBorder = theme.palette.divider;
            let statusColor: 'success' | 'error' | 'warning' | 'default' = 'success';
            let statusText = t('cavas.normal');

            if (isOffline) {
              statusColor = 'default';
              statusText = t('cavas.noCommunication');
              cardBorder = theme.palette.action.disabledBackground;
            } else if (isAlarm) {
              statusColor = 'error';
              statusText = cava.alarm_temp_high
                ? t('cavas.alarmTempHigh')
                : cava.alarm_hr_low
                ? t('cavas.alarmHrLow')
                : t('cavas.alarmHrHigh');
              cardBorder = theme.palette.error.main;
            }

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cava.id}>
                <Card
                  sx={{
                    borderRadius: 2.5,
                    border: `1.5px solid ${cardBorder}`,
                    boxShadow: isAlarm
                      ? '0 4px 20px rgba(211, 47, 47, 0.25)'
                      : '0 2px 8px rgba(0,0,0,0.06)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    {/* Header de Tarjeta */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="h6" fontWeight={800}>
                            {cava.id}
                          </Typography>
                          <Chip
                            label={`ID ${cava.modbus_id}`}
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 190 }}>
                          {getCavaDescription(cava)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip
                          label={statusText}
                          color={statusColor}
                          size="small"
                          sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                        />
                        {isAdmin && (
                          <>
                            <Tooltip title="Tiempos y Alarmas ISA-18.2">
                              <IconButton size="small" color="primary" onClick={() => handleOpenAlarmSettings(cava)}>
                                <AlarmTuneIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Editar Cava (Nombre y Tipo)">
                              <IconButton size="small" color="secondary" onClick={() => handleOpenEditMeta(cava)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title={t('cavas.focusMode')}>
                          <IconButton size="small" onClick={() => handleOpenFocus(cava)}>
                            <FocusIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />

                    {/* Mediciones Principales */}
                    <Grid container spacing={1}>
                      {/* Temperatura */}
                      <Grid size={{ xs: cava.has_humidity ? 6 : 12 }}>
                        <Box
                          sx={{
                            p: 1.2,
                            borderRadius: 1.5,
                            bgcolor: isOffline
                              ? 'action.hover'
                              : isAlarm && cava.alarm_temp_high
                              ? 'error.light'
                              : 'primary.light',
                            color: isOffline
                              ? 'text.secondary'
                              : isAlarm && cava.alarm_temp_high
                              ? 'error.contrastText'
                              : 'primary.contrastText',
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
                            {t('cavas.temperature')}
                          </Typography>
                          <Typography variant="h4" fontWeight={900} sx={{ my: 0.2 }}>
                            {isOffline ? '--' : cava.temp_pv.toFixed(1)}°C
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.9 }}>
                            {t('cavas.setpointShort')}: {cava.temp_sp.toFixed(1)}°C
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Humedad */}
                      {cava.has_humidity && (
                        <Grid size={{ xs: 6 }}>
                          <Box
                            sx={{
                              p: 1.2,
                              borderRadius: 1.5,
                              bgcolor: isOffline
                                ? 'action.hover'
                                : cava.alarm_hr_low || cava.alarm_hr_high
                                ? 'error.light'
                                : 'info.light',
                              color: isOffline
                                ? 'text.secondary'
                                : cava.alarm_hr_low || cava.alarm_hr_high
                                ? 'error.contrastText'
                                : 'info.contrastText',
                              textAlign: 'center',
                            }}
                          >
                            <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
                              {t('cavas.activeHumidity')}
                            </Typography>
                            <Typography variant="h4" fontWeight={900} sx={{ my: 0.2 }}>
                              {isOffline || cava.hr_pv === null ? '--' : cava.hr_pv.toFixed(1)}%
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.9 }}>
                              {t('cavas.setpointShort')}: {(cava.hr_sp || 85.0).toFixed(1)}%
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>

                    {/* Estados de Relé */}
                    <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
                      <Tooltip title={`${t('cavas.cooling')}: ${cava.cooling_active ? t('cavas.active') : t('cavas.inactive')}`}>
                        <Chip
                          icon={<CoolIcon />}
                          label={t('cavas.cooling')}
                          size="small"
                          color={cava.cooling_active ? 'info' : 'default'}
                          variant={cava.cooling_active ? 'filled' : 'outlined'}
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Tooltip>
                      <Tooltip title={`${t('cavas.fan')}: ${cava.fan_active ? t('cavas.active') : t('cavas.inactive')}`}>
                        <Chip
                          icon={<FanIcon />}
                          label={t('cavas.fan')}
                          size="small"
                          color={cava.fan_active ? 'primary' : 'default'}
                          variant={cava.fan_active ? 'filled' : 'outlined'}
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Tooltip>
                      <Tooltip title={`${t('cavas.defrost')}: ${cava.defrost_active ? t('cavas.active') : t('cavas.inactive')}`}>
                        <Chip
                          icon={<DefrostIcon />}
                          label={t('cavas.defrost')}
                          size="small"
                          color={cava.defrost_active ? 'warning' : 'default'}
                          variant={cava.defrost_active ? 'filled' : 'outlined'}
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Tooltip>
                      {cava.has_humidity && (
                        <Tooltip title={`${t('cavas.steam')}: ${cava.humid_active ? t('cavas.active') : t('cavas.inactive')}`}>
                          <Chip
                            icon={<HumidIcon />}
                            label={t('cavas.steam')}
                            size="small"
                            color={cava.humid_active ? 'secondary' : 'default'}
                            variant={cava.humid_active ? 'filled' : 'outlined'}
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </Tooltip>
                      )}
                    </Stack>

                    {/* Footer Diagnóstico Rápido */}
                    <Box sx={{ mt: 1.2, textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        {t('cavas.rs485Link', { percent: cava.quality_percent.toFixed(0), temp: cava.temp_evap.toFixed(1) })}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* DIÁLOGO FOCUS MODE PARA PANTALLAS MÓVILES (6") */}
      <Dialog
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
        open={!!selectedCava}
        onClose={() => setSelectedCava(null)}
      >
        {selectedCava && (
          <>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h5" fontWeight={800}>
                  {selectedCava.id} — {getCavaDescription(selectedCava)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('cavas.slaveModbus', { id: selectedCava.modbus_id, type: selectedCava.tipo.toUpperCase() })}
                </Typography>
              </Box>
              <IconButton onClick={() => setSelectedCava(null)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
              <Grid container spacing={2}>
                {/* Visualizador Grande de Temperatura */}
                <Grid size={{ xs: 12, sm: selectedCava.has_humidity ? 6 : 12 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="overline" color="text.secondary" fontWeight={700}>
                      {t('cavas.currentTemp')}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: '3.5rem', sm: '4.8rem' },
                        fontWeight: 900,
                        lineHeight: 1.1,
                        color: selectedCava.alarm_temp_high ? 'error.main' : 'primary.main',
                      }}
                    >
                      {selectedCava.online ? selectedCava.temp_pv.toFixed(1) : '--'}
                      <Typography component="span" sx={{ fontSize: '2rem' }}>°C</Typography>
                    </Typography>
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                      <Typography variant="body1">
                        {t('cavas.setpoint')}: <b>{selectedCava.temp_sp.toFixed(1)}°C</b>
                      </Typography>
                      {isAdmin ? (
                        <Button size="small" startIcon={<EditIcon />} variant="outlined" onClick={() => handleOpenEditSp('temp')}>
                          {t('cavas.adjust')}
                        </Button>
                      ) : (
                        <Chip size="small" label="Solo Lectura" variant="outlined" sx={{ fontSize: '0.7rem', height: 22, opacity: 0.8 }} />
                      )}
                    </Stack>
                  </Paper>
                </Grid>

                {/* Visualizador Grande de Humedad (si aplica) */}
                {selectedCava.has_humidity && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="overline" color="text.secondary" fontWeight={700}>
                        {t('cavas.relativeHumidity')}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: { xs: '3.5rem', sm: '4.8rem' },
                          fontWeight: 900,
                          lineHeight: 1.1,
                          color: selectedCava.alarm_hr_low || selectedCava.alarm_hr_high ? 'error.main' : 'info.main',
                        }}
                      >
                        {selectedCava.online && selectedCava.hr_pv !== null ? selectedCava.hr_pv.toFixed(1) : '--'}
                        <Typography component="span" sx={{ fontSize: '2rem' }}>%</Typography>
                      </Typography>
                      <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                        <Typography variant="body1">
                          {t('cavas.setpoint')}: <b>{(selectedCava.hr_sp || 85.0).toFixed(1)}%</b>
                        </Typography>
                        {isAdmin ? (
                          <Button size="small" startIcon={<EditIcon />} variant="outlined" onClick={() => handleOpenEditSp('hr')}>
                            {t('cavas.adjust')}
                          </Button>
                        ) : (
                          <Chip size="small" label="Solo Lectura" variant="outlined" sx={{ fontSize: '0.7rem', height: 22, opacity: 0.8 }} />
                        )}
                      </Stack>
                    </Paper>
                  </Grid>
                )}
              </Grid>

              {/* Gráfica de Tendencia Térmica 24h */}
              <Box sx={{ mt: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <ChartIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t('cavas.thermalTrend')}
                  </Typography>
                </Stack>
                {loadingHistory ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : history.length === 0 ? (
                  <Alert severity="info" variant="outlined">
                    {t('cavas.accumulatingSamples')}
                  </Alert>
                ) : (() => {
                  const showHumidity = selectedCava.has_humidity && selectedCava.tipo === 'maduracion';
                  const temps = history.map((p) => p.tp).filter((v) => typeof v === 'number');
                  const minT = temps.length > 0 ? Math.floor(Math.min(...temps, (selectedCava.temp_sp ?? 5) - 2)) : 0;
                  const maxT = temps.length > 0 ? Math.ceil(Math.max(...temps, (selectedCava.temp_sp ?? 5) + 2)) : 10;
                  const rangeT = Math.max(1, maxT - minT);

                  const hrs = history.map((p) => p.hr).filter((h): h is number => typeof h === 'number');
                  const minH = hrs.length > 0 ? Math.floor(Math.min(...hrs, (selectedCava.hr_sp ?? 85) - 5)) : 50;
                  const maxH = hrs.length > 0 ? Math.ceil(Math.max(...hrs, (selectedCava.hr_sp ?? 85) + 5)) : 100;
                  const rangeH = Math.max(1, maxH - minH);

                  const tempPoints = history
                    .map((p, idx) => {
                      const x = (idx / Math.max(1, history.length - 1)) * 520 + 40;
                      const y = 125 - ((p.tp - minT) / rangeT) * 105;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');

                  const hrPoints = showHumidity && hrs.length > 0
                    ? history
                        .filter((p) => p.hr !== null && p.hr !== undefined)
                        .map((p, idx, arr) => {
                          const x = (idx / Math.max(1, arr.length - 1)) * 520 + 40;
                          const y = 125 - (((p.hr as number) - minH) / rangeH) * 105;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ')
                    : '';

                  const spTempY = 125 - (((selectedCava.temp_sp ?? 5) - minT) / rangeT) * 105;

                  return (
                    <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                      <svg viewBox="0 0 600 150" style={{ width: '100%', height: 160, display: 'block' }}>
                        {/* Líneas guía de fondo */}
                        <line x1="40" y1="20" x2="560" y2="20" stroke="#e0e0e0" strokeWidth="0.8" />
                        <line x1="40" y1="72" x2="560" y2="72" stroke="#e0e0e0" strokeDasharray="3 3" strokeWidth="0.8" />
                        <line x1="40" y1="125" x2="560" y2="125" stroke="#e0e0e0" strokeWidth="0.8" />

                        {/* Línea de Consigna de Temperatura SP (Ámbar punteada) */}
                        <line x1="40" y1={spTempY} x2="560" y2={spTempY} stroke="#ff9800" strokeDasharray="4 4" strokeWidth="1.2" />

                        {/* Etiquetas Eje Y Izquierdo: Temperatura */}
                        <text x="35" y="24" fill="#1976d2" fontSize="10" textAnchor="end" fontWeight="bold">{maxT}°</text>
                        <text x="35" y="76" fill="#1976d2" fontSize="9" textAnchor="end">{((maxT + minT) / 2).toFixed(1)}°</text>
                        <text x="35" y="128" fill="#1976d2" fontSize="10" textAnchor="end" fontWeight="bold">{minT}°</text>

                        {/* Etiquetas Eje Y Derecho: Humedad Relativa (si aplica) */}
                        {showHumidity && (
                          <>
                            <text x="565" y="24" fill="#00897b" fontSize="10" textAnchor="start" fontWeight="bold">{maxH}%</text>
                            <text x="565" y="76" fill="#00897b" fontSize="9" textAnchor="start">{Math.round((maxH + minH) / 2)}%</text>
                            <text x="565" y="128" fill="#00897b" fontSize="10" textAnchor="start" fontWeight="bold">{minH}%</text>
                          </>
                        )}

                        {/* Curva de Temperatura (Azul) */}
                        <polyline
                          fill="none"
                          stroke="#1976d2"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={tempPoints}
                        />

                        {/* Curva de Humedad Relativa (Verde azulado / Teal, solo si maduración) */}
                        {showHumidity && hrPoints.length > 0 && (
                          <polyline
                            fill="none"
                            stroke="#00897b"
                            strokeWidth="2"
                            strokeDasharray="5 2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={hrPoints}
                          />
                        )}
                      </svg>

                      {/* Leyendas y Marcas de Tiempo */}
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 1, px: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('cavas.time24hAgo', { count: history.length })} (Stream NDJSON)
                        </Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 12, height: 3, bgcolor: '#1976d2', borderRadius: 1 }} />
                            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 600 }}>
                              Temperatura PV (°C)
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 12, height: 2, bgcolor: '#ff9800', borderStyle: 'dashed' }} />
                            <Typography variant="caption" sx={{ color: '#ff9800' }}>
                              SP ({selectedCava.temp_sp.toFixed(1)}°C)
                            </Typography>
                          </Stack>
                          {showHumidity && (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Box sx={{ width: 12, height: 3, bgcolor: '#00897b', borderRadius: 1 }} />
                              <Typography variant="caption" sx={{ color: '#00897b', fontWeight: 600 }}>
                                Humedad Relativa PV (% HR)
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {t('cavas.timeNow')}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })()}
              </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setSelectedCava(null)} color="primary">
                {t('cavas.closeFocus')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* DIÁLOGO MODIFICAR CONSIGNA */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t('cavas.modifySetpoint', { variable: targetVar === 'temp' ? t('cavas.temperature') : t('cavas.humidity') })}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {isAdmin
                ? `Introduzca la nueva consigna deseada para la cámara ${selectedCava?.id}.`
                : t('cavas.modifyPrompt', { id: selectedCava?.id })}
            </Typography>
            <TextField
              label={t('cavas.newSetpoint', { unit: targetVar === 'temp' ? '°C' : '%' })}
              type="number"
              value={newSetpoint}
              onChange={(e) => setNewSetpoint(e.target.value)}
              fullWidth
              autoFocus
            />
            {!isAdmin && (
              <TextField
                label={t('cavas.adminPin')}
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                fullWidth
                helperText="Ingrese su PIN de Administrador / Mantenedor"
              />
            )}
            {spError && <Alert severity="error">{spError}</Alert>}
            {spSuccess && <Alert severity="success">{spSuccess}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={savingSp}>
            {t('cavas.cancel')}
          </Button>
          <Button variant="contained" onClick={handleSaveSetpoint} disabled={savingSp}>
            {savingSp ? <CircularProgress size={20} /> : t('cavas.saveAndTransmit')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO CONFIGURACIÓN DE ALARMAS Y TIEMPOS ISA-18.2 */}
      <Dialog open={alarmDialogOpen} onClose={() => setAlarmDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AlarmTuneIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Ajustes de Alarma y Tiempos ISA-18.2 — {alarmCava?.id}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {alarmCava ? getCavaDescription(alarmCava) : ''}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Sección 1: Supervisión de Puertas */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <DoorOpenIcon color="warning" />
                <Typography variant="subtitle2" fontWeight={700}>
                  SUPERVISIÓN DE PUERTA ABIERTA (REED SWITCH)
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Advertencia Puerta (segundos)"
                    type="number"
                    value={doorGraceSec}
                    onChange={(e) => setDoorGraceSec(Math.max(10, parseInt(e.target.value) || 90))}
                    helperText="Luz Amarilla preventiva en torreta (Defecto: 90 s)"
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Sirena Crítica (segundos)"
                    type="number"
                    value={doorBuzzerSec}
                    onChange={(e) => setDoorBuzzerSec(Math.max(20, parseInt(e.target.value) || 180))}
                    helperText="Disparo de sirena acústica continua (Defecto: 180 s)"
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Silencio por Botón ACK (minutos)"
                    type="number"
                    value={ackGraceMin}
                    onChange={(e) => setAckGraceMin(Math.max(1, parseInt(e.target.value) || 10))}
                    helperText="Tiempo de cortesía silenciosa al pulsar el botón físico exterior (Defecto: 10 min)"
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Sección 2: Alarmas de Frío y Temperatura */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <TempAlarmIcon color="error" />
                <Typography variant="subtitle2" fontWeight={700}>
                  CONTROL TÉRMICO Y TOLERANCIAS DE ALARMA
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Desviación Máx. Temperatura (+°C)"
                    type="number"
                    inputProps={{ step: '0.1' }}
                    value={tempAlarmDelta}
                    onChange={(e) => setTempAlarmDelta(parseFloat(e.target.value) || 2.5)}
                    helperText="Tolerancia sobre el Setpoint antes de alarma (Defecto: +2.5°C)"
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Retardo de Confirmación (segundos)"
                    type="number"
                    value={tempAlarmDelaySec}
                    onChange={(e) => setTempAlarmDelaySec(Math.max(0, parseInt(e.target.value) || 300))}
                    helperText="Tiempo que debe persistir para evitar falsas alarmas (Defecto: 300 s / 5 min)"
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>

            {alarmMsg && (
              <Alert severity={alarmMsg.type}>
                {alarmMsg.text}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAlarmDialogOpen(false)} disabled={savingAlarm}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSaveAlarmSettings} disabled={savingAlarm}>
            {savingAlarm ? <CircularProgress size={20} /> : 'Guardar Ajustes ISA-18.2'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO EDICIÓN RÁPIDA DE METADATOS DE CAVA */}
      <Dialog open={editMetaOpen} onClose={() => !savingMeta && setEditMetaOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Editar Cava {editMetaCava?.id} (ID Modbus: {editMetaCava?.modbus_id})
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Código / Tag de Cava"
              fullWidth
              value={editMetaId}
              onChange={(e) => setEditMetaId(e.target.value.toUpperCase())}
              helperText="Identificador breve (ej. C1, C6A, MAD-1)"
              size="small"
            />
            <TextField
              label="Nombre / Descripción Operativa"
              fullWidth
              value={editMetaDesc}
              onChange={(e) => setEditMetaDesc(e.target.value)}
              helperText="Nombre mostrado en pantalla (ej. Cava 6A - Conservación)"
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de Cava</InputLabel>
              <Select
                value={editMetaTipo}
                label="Tipo de Cava"
                onChange={(e: SelectChangeEvent) => {
                  const tipo = e.target.value as 'conservacion' | 'maduracion';
                  setEditMetaTipo(tipo);
                  if (tipo === 'maduracion') setEditMetaHumidity(true);
                }}
              >
                <MenuItem value="conservacion">Conservación (Solo Temperatura)</MenuItem>
                <MenuItem value="maduracion">Maduración (Temperatura + Humedad)</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={editMetaHumidity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditMetaHumidity(e.target.checked)}
                  color="warning"
                />
              }
              label="Habilitar Curva y Monitoreo de Humedad"
            />

            {metaMsg && (
              <Alert severity={metaMsg.type}>
                {metaMsg.text}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditMetaOpen(false)} disabled={savingMeta}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSaveEditMeta} disabled={savingMeta}>
            {savingMeta ? <CircularProgress size={20} /> : 'Guardar Cambios'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
