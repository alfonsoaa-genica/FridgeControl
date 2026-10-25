import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
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
  FormControlLabel,
  Switch,
  Tooltip,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  SettingsSuggest as TemplateIcon,
  Kitchen as KitchenIcon,
  AcUnit as TempIcon,
  WaterDrop as HumIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useLayoutTitle } from '../components/layout/context';
import { fetchCavasConfig, saveCavaConfig, deleteCavaConfig, initCavasTemplate } from './api/cavas';
import { CavaState } from './types/cavas';
import { AuthenticatedContext } from '../contexts/authentication';

interface CavaFormData {
  original_id?: string;
  id: string;
  descripcion: string;
  modbus_id: number | string;
  tipo: 'conservacion' | 'maduracion';
  has_humidity: boolean;
  temp_sp: number;
  temp_alarm_delta: number;
  hr_sp: number;
}

const defaultFormData: CavaFormData = {
  id: '',
  descripcion: '',
  modbus_id: 1,
  tipo: 'conservacion',
  has_humidity: false,
  temp_sp: 4.0,
  temp_alarm_delta: 2.5,
  hr_sp: 85.0,
};

export const CavasConfigPage: React.FC = () => {
  useLayoutTitle('Mantenimiento de Cavas');

  const authenticatedContext = useContext(AuthenticatedContext);
  const isAdmin = authenticatedContext?.me?.admin ?? false;

  const [cavas, setCavas] = useState<CavaState[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit / Add Modal
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [formData, setFormData] = useState<CavaFormData>(defaultFormData);

  // Delete Confirm Modal
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [cavaToDelete, setCavaToDelete] = useState<CavaState | null>(null);

  // Template Modal
  const [templateDialogOpen, setTemplateDialogOpen] = useState<boolean>(false);
  const [templateCount, setTemplateCount] = useState<number | string>(4);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCavasConfig();
      // Ordenar correlativamente por modbus_id
      data.sort((a, b) => a.modbus_id - b.modbus_id);
      setCavas(data);
    } catch (e) {
      setFeedback({ type: 'error', text: 'Error al cargar la lista de cavas de /config/cavas.json' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    // Buscar siguiente ID modbus correlativo no utilizado
    const usedIds = new Set(cavas.map((c) => c.modbus_id));
    let nextId = 1;
    while (usedIds.has(nextId) && nextId <= 32) {
      nextId++;
    }

    setFormData({
      id: `C${nextId}`,
      descripcion: `Cava ${nextId} - Conservación`,
      modbus_id: nextId,
      tipo: 'conservacion',
      has_humidity: false,
      temp_sp: 4.0,
      temp_alarm_delta: 2.5,
      hr_sp: 85.0,
    });
    setIsEditMode(false);
    setDialogOpen(true);
  };

  const handleOpenEdit = (cava: CavaState) => {
    setFormData({
      original_id: cava.id,
      id: cava.id,
      descripcion: cava.descripcion || '',
      modbus_id: cava.modbus_id,
      tipo: cava.tipo,
      has_humidity: cava.has_humidity,
      temp_sp: cava.temp_sp ?? 4.0,
      temp_alarm_delta: cava.temp_alarm_delta ?? 2.5,
      hr_sp: cava.hr_sp ?? 85.0,
    });
    setIsEditMode(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.id.trim()) {
      setFeedback({ type: 'error', text: 'El código / tag de la cava es obligatorio (ej. C1)' });
      return;
    }
    const finalModbusId = Math.max(1, Math.min(247, Number(formData.modbus_id) || 1));
    const payload = {
      ...formData,
      modbus_id: finalModbusId,
    };
    setSaving(true);
    setFeedback(null);
    try {
      await saveCavaConfig(payload as any);
      setFeedback({ type: 'success', text: `Cava "${formData.id}" guardada exitosamente en cavas.json` });
      setDialogOpen(false);
      await loadData();
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.response?.data?.error || 'Error al guardar la cava' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!cavaToDelete) return;
    setSaving(true);
    try {
      await deleteCavaConfig(cavaToDelete.id);
      setFeedback({ type: 'success', text: `Cava "${cavaToDelete.id}" eliminada del registro` });
      setDeleteDialogOpen(false);
      setCavaToDelete(null);
      await loadData();
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.response?.data?.error || 'Error al eliminar la cava' });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = async () => {
    const count = Math.min(16, Math.max(1, Number(templateCount) || 4));
    setSaving(true);
    try {
      await initCavasTemplate(count);
      setFeedback({ type: 'success', text: `Plantilla aplicada: Creadas ${count} cavas (ID 1 a ${count})` });
      setTemplateDialogOpen(false);
      await loadData();
    } catch (e: any) {
      setFeedback({ type: 'error', text: 'Error al aplicar plantilla de cavas' });
    } finally {
      setSaving(false);
    }
  };

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
            <KitchenIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h5" fontWeight={700}>
              Mantenimiento de Cavas (cavas.json)
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configuración de nombres operativos, IDs Modbus correlativos (1..N), tipo de cámara y setpoints en memoria no volátil LittleFS.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Tooltip title="Recargar lista">
            <IconButton onClick={loadData} disabled={loading} color="inherit">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<TemplateIcon />}
            onClick={() => setTemplateDialogOpen(true)}
            disabled={loading || !isAdmin}
          >
            Plantilla 1..N
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            disabled={loading || !isAdmin}
          >
            Nueva Cava
          </Button>
        </Stack>
      </Stack>

      {/* BANNER SOLO LECTURA SI NO ES ADMIN */}
      {!isAdmin && (
        <Alert severity="info" icon={<LockIcon />} sx={{ mb: 3 }}>
          Modo Consulta (Solo Lectura): Se requieren privilegios de Administrador (TI o Mantenedor) para agregar, modificar o eliminar cavas.
        </Alert>
      )}

      {/* FEEDBACK ALERT */}
      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{ mb: 3 }}
        >
          {feedback.text}
        </Alert>
      )}

      {/* TABLA PRINCIPAL */}
      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID Modbus</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Código / Tag</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nombre / Descripción Operativa</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Controlador (RS-422)</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Control Humedad</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Temp SP</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>HR SP</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Cargando configuración de cavas...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : cavas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography variant="body1" fontWeight={600} color="text.secondary">
                      No hay cavas registradas en cavas.json.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                      Presione "+ Nueva Cava" o "Plantilla 1..N" para generar la estructura inicial.
                    </Typography>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenAdd}>
                      Agregar Primera Cava
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                cavas.map((cava) => (
                  <TableRow key={cava.id} hover>
                    <TableCell>
                      <Chip
                        label={`ID ${cava.modbus_id}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {cava.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {cava.descripcion || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {cava.tipo === 'maduracion' ? (
                        <Chip
                          label="Maduración"
                          size="small"
                          color="warning"
                          icon={<HumIcon sx={{ fontSize: '1rem !important' }} />}
                        />
                      ) : (
                        <Chip
                          label="Conservación"
                          size="small"
                          color="info"
                          icon={<TempIcon sx={{ fontSize: '1rem !important' }} />}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {cava.has_humidity ? (
                        <Chip label="Sí (% HR)" size="small" color="success" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {cava.temp_sp.toFixed(1)} °C
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ±{cava.temp_alarm_delta ?? 2.5}°C
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {cava.has_humidity && cava.hr_sp ? (
                        <Typography variant="body2" fontWeight={600}>
                          {cava.hr_sp.toFixed(0)} %
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isAdmin ? (
                        <>
                          <Tooltip title="Editar Cava">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenEdit(cava)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar Cava">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setCavaToDelete(cava);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Chip
                          icon={<LockIcon sx={{ fontSize: '0.85rem !important' }} />}
                          label="Solo Lectura"
                          size="small"
                          variant="outlined"
                          sx={{ opacity: 0.7 }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* DIÁLOGO CREAR / EDITAR CAVA */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {isEditMode ? `Editar Cava: ${formData.id}` : 'Nueva Cava'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="ID Modbus (Esclavo)"
                type="number"
                fullWidth
                value={formData.modbus_id}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    modbus_id: val === '' ? '' : parseInt(val, 10),
                  });
                }}
                onBlur={() => {
                  if (formData.modbus_id === '' || Number(formData.modbus_id) < 1) {
                    setFormData({ ...formData, modbus_id: 1 });
                  } else if (Number(formData.modbus_id) > 247) {
                    setFormData({ ...formData, modbus_id: 247 });
                  }
                }}
                onFocus={(e) => e.target.select()}
                helperText="Dirección RS-422 (1..99)"
                slotProps={{ htmlInput: { min: 1, max: 247 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Código / Tag"
                fullWidth
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                helperText="Ej. C1, C2, C6A, MAD-1"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Cava</InputLabel>
                <Select
                  value={formData.tipo}
                  label="Tipo de Cava"
                  onChange={(e: SelectChangeEvent) => {
                    const tipo = e.target.value as 'conservacion' | 'maduracion';
                    setFormData({
                      ...formData,
                      tipo,
                      has_humidity: tipo === 'maduracion',
                      temp_sp: tipo === 'maduracion' ? 12.0 : 4.0,
                    });
                  }}
                >
                  <MenuItem value="conservacion">Conservación (KP-100)</MenuItem>
                  <MenuItem value="maduracion">Maduración (KIDEMATIC-970)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Nombre / Descripción Operativa"
                fullWidth
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                helperText="Nombre descriptivo para la supervisión (ej. Cava 6A - Conservación, Maduración Palmita)"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Consigna Temperatura (SP)"
                type="number"
                fullWidth
                value={formData.temp_sp}
                onChange={(e) => setFormData({ ...formData, temp_sp: parseFloat(e.target.value) || 0 })}
                InputProps={{ endAdornment: '°C' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Delta Alarma Temp (+°C)"
                type="number"
                fullWidth
                value={formData.temp_alarm_delta}
                onChange={(e) => setFormData({ ...formData, temp_alarm_delta: parseFloat(e.target.value) || 2.5 })}
                helperText="Desviación máxima permitida"
                InputProps={{ endAdornment: '°C' }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.has_humidity}
                    onChange={(e) => setFormData({ ...formData, has_humidity: e.target.checked })}
                    color="warning"
                  />
                }
                label="Habilitar Control y Medición de Humedad Relativa (% HR)"
              />
            </Grid>

            {formData.has_humidity && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Consigna Humedad Relativa (SP)"
                  type="number"
                  fullWidth
                  value={formData.hr_sp}
                  onChange={(e) => setFormData({ ...formData, hr_sp: parseFloat(e.target.value) || 0 })}
                  InputProps={{ endAdornment: '% HR' }}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Guardar Cava'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO CONFIRMACIÓN ELIMINAR */}
      <Dialog open={deleteDialogOpen} onClose={() => !saving && setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>¿Eliminar Cava {cavaToDelete?.id}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Está seguro de que desea eliminar la cava <strong>{cavaToDelete?.id}</strong> ({cavaToDelete?.descripcion}) de la configuración <code>cavas.json</code>?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            El bus Modbus dejará de sondear esta dirección hasta que se vuelva a agregar.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Eliminar Cava'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO INICIALIZAR PLANTILLA */}
      <Dialog open={templateDialogOpen} onClose={() => !saving && setTemplateDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Inicializar Plantilla de Cavas (1..N)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Esta utilidad genera una secuencia limpia de cavas numeradas correlativamente del <strong>ID 1 al ID N</strong> (C1, C2, C3...).
          </Typography>
          <TextField
            label="Cantidad de Cavas (N)"
            type="number"
            fullWidth
            value={templateCount}
            onChange={(e) => {
              const val = e.target.value;
              setTemplateCount(val === '' ? '' : parseInt(val, 10));
            }}
            onBlur={() => {
              if (templateCount === '' || Number(templateCount) < 1) setTemplateCount(1);
              else if (Number(templateCount) > 16) setTemplateCount(16);
            }}
            onFocus={(e) => e.target.select()}
            helperText="Ingrese un número del 1 al 16"
            slotProps={{ htmlInput: { min: 1, max: 16 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTemplateDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleApplyTemplate} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Aplicar Plantilla'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
