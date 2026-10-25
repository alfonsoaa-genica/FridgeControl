import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Slider,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Divider,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Tune as AlarmTuneIcon,
  MeetingRoom as DoorIcon,
  TouchApp as AckIcon,
  Thermostat as TempIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useLayoutTitle } from '../components/layout/context';
import { fetchCavas, updateCavaAlarmConfig } from './api/cavas';
import { CavaState } from './types/cavas';

export const AlarmsConfigPage: React.FC = () => {
  const { t } = useTranslation();
  useLayoutTitle(t('cavas.alarmsTitle', 'Alarmas y Tiempos ISA-18.2'));

  const [cavas, setCavas] = useState<CavaState[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form values for each cava indexed by cava.id
  const [formData, setFormData] = useState<{
    [cavaId: string]: {
      door_grace_sec: number;
      door_buzzer_sec: number;
      temp_alarm_delta: number;
      temp_alarm_delay_sec: number;
    };
  }>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCavas();
      setCavas(data);

      const initialForm: typeof formData = {};
      data.forEach((c) => {
        initialForm[c.id] = {
          door_grace_sec: c.door_grace_sec ?? 90,
          door_buzzer_sec: c.door_buzzer_sec ?? 180,
          temp_alarm_delta: c.temp_alarm_delta ?? 2.5,
          temp_alarm_delay_sec: c.temp_alarm_delay_sec ?? 300,
        };
      });
      setFormData(initialForm);
    } catch (err) {
      console.error('Error cargando cavas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentCava = cavas[selectedTabIndex];
  const currentValues = currentCava ? formData[currentCava.id] : null;

  const handleFieldChange = (field: keyof typeof formData[string], val: number) => {
    if (!currentCava) return;
    setFormData((prev) => ({
      ...prev,
      [currentCava.id]: {
        ...prev[currentCava.id],
        [field]: val,
      },
    }));
  };

  const handleSaveCurrent = async () => {
    if (!currentCava || !currentValues) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      await updateCavaAlarmConfig(currentCava.id, currentValues);
      setSaveStatus({
        type: 'success',
        text: `Parámetros ISA-18.2 para ${currentCava.descripcion || currentCava.id} guardados con éxito en memoria no volátil.`,
      });
      await loadData();
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        text: err?.response?.data?.error || 'Error al guardar la configuración de alarmas.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlarmTuneIcon color="primary" /> Configuración de Alarmas ISA-18.2
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión de ciclo de vida de alarmas industriales: pre-avisos, disparo de sirena, silencio por acuse (ACK) y tolerancias de proceso.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading || saving}>
            Actualizar
          </Button>
        </Stack>
      </Stack>

      {/* Info Card: Filosofía ISA-18.2 */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'info.light',
          bgcolor: 'info.lighter',
        }}
      >
        <Typography variant="subtitle2" fontWeight="bold" color="info.dark" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <InfoIcon fontSize="small" /> Secuencia Estándar de Alarma ISA-18.2 para Cavas
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary">1. PRE-ALARMA PUERTA</Typography>
              <Typography variant="body2" fontWeight="600">Por defecto: 90 segundos</Typography>
              <Typography variant="caption" color="text.secondary">Luz Ámbar fija. Aviso al operario de carga/descarga.</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight="bold" color="error.main">2. ALARMA CRÍTICA</Typography>
              <Typography variant="body2" fontWeight="600">Por defecto: 180 segundos</Typography>
              <Typography variant="caption" color="text.secondary">Sirena acústica activa + Luz Roja. Invasión térmica inminente.</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight="bold" color="warning.main">3. ACUSE (ACK / SILENCIO)</Typography>
              <Typography variant="body2" fontWeight="600">Hasta normalizar la causa</Typography>
              <Typography variant="caption" color="text.secondary">Silencia el buzzer y fija la luz de alarma; el reconocimiento se libera al desaparecer la causa.</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ p: 1.2, bgcolor: 'background.paper', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight="bold" color="primary.main">4. DESVIACIÓN TÉRMICA</Typography>
              <Typography variant="body2" fontWeight="600">SP + 2.5°C (Filtro 300s)</Typography>
              <Typography variant="caption" color="text.secondary">Confirma que no es un falso transitorio de desescarche antes de sonar.</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {saveStatus && (
        <Alert severity={saveStatus.type} sx={{ mb: 3 }} onClose={() => setSaveStatus(null)}>
          {saveStatus.text}
        </Alert>
      )}

      {loading && cavas.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : cavas.length === 0 ? (
        <Alert severity="warning" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            No hay cavas detectadas o configuradas
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            El sistema aún no tiene cámaras registradas en la memoria del controlador. Puedes descubrirlas automáticamente mediante el escáner Modbus RS-485.
          </Typography>
          <Button variant="contained" href="/cavas/diagnostic" color="warning">
            Ir a Diagnóstico y Escaneo Modbus
          </Button>
        </Alert>
      ) : (
        <Box>
          {/* Tabs para seleccionar la cava */}
          <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs
              value={selectedTabIndex}
              onChange={(_, val) => {
                setSelectedTabIndex(val);
                setSaveStatus(null);
              }}
              variant="scrollable"
              scrollButtons="auto"
            >
              {cavas.map((c) => (
                <Tab
                  key={c.id}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{c.descripcion || c.id}</span>
                      <Chip
                        label={c.online ? 'ONLINE' : 'OFFLINE'}
                        size="small"
                        color={c.online ? 'success' : 'default'}
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    </Stack>
                  }
                />
              ))}
            </Tabs>
          </Paper>

          {/* Formulario de Configuración de la Cava Seleccionada */}
          {currentCava && currentValues && (
            <Card elevation={0} sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} mb={3} spacing={1}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {currentCava.descripcion || `Cava ${currentCava.id}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Esclavo Modbus ID: <b>{currentCava.modbus_id}</b> • Tipo: <b>{currentCava.tipo === 'conservacion' ? 'Conservación' : 'Maduración'}</b> • Consigna Temp: <b>{currentCava.temp_sp?.toFixed(1)} °C</b>
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                    onClick={handleSaveCurrent}
                    disabled={saving}
                    sx={{ px: 3, py: 1 }}
                  >
                    {saving ? 'Guardando...' : 'Guardar Ajustes ISA-18.2'}
                  </Button>
                </Stack>

                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={4}>
                  {/* Bloque Puerta Abierta */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <DoorIcon color="warning" /> Temporizaciones de Puerta Abierta
                      </Typography>

                      {/* 1. Pre-alarma (door_grace_sec) */}
                      <Box sx={{ mb: 3 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight="600">
                            Tiempo de Gracia de Puerta (Pre-Alarma / Ámbar)
                          </Typography>
                          <Typography variant="h6" color="warning.main" fontWeight="bold">
                            {currentValues.door_grace_sec} s
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                          Segundos de puerta abierta continua antes de encender la torre ámbar de advertencia (Normal: 90s).
                        </Typography>
                        <Slider
                          value={currentValues.door_grace_sec}
                          min={15}
                          max={300}
                          step={5}
                          valueLabelDisplay="auto"
                          onChange={(_, val) => handleFieldChange('door_grace_sec', val as number)}
                        />
                      </Box>

                      {/* 2. Sirena Crítica (door_buzzer_sec) */}
                      <Box sx={{ mb: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight="600">
                            Tiempo de Puerta Abierta Crítico (Disparo de Sirena)
                          </Typography>
                          <Typography variant="h6" color="error.main" fontWeight="bold">
                            {currentValues.door_buzzer_sec} s ({Math.round(currentValues.door_buzzer_sec / 60)} min)
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                          Segundos de puerta abierta antes de sonar la sirena continua (Normal: 180s / 3 minutos).
                        </Typography>
                        <Slider
                          value={currentValues.door_buzzer_sec}
                          min={30}
                          max={600}
                          step={10}
                          color="error"
                          valueLabelDisplay="auto"
                          onChange={(_, val) => handleFieldChange('door_buzzer_sec', val as number)}
                        />
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Comportamiento de ACK */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <AckIcon color="info" /> Reconocimiento por pulsador ACK
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ACK reconoce solo la cava asociada al pulsador. Mientras la causa siga activa, silencia el buzzer y mantiene fija la luz de alarma. El reconocimiento se borra cuando el Maestro informa que la condición se normalizó.
                      </Typography>
                    </Paper>
                  </Grid>

                  {/* Bloque Tolerancias Térmicas ISA-18.2 */}
                  <Grid size={{ xs: 12 }}>
                    <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <TempIcon color="error" /> Tolerancias y Retardo de Alarma por Temperatura
                      </Typography>

                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" fontWeight="600">
                              Delta Máximo de Temperatura Admisible (ΔT)
                            </Typography>
                            <Typography variant="h6" color="error.main" fontWeight="bold">
                              +{currentValues.temp_alarm_delta.toFixed(1)} °C
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                            Diferencia sobre la Consigna (SP) requerida para generar estado de alarma crítica.
                          </Typography>
                          <Slider
                            value={currentValues.temp_alarm_delta}
                            min={0.5}
                            max={6.0}
                            step={0.5}
                            valueLabelDisplay="auto"
                            onChange={(_, val) => handleFieldChange('temp_alarm_delta', val as number)}
                          />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" fontWeight="600">
                              Retardo de Confirmación de Alarma Térmica
                            </Typography>
                            <Typography variant="h6" color="text.primary" fontWeight="bold">
                              {currentValues.temp_alarm_delay_sec} s ({Math.round(currentValues.temp_alarm_delay_sec / 60)} min)
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                            Filtro de persistencia: la temperatura debe mantenerse fuera de rango este tiempo antes de activar alarma (Normal: 300s / 5 min).
                          </Typography>
                          <Slider
                            value={currentValues.temp_alarm_delay_sec}
                            min={30}
                            max={1200}
                            step={30}
                            valueLabelDisplay="auto"
                            onChange={(_, val) => handleFieldChange('temp_alarm_delay_sec', val as number)}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
};
export default AlarmsConfigPage;
