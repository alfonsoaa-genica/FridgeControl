import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Search as ScanIcon,
  NetworkPing as PingIcon,
  CheckCircle as OkIcon,
  Cancel as FailIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  startBusScan,
  getScanStatus,
  fetchDiagnosticStats,
  pingSlave,
} from './api/cavas';
import { DiagnosticStat, DiscoveredSlave, PingResponse } from './types/cavas';
import useInterval from '../utils/useInterval';
import { useLayoutTitle } from '../components/layout/context';
import { ModbusTraceConsole } from './ModbusTraceConsole';

export const ModbusDiagnostic: React.FC = () => {
  const { t } = useTranslation();
  useLayoutTitle(t('cavas.diagnostic', 'Diagnóstico Modbus'));
  const [stats, setStats] = useState<DiagnosticStat[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // Estado del escáner Modbus
  const [startId, setStartId] = useState<number | string>(1);
  const [endId, setEndId] = useState<number | string>(16);
  const [resetList, setResetList] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [currentScanId, setCurrentScanId] = useState<number>(0);
  const [scanResults, setScanResults] = useState<DiscoveredSlave[]>([]);
  const [scanMessage, setScanMessage] = useState<string>('');

  // Estados del Ping Individual
  const [pingId, setPingId] = useState<number | string>(1);
  const [pingLoading, setPingLoading] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<PingResponse | null>(null);

  const loadStats = async () => {
    try {
      setStats(await fetchDiagnosticStats());
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useInterval(() => {
    if (!scanning) {
      loadStats();
    }
  }, 1000);

  // Polling del estado de escaneo
  useInterval(() => {
    if (scanning) {
      getScanStatus().then((res: any) => {
        if (res.status === 'scanning') {
          setCurrentScanId(res.current_id);
        } else if (Array.isArray(res)) {
          setScanning(false);
          setScanResults(res);
          setScanMessage(t('diagnostic.scanComplete', { count: res.length }));
          loadStats();
        }
      });
    }
  }, 1000);

  const handleStartScan = async () => {
    const sId = Math.max(1, Math.min(247, Number(startId) || 1));
    const eId = Math.max(sId, Math.min(247, Number(endId) || 32));
    setStartId(sId);
    setEndId(eId);
    setScanning(true);
    setScanResults([]);
    setScanMessage(t('diagnostic.scanStarting'));
    try {
      await startBusScan(sId, eId, resetList);
    } catch (e) {
      setScanning(false);
      setScanMessage(t('diagnostic.scanError'));
    }
  };

  const handlePing = async () => {
    const targetId = Math.max(1, Math.min(247, Number(pingId) || 1));
    setPingId(targetId);
    setPingLoading(true);
    setPingResult(null);
    try {
      const res = await pingSlave(targetId);
      setPingResult(res);
      loadStats();
    } catch (e) {
      setPingResult({
        id: targetId,
        success: false,
        rtt_ms: 0,
        model: 'ERROR',
        temp_pv: 0,
      });
    } finally {
      setPingLoading(false);
    }
  };

  const cavasStats: DiagnosticStat[] = stats.filter((s) => s.type === 'KIDE' || s.modbus_id < 100);
  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Typography variant="h5" fontWeight={700} color="primary" sx={{ mb: 1 }}>
        {t('diagnostic.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('diagnostic.subtitle')}
      </Typography>

      <Grid container spacing={3}>
        {/* PANEL 1: ESCÁNER Y AUTO-DESCUBRIMIENTO */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <ScanIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  {t('diagnostic.scanTitle')}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('diagnostic.scanDesc')}
              </Typography>

              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label={t('diagnostic.idStart')}
                  type="number"
                  size="small"
                  value={startId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setStartId('');
                    } else {
                      const p = parseInt(val, 10);
                      setStartId(isNaN(p) ? '' : p);
                    }
                  }}
                  onBlur={() => {
                    if (startId === '' || Number(startId) < 1) setStartId(1);
                    else if (Number(startId) > 247) setStartId(247);
                  }}
                  onFocus={(e) => e.target.select()}
                  disabled={scanning}
                  slotProps={{ htmlInput: { min: 1, max: 247 } }}
                />
                <TextField
                  label={t('diagnostic.idEnd')}
                  type="number"
                  size="small"
                  value={endId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setEndId('');
                    } else {
                      const p = parseInt(val, 10);
                      setEndId(isNaN(p) ? '' : p);
                    }
                  }}
                  onBlur={() => {
                    if (endId === '' || Number(endId) < 1) setEndId(1);
                    else if (Number(endId) > 247) setEndId(247);
                  }}
                  onFocus={(e) => e.target.select()}
                  disabled={scanning}
                  slotProps={{ htmlInput: { min: 1, max: 247 } }}
                />
              </Stack>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={resetList}
                    onChange={(e) => setResetList(e.target.checked)}
                    disabled={scanning}
                  />
                }
                label={t('diagnostic.resetList')}
                sx={{ mb: 2 }}
              />

              <Button
                variant="contained"
                startIcon={<ScanIcon />}
                onClick={handleStartScan}
                disabled={scanning}
                fullWidth
              >
                {scanning ? t('diagnostic.scanningId', { id: currentScanId }) : t('diagnostic.startScan')}
              </Button>

              {scanning && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                    {t('diagnostic.pollingSlave', { id: currentScanId })}
                  </Typography>
                </Box>
              )}

              {scanMessage && !scanning && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {scanMessage}
                </Alert>
              )}

              {scanResults.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, maxHeight: 220 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('diagnostic.colId')}</TableCell>
                        <TableCell>{t('diagnostic.colModel')}</TableCell>
                        <TableCell>{t('diagnostic.colTemp')}</TableCell>
                        <TableCell>{t('diagnostic.colHr')}</TableCell>
                        <TableCell>{t('diagnostic.colRtt')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanResults.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell><b>{r.id}</b></TableCell>
                          <TableCell>{r.model}</TableCell>
                          <TableCell>{r.temp.toFixed(1)}°C</TableCell>
                          <TableCell>{r.hr ? `${r.hr.toFixed(1)}%` : '--'}</TableCell>
                          <TableCell>{r.rtt_ms} ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* PANEL 2: PING INDIVIDUAL */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <PingIcon color="secondary" />
                <Typography variant="h6" fontWeight={700}>
                  {t('diagnostic.pingTitle')}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('diagnostic.pingDesc')}
              </Typography>

              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label={t('diagnostic.pingLabel')}
                  type="number"
                  size="small"
                  value={pingId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setPingId('');
                    } else {
                      const p = parseInt(val, 10);
                      setPingId(isNaN(p) ? '' : p);
                    }
                  }}
                  onBlur={() => {
                    if (pingId === '' || Number(pingId) < 1) setPingId(1);
                    else if (Number(pingId) > 247) setPingId(247);
                  }}
                  onFocus={(e) => e.target.select()}
                  disabled={pingLoading}
                  slotProps={{ htmlInput: { min: 1, max: 247 } }}
                  sx={{ width: 180 }}
                />
                <Button
                  variant="outlined"
                  startIcon={<PingIcon />}
                  onClick={handlePing}
                  disabled={pingLoading}
                >
                  {pingLoading ? <CircularProgress size={20} /> : t('diagnostic.runPing')}
                </Button>
              </Stack>

              {pingResult && (
                <Alert
                  severity={pingResult.success ? 'success' : 'error'}
                  icon={pingResult.success ? <OkIcon /> : <FailIcon />}
                  sx={{ mt: 2 }}
                >
                  {pingResult.success ? (
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {t('diagnostic.pingSuccess', { id: pingResult.id, rtt: pingResult.rtt_ms })}
                      </Typography>
                      <Typography variant="body2">
                        {t('diagnostic.pingModel', { model: pingResult.model, temp: pingResult.temp_pv.toFixed(1) })}
                        {pingResult.hr_pv ? ` • ${t('diagnostic.colHr')}: ${pingResult.hr_pv.toFixed(1)}%` : ''}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2">
                      {t('diagnostic.pingFail', { id: pingResult.id })}
                    </Typography>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* PANEL 3A: MÉTRICAS DE ENLACE RS-422 (CAVAS KIDE EXCLUSIVAMENTE) */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6" fontWeight={700}>
                  {t('diagnostic.metricsTitleKide', 'Métricas de Calidad de Enlace RS-422 (Cavas KIDE)')}
                </Typography>
                <Chip
                  label="RS-422 Full-Duplex"
                  color="primary"
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              </Box>

              {loadingStats ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : cavasStats.length === 0 ? (
                <Alert severity="info">{t('diagnostic.noActiveCavas')}</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('diagnostic.colCava')}</TableCell>
                        <TableCell>{t('diagnostic.colId')}</TableCell>
                        <TableCell>{t('diagnostic.colModel', 'Controlador')}</TableCell>
                        <TableCell align="center">{t('diagnostic.colStatus')}</TableCell>
                        <TableCell align="right">{t('diagnostic.colTx')}</TableCell>
                        <TableCell align="right">{t('diagnostic.colRx')}</TableCell>
                        <TableCell align="right">{t('diagnostic.colTimeouts')}</TableCell>
                        <TableCell align="right">{t('diagnostic.colCrc')}</TableCell>
                        <TableCell align="right">{t('diagnostic.colLastRtt')}</TableCell>
                        <TableCell align="right">{t('diagnostic.colQuality')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cavasStats.map((row) => (
                        <TableRow key={row.cava_id || row.cava}>
                          <TableCell><b>{row.cava_id || row.cava}</b></TableCell>
                          <TableCell>{row.modbus_id}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.controller_name || (row.cava === 'C3' || row.cava === 'C4' ? 'KIDEMATIC 970' : 'KP-100')}
                              size="small"
                              color="secondary"
                              variant="outlined"
                              sx={{ fontSize: '0.72rem', fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={row.online ? 'Online' : 'Timeout'}
                              color={row.online ? 'success' : 'default'}
                              size="small"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">{row.tx_frames}</TableCell>
                          <TableCell align="right">{row.rx_success}</TableCell>
                          <TableCell align="right">{row.timeouts}</TableCell>
                          <TableCell align="right">{row.crc_errors}</TableCell>
                          <TableCell align="right">{row.last_rtt_ms} ms</TableCell>
                          <TableCell align="right">
                            <b style={{ color: row.quality_percent > 90 ? '#2e7d32' : row.quality_percent > 70 ? '#ed6c02' : '#d32f2f' }}>
                              {row.quality_percent.toFixed(1)}%
                            </b>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ModbusTraceConsole />
    </Box>
  );
};
