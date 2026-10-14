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
  Divider,
} from '@mui/material';
import {
  Search as ScanIcon,
  NetworkPing as PingIcon,
  CheckCircle as OkIcon,
  Cancel as FailIcon,
  Lightbulb as LampIcon,
  VolumeUp as BuzzerIcon,
  MeetingRoom as DoorIcon,
  TouchApp as AckIcon,
  Warning as AlarmIcon,
  PowerSettingsNew as OffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  startBusScan,
  getScanStatus,
  fetchDiagnosticStats,
  pingSlave,
  fetchSignalingNodes,
  triggerSignalingTest,
} from './api/cavas';
import { DiagnosticStat, DiscoveredSlave, PingResponse, SignalingNodeData } from './types/cavas';
import useInterval from '../utils/useInterval';
import { useLayoutTitle } from '../components/layout/context';

export const ModbusDiagnostic: React.FC = () => {
  const { t } = useTranslation();
  useLayoutTitle(t('cavas.diagnostic', 'Diagnóstico Modbus'));
  const [stats, setStats] = useState<DiagnosticStat[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // Estados de Nodos de Señalización (FridgeIO)
  const [signalingNodes, setSignalingNodes] = useState<SignalingNodeData[]>([]);
  const [loadingNodes, setLoadingNodes] = useState<boolean>(true);
  const [testActiveMessage, setTestActiveMessage] = useState<{ [nodeId: number]: string }>({});

  // Estados del Escáner
  const [startId, setStartId] = useState<number>(1);
  const [endId, setEndId] = useState<number>(16);
  const [resetList, setResetList] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [currentScanId, setCurrentScanId] = useState<number>(0);
  const [scanResults, setScanResults] = useState<DiscoveredSlave[]>([]);
  const [scanMessage, setScanMessage] = useState<string>('');

  // Estados del Ping Individual
  const [pingId, setPingId] = useState<number>(100);
  const [pingLoading, setPingLoading] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<PingResponse | null>(null);

  const loadStats = async () => {
    try {
      const [statsData, nodesData] = await Promise.all([
        fetchDiagnosticStats().catch(() => []),
        fetchSignalingNodes().catch(() => []),
      ]);
      setStats(statsData);
      setSignalingNodes(nodesData);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoadingStats(false);
      setLoadingNodes(false);
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
    setScanning(true);
    setScanResults([]);
    setScanMessage(t('diagnostic.scanStarting'));
    try {
      await startBusScan(startId, endId, resetList);
    } catch (e) {
      setScanning(false);
      setScanMessage(t('diagnostic.scanError'));
    }
  };

  const handlePing = async () => {
    setPingLoading(true);
    setPingResult(null);
    try {
      const res = await pingSlave(pingId);
      setPingResult(res);
      loadStats();
    } catch (e) {
      setPingResult({
        id: pingId,
        success: false,
        rtt_ms: 0,
        model: 'ERROR',
        temp_pv: 0,
      });
    } finally {
      setPingLoading(false);
    }
  };

  const handleLampTest = async (nodeId: number) => {
    try {
      // Actualización optimista de todos los relés a ON
      setSignalingNodes((prev) =>
        prev.map((n) =>
          n.modbus_id !== nodeId
            ? n
            : {
                ...n,
                green_a: true,
                yellow_a: true,
                red_a: true,
                buzzer_a: true,
                green_b: true,
                yellow_b: true,
                red_b: true,
                buzzer_b: true,
              }
        )
      );

      await triggerSignalingTest(nodeId, 'lamp_test', undefined, 5);
      setTestActiveMessage((prev) => ({ ...prev, [nodeId]: '¡Prueba de lámparas activa (5 segundos)!' }));
      setTimeout(() => {
        setTestActiveMessage((prev) => {
          const updated = { ...prev };
          delete updated[nodeId];
          return updated;
        });
        loadStats();
      }, 5200);
      loadStats();
    } catch (e) {
      console.error('Error triggering lamp test:', e);
      loadStats();
    }
  };

  const handleStopTest = async (nodeId: number) => {
    try {
      // Actualización optimista a OFF
      setSignalingNodes((prev) =>
        prev.map((n) =>
          n.modbus_id !== nodeId
            ? n
            : {
                ...n,
                green_a: false,
                yellow_a: false,
                red_a: false,
                buzzer_a: false,
                green_b: false,
                yellow_b: false,
                red_b: false,
                buzzer_b: false,
              }
        )
      );

      await triggerSignalingTest(nodeId, 'stop_test');
      setTestActiveMessage((prev) => {
        const updated = { ...prev };
        delete updated[nodeId];
        return updated;
      });
      loadStats();
    } catch (e) {
      console.error('Error stopping test:', e);
      loadStats();
    }
  };

  const handleToggleRelay = async (node: SignalingNodeData, bitIndex: number) => {
    try {
      let coils = 0;
      if (node.green_a) coils |= (1 << 0);
      if (node.yellow_a) coils |= (1 << 1);
      if (node.red_a) coils |= (1 << 2);
      if (node.buzzer_a) coils |= (1 << 3);
      if (node.green_b) coils |= (1 << 4);
      if (node.yellow_b) coils |= (1 << 5);
      if (node.red_b) coils |= (1 << 6);
      if (node.buzzer_b) coils |= (1 << 7);

      coils ^= (1 << bitIndex);

      // Actualización optimista inmediata en UI (0 ms de retardo visual)
      setSignalingNodes((prev) =>
        prev.map((n) =>
          n.modbus_id !== node.modbus_id
            ? n
            : {
                ...n,
                green_a: (coils & (1 << 0)) !== 0,
                yellow_a: (coils & (1 << 1)) !== 0,
                red_a: (coils & (1 << 2)) !== 0,
                buzzer_a: (coils & (1 << 3)) !== 0,
                green_b: (coils & (1 << 4)) !== 0,
                yellow_b: (coils & (1 << 5)) !== 0,
                red_b: (coils & (1 << 6)) !== 0,
                buzzer_b: (coils & (1 << 7)) !== 0,
              }
        )
      );

      await triggerSignalingTest(node.modbus_id, 'toggle_bit', undefined, 5, bitIndex);
      setTestActiveMessage((prev) => ({ ...prev, [node.modbus_id]: 'Prueba de relé activa por 5 segundos' }));
      setTimeout(() => {
        setTestActiveMessage((prev) => {
          const updated = { ...prev };
          delete updated[node.modbus_id];
          return updated;
        });
        loadStats();
      }, 5200);
    } catch (e) {
      console.error('Error toggling relay:', e);
      loadStats();
    }
  };

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
                  onChange={(e) => setStartId(parseInt(e.target.value) || 1)}
                  disabled={scanning}
                />
                <TextField
                  label={t('diagnostic.idEnd')}
                  type="number"
                  size="small"
                  value={endId}
                  onChange={(e) => setEndId(parseInt(e.target.value) || 32)}
                  disabled={scanning}
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
                  onChange={(e) => setPingId(parseInt(e.target.value) || 1)}
                  disabled={pingLoading}
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

        {/* PANEL SATÉLITES DE SEÑALIZACIÓN (FRIDGE-IO) & PRUEBAS DE CAMPO */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Auxiliares de Cava (Satélites FridgeIO) - Monitoreo y Pruebas en Sitio
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Lectura de puertas (abierta/cerrada), pulsadores ACK, solenoides N.A. y control manual de relés (torretas y sirenas)
                  </Typography>
                </Box>
                <Button variant="outlined" size="small" onClick={loadStats}>
                  Refrescar
                </Button>
              </Stack>

              {loadingNodes ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : signalingNodes.length === 0 ? (
                <Alert severity="warning">No hay satélites FridgeIO detectados en el bus RS-485</Alert>
              ) : (
                <Grid container spacing={2}>
                  {signalingNodes.map((node) => (
                    <Grid size={{ xs: 12 }} key={node.modbus_id}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                        {/* Cabecera del Satélite */}
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ sm: 'center' }}
                          spacing={1}
                          sx={{ mb: 2 }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" fontWeight={700}>
                              Satélite FridgeIO #ID {node.modbus_id}
                            </Typography>
                            <Chip
                              label={node.online ? 'ONLINE' : 'DESCONECTADO'}
                              color={node.online ? 'success' : 'error'}
                              size="small"
                              sx={{ fontWeight: 700 }}
                            />
                            <Chip
                              label={`Calidad: ${node.quality_percent.toFixed(0)}%`}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>

                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="contained"
                              color="warning"
                              size="small"
                              startIcon={<LampIcon />}
                              onClick={() => handleLampTest(node.modbus_id)}
                              disabled={!node.online}
                            >
                              💡 Prueba de Lámparas (5s)
                            </Button>
                            <Button
                              variant="outlined"
                              color="inherit"
                              size="small"
                              startIcon={<OffIcon />}
                              onClick={() => handleStopTest(node.modbus_id)}
                              disabled={!node.online}
                            >
                              Auto / Apagar
                            </Button>
                          </Stack>
                        </Stack>

                        {testActiveMessage[node.modbus_id] && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            {testActiveMessage[node.modbus_id]}
                          </Alert>
                        )}

                        <Grid container spacing={2}>
                          {/* CANAL A */}
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                              <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5 }}>
                                CANAL A: {node.cava_a ? `Cava ${node.cava_a}` : 'Sin Cava asignada'}
                              </Typography>

                              {/* Entradas Digitales Canal A */}
                              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                ENTRADAS DIGITALES (SENSORES DE CAMPO)
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 0.5, mb: 2 }} flexWrap="wrap">
                                <Chip
                                  icon={<DoorIcon />}
                                  label={node.door_closed_a ? 'Puerta Cerrada' : '¡PUERTA ABIERTA!'}
                                  color={node.door_closed_a ? 'success' : 'error'}
                                  variant={node.door_closed_a ? 'outlined' : 'filled'}
                                  size="small"
                                />
                                <Chip
                                  icon={<AckIcon />}
                                  label={node.ack_pressed_a ? 'ACK Presionado' : 'ACK Reposo'}
                                  color={node.ack_pressed_a ? 'primary' : 'default'}
                                  variant="outlined"
                                  size="small"
                                />
                                <Chip
                                  icon={<AlarmIcon />}
                                  label={node.kide_alarm_a ? 'Alarma Kide: NORMAL' : 'Alarma Kide: DISPARADA'}
                                  color={node.kide_alarm_a ? 'success' : 'error'}
                                  variant="outlined"
                                  size="small"
                                />
                              </Stack>

                              {/* Válvulas Solenoides N.A. de Agua Helada */}
                              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                VÁLVULAS SOLENOIDES DE AGUA HELADA (N.A. FAIL-SAFE x2)
                              </Typography>
                              <Box sx={{ mt: 0.5, mb: 2 }}>
                                <Chip
                                  label="Válvulas N.A.: Abiertas por resorte (Enfriamiento activo si se desenergizan)"
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                />
                              </Box>

                              <Divider sx={{ my: 1 }} />

                              {/* Salidas a Relé Canal A */}
                              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                SALIDAS A RELÉ (TORRETA & BUZZER)
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                                <Button
                                  size="small"
                                  variant={node.green_a ? 'contained' : 'outlined'}
                                  color="success"
                                  onClick={() => handleToggleRelay(node, 0)}
                                >
                                  🟢 Verde {node.green_a ? 'ON' : 'OFF'}
                                </Button>
                                <Button
                                  size="small"
                                  variant={node.yellow_a ? 'contained' : 'outlined'}
                                  color="warning"
                                  onClick={() => handleToggleRelay(node, 1)}
                                >
                                  🟡 Amarilla {node.yellow_a ? 'ON' : 'OFF'}
                                </Button>
                                <Button
                                  size="small"
                                  variant={node.red_a ? 'contained' : 'outlined'}
                                  color="error"
                                  onClick={() => handleToggleRelay(node, 2)}
                                >
                                  🔴 Roja {node.red_a ? 'ON' : 'OFF'}
                                </Button>
                                <Button
                                  size="small"
                                  variant={node.buzzer_a ? 'contained' : 'outlined'}
                                  color="error"
                                  startIcon={<BuzzerIcon />}
                                  onClick={() => handleToggleRelay(node, 3)}
                                >
                                  🔊 Sirena {node.buzzer_a ? 'ON' : 'OFF'}
                                </Button>
                              </Stack>
                            </Card>
                          </Grid>

                          {/* CANAL B */}
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                              <Typography variant="subtitle2" fontWeight={700} color="secondary" sx={{ mb: 1.5 }}>
                                CANAL B: {node.cava_b ? `Cava ${node.cava_b}` : 'Sin Cava asignada'}
                              </Typography>

                              {/* Entradas Digitales Canal B */}
                              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                ENTRADAS DIGITALES (SENSORES DE CAMPO)
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 0.5, mb: 2 }} flexWrap="wrap">
                                <Chip
                                  icon={<DoorIcon />}
                                  label={node.door_closed_b ? 'Puerta Cerrada' : '¡PUERTA ABIERTA!'}
                                  color={node.door_closed_b ? 'success' : 'error'}
                                  variant={node.door_closed_b ? 'outlined' : 'filled'}
                                  size="small"
                                />
                                <Chip
                                  icon={<AckIcon />}
                                  label={node.ack_pressed_b ? 'ACK Presionado' : 'ACK Reposo'}
                                  color={node.ack_pressed_b ? 'primary' : 'default'}
                                  variant="outlined"
                                  size="small"
                                />
                                <Chip
                                  icon={<AlarmIcon />}
                                  label={node.kide_alarm_b ? 'Alarma Kide: NORMAL' : 'Alarma Kide: DISPARADA'}
                                  color={node.kide_alarm_b ? 'success' : 'error'}
                                  variant="outlined"
                                  size="small"
                                />
                              </Stack>

                              {/* Válvulas Solenoides N.A. de Agua Helada */}
                              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                VÁLVULAS SOLENOIDES DE AGUA HELADA (N.A. FAIL-SAFE x2)
                              </Typography>
                              <Box sx={{ mt: 0.5, mb: 2 }}>
                                <Chip
                                  label="Válvulas N.A.: Abiertas por resorte (Enfriamiento activo si se desenergizan)"
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                />
                              </Box>

                              <Divider sx={{ my: 1 }} />

                              {/* Salidas a Relé Canal B */}
                              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                SALIDAS A RELÉ (TORRETA & BUZZER)
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                                <Button
                                  size="small"
                                  variant={node.green_b ? 'contained' : 'outlined'}
                                  color="success"
                                  onClick={() => handleToggleRelay(node, 4)}
                                >
                                  🟢 Verde {node.green_b ? 'ON' : 'OFF'}
                                </Button>
                                <Button
                                  size="small"
                                  variant={node.yellow_b ? 'contained' : 'outlined'}
                                  color="warning"
                                  onClick={() => handleToggleRelay(node, 5)}
                                >
                                  🟡 Amarilla {node.yellow_b ? 'ON' : 'OFF'}
                                </Button>
                                <Button
                                  size="small"
                                  variant={node.red_b ? 'contained' : 'outlined'}
                                  color="error"
                                  onClick={() => handleToggleRelay(node, 6)}
                                >
                                  🔴 Roja {node.red_b ? 'ON' : 'OFF'}
                                </Button>
                                <Button
                                  size="small"
                                  variant={node.buzzer_b ? 'contained' : 'outlined'}
                                  color="error"
                                  startIcon={<BuzzerIcon />}
                                  onClick={() => handleToggleRelay(node, 7)}
                                >
                                  🔊 Sirena {node.buzzer_b ? 'ON' : 'OFF'}
                                </Button>
                              </Stack>
                            </Card>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* PANEL 3: TABLA DE SALUD Y MÉTRICAS DE ENLACE */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                {t('diagnostic.metricsTitle')}
              </Typography>
              {loadingStats ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : stats.length === 0 ? (
                <Alert severity="info">{t('diagnostic.noActiveCavas')}</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('diagnostic.colCava')}</TableCell>
                        <TableCell>{t('diagnostic.colId')}</TableCell>
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
                      {stats.map((row) => (
                        <TableRow key={row.cava}>
                          <TableCell><b>{row.cava}</b></TableCell>
                          <TableCell>{row.modbus_id}</TableCell>
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
    </Box>
  );
};
