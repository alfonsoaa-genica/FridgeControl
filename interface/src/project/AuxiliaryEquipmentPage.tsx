import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  MeetingRoom as DoorIcon,
  PowerSettingsNew as PowerIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useLayoutTitle } from '../components/layout/context';
import { AuthenticatedContext } from '../contexts/authentication';
import useInterval from '../utils/useInterval';
import {
  fetchCavas,
  fetchDiagnosticStats,
  fetchSignalingNodes,
  triggerSignalingTest,
  updateSignalingMapping,
} from './api/cavas';
import { CavaState, DiagnosticStat, SignalingNodeData } from './types/cavas';

type Channel = 'a' | 'b';

const relays = [
  { label: 'Verde', key: 'green' },
  { label: 'Amarilla', key: 'yellow' },
  { label: 'Roja', key: 'red' },
  { label: 'Sirena', key: 'buzzer' },
] as const;
const channelRelayOffsets: Record<Channel, number> = { a: 0, b: 4 };

export const AuxiliaryEquipmentPage: React.FC = () => {
  useLayoutTitle('Equipos Auxiliares de Cava');
  const isAdmin = useContext(AuthenticatedContext)?.me?.admin ?? false;
  const [nodes, setNodes] = useState<SignalingNodeData[]>([]);
  const [cavas, setCavas] = useState<CavaState[]>([]);
  const [stats, setStats] = useState<DiagnosticStat[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<number, { cava_a: string; cava_b: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingNode, setSavingNode] = useState<number | null>(null);
  const [activeTestNode, setActiveTestNode] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [nodeData, cavaData, statData] = await Promise.all([
        fetchSignalingNodes(),
        fetchCavas(),
        fetchDiagnosticStats(),
      ]);
      setNodes(nodeData);
      setCavas(cavaData);
      setStats(statData.filter((stat) => stat.type === 'FRIDGE_IO' || stat.modbus_id >= 100));
      setMappingDrafts((previous) => {
        const next = { ...previous };
        nodeData.forEach((node) => {
          if (!next[node.modbus_id]) {
            next[node.modbus_id] = { cava_a: node.cava_a || '', cava_b: node.cava_b || '' };
          }
        });
        return next;
      });
      setFeedback((current) => current?.severity === 'error' ? null : current);
    } catch (error) {
      console.error('Error cargando equipos auxiliares:', error);
      setFeedback({ severity: 'error', text: 'No se pudo cargar la información de los equipos auxiliares.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useInterval(() => {
    void loadData();
  }, 2000);

  const handleSaveMapping = async (nodeId: number) => {
    const mapping = mappingDrafts[nodeId];
    if (!mapping) return;
    if (mapping.cava_a && mapping.cava_a === mapping.cava_b) {
      setFeedback({ severity: 'error', text: 'Canal A y Canal B deben asociarse a cavas distintas.' });
      return;
    }

    setSavingNode(nodeId);
    try {
      await updateSignalingMapping(nodeId, mapping.cava_a, mapping.cava_b);
      setFeedback({ severity: 'success', text: `Asociación del satélite ${nodeId} guardada.` });
      await loadData();
    } catch (error: any) {
      setFeedback({
        severity: 'error',
        text: error.response?.data?.error || error.message || `No se pudo guardar la asociación del satélite ${nodeId}.`,
      });
    } finally {
      setSavingNode(null);
    }
  };

  const handleTest = async (nodeId: number, mode: 'lamp_test' | 'stop_test') => {
    setActiveTestNode(nodeId);
    try {
      await triggerSignalingTest(nodeId, mode);
      setFeedback({
        severity: 'success',
        text: mode === 'lamp_test' ? `Prueba de lámparas iniciada para el satélite ${nodeId}.` : `Control automático restaurado para el satélite ${nodeId}.`,
      });
      await loadData();
    } catch (error: any) {
      setFeedback({
        severity: 'error',
        text: error.response?.data?.error || error.message || `No se pudo ejecutar la prueba del satélite ${nodeId}.`,
      });
    } finally {
      setActiveTestNode(null);
    }
  };

  const handleToggleRelay = async (node: SignalingNodeData, channel: Channel, relayIndex: number) => {
    const bitIndex = channelRelayOffsets[channel] + relayIndex;
    try {
      await triggerSignalingTest(node.modbus_id, 'toggle_bit', undefined, 5, bitIndex);
      setFeedback({ severity: 'success', text: `Prueba temporal de salida iniciada en el satélite ${node.modbus_id}.` });
      await loadData();
    } catch (error: any) {
      setFeedback({
        severity: 'error',
        text: error.response?.data?.error || error.message || `No se pudo accionar el relé ${relayIndex + 1}.`,
      });
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="primary">
            Equipos Auxiliares de Cava
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Asociaciones de canales, estado de campo y pruebas de satélites FridgeIO.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => void loadData()} disabled={loading}>
          Refrescar
        </Button>
      </Stack>

      {feedback && (
        <Alert severity={feedback.severity} onClose={() => setFeedback(null)} sx={{ mb: 2 }}>
          {feedback.text}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : nodes.length === 0 ? (
        <Alert severity="info">No hay satélites auxiliares registrados. Ejecuta el escáner RS-485 desde Diagnóstico Modbus para capturar uno.</Alert>
      ) : (
        <Stack spacing={2}>
          {nodes.map((node) => {
            const mapping = mappingDrafts[node.modbus_id] ?? { cava_a: node.cava_a || '', cava_b: node.cava_b || '' };
            return (
              <Card key={node.modbus_id} variant="outlined">
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    alignItems={{ md: 'center' }}
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ mb: 2 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="h6" fontWeight={700}>Satélite FridgeIO #{node.modbus_id}</Typography>
                      <Chip size="small" label={node.online ? 'ONLINE' : 'DESCONECTADO'} color={node.online ? 'success' : 'default'} />
                      <Chip size="small" label={`Calidad ${node.quality_percent.toFixed(0)}%`} variant="outlined" />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        disabled={!node.online || activeTestNode === node.modbus_id}
                        onClick={() => void handleTest(node.modbus_id, 'lamp_test')}
                      >
                        Prueba de lámparas (5 s)
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PowerIcon />}
                        disabled={!node.online || activeTestNode === node.modbus_id}
                        onClick={() => void handleTest(node.modbus_id, 'stop_test')}
                      >
                        Auto / Apagar
                      </Button>
                    </Stack>
                  </Stack>

                  <Grid container spacing={2}>
                    {(['a', 'b'] as const).map((channel) => {
                      const suffix = channel.toUpperCase() as 'A' | 'B';
                      const cavaId = channel === 'a' ? mapping.cava_a : mapping.cava_b;
                      return (
                        <Grid size={{ xs: 12, md: 6 }} key={channel}>
                          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              alignItems={{ sm: 'center' }}
                              justifyContent="space-between"
                              sx={{ mb: 1.5 }}
                            >
                              <Typography variant="subtitle1" fontWeight={700}>
                                Canal {suffix}{cavaId ? ` — ${cavaId}` : ' — Sin cava asociada'}
                              </Typography>
                              <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel id={`aux-${node.modbus_id}-${channel}-label`}>Asociar cava</InputLabel>
                                <Select
                                  labelId={`aux-${node.modbus_id}-${channel}-label`}
                                  label="Asociar cava"
                                  value={cavaId}
                                  disabled={!isAdmin || savingNode === node.modbus_id}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setMappingDrafts((previous) => ({
                                      ...previous,
                                      [node.modbus_id]: {
                                        ...mapping,
                                        [channel === 'a' ? 'cava_a' : 'cava_b']: value,
                                      },
                                    }));
                                  }}
                                >
                                  <MenuItem value="">Sin asignar</MenuItem>
                                  {cavas.map((cava) => (
                                    <MenuItem key={cava.id} value={cava.id}>{cava.id} — {cava.descripcion}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Stack>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                              <Chip
                                size="small"
                                icon={<DoorIcon />}
                                label={node[`door_closed_${channel}`] ? 'Puerta cerrada' : 'Puerta abierta'}
                                color={node[`door_closed_${channel}`] ? 'success' : 'error'}
                                variant={node[`door_closed_${channel}`] ? 'outlined' : 'filled'}
                              />
                              <Chip size="small" label={node[`ack_pressed_${channel}`] ? 'ACK presionado' : 'ACK en reposo'} variant="outlined" />
                              <Chip
                                size="small"
                                label={node[`kide_alarm_${channel}`] ? 'Alarma controlador normal' : 'Alarma controlador activa'}
                                color={node[`kide_alarm_${channel}`] ? 'success' : 'error'}
                                variant="outlined"
                              />
                            </Stack>

                            <Typography variant="caption" color="text.secondary" fontWeight={700}>
                              SALIDAS DE SEÑALIZACIÓN
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                              {relays.map((relay, index) => {
                                const relayKey = `${relay.key}_${channel}` as keyof SignalingNodeData;
                                const relayIsOn = Boolean(node[relayKey]);
                                const color = index === 0 ? 'success' : index === 1 ? 'warning' : 'error';
                                return (
                                  <Button
                                    key={relay.key}
                                    size="small"
                                    color={color}
                                    variant={relayIsOn ? 'contained' : 'outlined'}
                                    disabled={!node.online || !isAdmin}
                                    onClick={() => void handleToggleRelay(node, channel, index)}
                                  >
                                    {relay.label} {relayIsOn ? 'ON' : 'OFF'}
                                  </Button>
                                );
                              })}
                            </Stack>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>

                  <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      disabled={!isAdmin || savingNode === node.modbus_id}
                      onClick={() => void handleSaveMapping(node.modbus_id)}
                    >
                      {savingNode === node.modbus_id ? 'Guardando...' : 'Guardar asociaciones'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Métricas RS-485</Typography>
              {stats.length === 0 ? (
                <Alert severity="info">No hay métricas disponibles para los satélites auxiliares.</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Satélite</TableCell>
                        <TableCell>ID</TableCell>
                        <TableCell>Cavas asociadas</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">TX</TableCell>
                        <TableCell align="right">RX OK</TableCell>
                        <TableCell align="right">Timeouts</TableCell>
                        <TableCell align="right">CRC</TableCell>
                        <TableCell align="right">RTT</TableCell>
                        <TableCell align="right">Calidad</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.map((row) => (
                        <TableRow key={row.modbus_id}>
                          <TableCell>{row.cava || `Auxiliar ${row.modbus_id}`}</TableCell>
                          <TableCell>{row.modbus_id}</TableCell>
                          <TableCell>{row.cava_id || 'Sin asignar'}</TableCell>
                          <TableCell>
                            <Chip size="small" label={row.online ? 'Online' : 'Timeout'} color={row.online ? 'success' : 'default'} />
                          </TableCell>
                          <TableCell align="right">{row.tx_frames}</TableCell>
                          <TableCell align="right">{row.rx_success}</TableCell>
                          <TableCell align="right">{row.timeouts}</TableCell>
                          <TableCell align="right">{row.crc_errors}</TableCell>
                          <TableCell align="right">{row.last_rtt_ms} ms</TableCell>
                          <TableCell align="right">{row.quality_percent.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
};
