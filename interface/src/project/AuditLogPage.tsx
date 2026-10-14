import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  InputAdornment,
  SelectChangeEvent,
} from '@mui/material';
import {
  History as HistoryIcon,
  Download as DownloadIcon,
  DeleteSweep as ClearIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Tune as TuneIcon,
  NotificationsActive as AlarmIcon,
  Kitchen as CavaIcon,
  Person as PersonIcon,
  Devices as DeviceIcon,
} from '@mui/icons-material';
import { useLayoutTitle } from '../components/layout/context';
import { fetchAuditEvents, clearAuditEvents } from './api/audit';
import { AuditEvent } from './types/audit';
import { AuthenticatedContext } from '../contexts/authentication';

export const AuditLogPage: React.FC = () => {
  useLayoutTitle('Auditoría de Operaciones');

  const authenticatedContext = useContext(AuthenticatedContext);
  const isAdmin = authenticatedContext?.me?.admin ?? false;

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [clearDialogOpen, setClearDialogOpen] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditEvents();
      setEvents(data);
    } catch (e) {
      setFeedback({ type: 'error', text: 'Error al consultar registros de auditoría' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearAuditEvents();
      setFeedback({ type: 'success', text: 'Bitácora de auditoría reiniciada con éxito' });
      setClearDialogOpen(false);
      await loadData();
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.response?.data?.error || 'Error al limpiar bitácora' });
    } finally {
      setClearing(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts || ts < 100000) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionChip = (action: string) => {
    switch (action) {
      case 'SETPOINT_CHANGE':
        return (
          <Chip
            size="small"
            color="primary"
            icon={<TuneIcon sx={{ fontSize: '0.9rem !important' }} />}
            label="Consigna SP"
            sx={{ fontWeight: 600 }}
          />
        );
      case 'ALARM_CONFIG':
        return (
          <Chip
            size="small"
            color="warning"
            icon={<AlarmIcon sx={{ fontSize: '0.9rem !important' }} />}
            label="Alarmas ISA-18.2"
            sx={{ fontWeight: 600 }}
          />
        );
      case 'CAVA_CONFIG':
      case 'CAVA_META':
        return (
          <Chip
            size="small"
            color="info"
            icon={<CavaIcon sx={{ fontSize: '0.9rem !important' }} />}
            label="Config Cava"
            sx={{ fontWeight: 600 }}
          />
        );
      case 'CAVA_DELETE':
        return (
          <Chip
            size="small"
            color="error"
            label="Eliminar Cava"
            sx={{ fontWeight: 600 }}
          />
        );
      case 'TEMPLATE_INIT':
        return (
          <Chip
            size="small"
            color="secondary"
            label="Plantilla 1..N"
            sx={{ fontWeight: 600 }}
          />
        );
      default:
        return <Chip size="small" label={action} sx={{ fontWeight: 600 }} />;
    }
  };

  // Filtrado de eventos
  const filteredEvents = events.filter((ev) => {
    if (actionFilter !== 'ALL' && ev.action !== actionFilter) return false;
    if (searchTerm.trim().length > 0) {
      const term = searchTerm.toLowerCase();
      const matchUser = (ev.user || '').toLowerCase().includes(term);
      const matchTarget = (ev.target || '').toLowerCase().includes(term);
      const matchDetail = (ev.detail || '').toLowerCase().includes(term);
      const matchIp = (ev.ip || '').toLowerCase().includes(term);
      return matchUser || matchTarget || matchDetail || matchIp;
    }
    return true;
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* CABECERA */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <HistoryIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h5" fontWeight={700}>
              Auditoría de Operaciones (Audit Trail)
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Trazabilidad operacional e histórica de cambios de consigna, deltas de alarma ISA-18.2 y modificaciones del sistema.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Tooltip title="Actualizar registros">
            <IconButton onClick={loadData} disabled={loading} color="inherit">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            component="a"
            href="/rest/audit/download"
            target="_blank"
            download="audit_trail.ndjson"
          >
            Descargar Bitácora
          </Button>
          {isAdmin && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearIcon />}
              onClick={() => setClearDialogOpen(true)}
              disabled={loading || events.length === 0}
            >
              Reiniciar
            </Button>
          )}
        </Stack>
      </Stack>

      {/* FEEDBACK ALERT */}
      {feedback && (
        <Alert severity={feedback.type} onClose={() => setFeedback(null)} sx={{ mb: 3 }}>
          {feedback.text}
        </Alert>
      )}

      {/* BARRA DE FILTROS */}
      <Card sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Buscar por usuario, cava, detalle o IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filtrar por Acción</InputLabel>
            <Select
              value={actionFilter}
              label="Filtrar por Acción"
              onChange={(e: SelectChangeEvent) => setActionFilter(e.target.value)}
            >
              <MenuItem value="ALL">Todas las Acciones</MenuItem>
              <MenuItem value="SETPOINT_CHANGE">Cambio de Consigna (SP)</MenuItem>
              <MenuItem value="ALARM_CONFIG">Alarmas y Tiempos ISA-18.2</MenuItem>
              <MenuItem value="CAVA_CONFIG">Configuración de Cavas</MenuItem>
              <MenuItem value="CAVA_META">Renombramiento / Metadatos</MenuItem>
              <MenuItem value="CAVA_DELETE">Eliminación de Cava</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Card>

      {/* TABLA PRINCIPAL */}
      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Fecha / Hora (VET)</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Acción</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Objetivo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Detalle de la Operación</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Origen IP</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Cargando bitácora de auditoría...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="body1" fontWeight={600} color="text.secondary">
                      No se encontraron registros de auditoría.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Cada cambio de consigna, alarma o configuración quedará archivado aquí permanentemente.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((ev, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500, fontSize: '0.85rem' }}>
                      {formatTimestamp(ev.ts)}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={600}>
                          {ev.user || 'admin'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{getActionChip(ev.action)}</TableCell>
                    <TableCell>
                      <Chip
                        label={ev.target || '-'}
                        size="small"
                        variant="outlined"
                        color="default"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {ev.detail || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        <DeviceIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {ev.ip || '127.0.0.1'}
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* DIÁLOGO CONFIRMACIÓN REINICIAR BITÁCORA */}
      <Dialog open={clearDialogOpen} onClose={() => !clearing && setClearDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>¿Reiniciar Bitácora de Auditoría?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Está seguro de que desea vaciar la bitácora de auditoría histórica?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Esta acción creará un nuevo registro de reinicio y no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setClearDialogOpen(false)} disabled={clearing}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={handleClear} disabled={clearing}>
            {clearing ? <CircularProgress size={20} /> : 'Reiniciar Bitácora'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
