import React, { FC, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table, TableBody, TableCell, TableHead, TableRow, IconButton,
  Button, CircularProgress, TableContainer, Paper, Box,
  Tabs, Tab, Typography, Chip, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Alert
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import RefreshIcon from '@mui/icons-material/Refresh';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import MemoryIcon from '@mui/icons-material/Memory';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import { SectionContent, MessageBox, FormLoader } from '../../components';

interface FileInfo {
  name: string;
  size: number;
  storage?: 'littlefs' | 'sd';
}

interface SdCardStatus {
  present: boolean;
  mounted: boolean;
  capacity_ok: boolean;
  card_type: string;
  status: string;
  total_bytes: number;
  used_bytes: number;
  total_mb: number;
  used_mb: number;
}

const FileManager: FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'littlefs' | 'sd'>('littlefs');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sdStatus, setSdStatus] = useState<SdCardStatus | null>(null);
  const [sdOperating, setSdOperating] = useState(false);
  const [openFormatDialog, setOpenFormatDialog] = useState(false);

  const loadSdStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/files/sd/status');
      if (res.ok) {
        const data: SdCardStatus = await res.json();
        setSdStatus(data);
      }
    } catch (e) {
      console.warn("No se pudo obtener estado de la MicroSD:", e);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      await loadSdStatus();
      const res = await fetch(`/api/files/list?storage=${activeTab}`);
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error listando archivos:", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadSdStatus]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {return;}
    const formData = new FormData();
    formData.append("file", file, file.name);
    setUploading(true);
    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (res.ok) {
        loadFiles();
      } else {
        alert(t('system.file_manager.toast_upload_error'));
      }
    } catch (e) {
      alert(t('system.file_manager.toast_upload_error') + ": " + e);
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = (name: string) => {
    window.location.href = `/api/files/download?name=${encodeURIComponent(name)}`;
  };

  const deleteFile = async (path: string) => {
    const fileName = path.split('/').pop() || '';
    const esCritico = ['usuarios.json', 'equipos.json', 'last_state.json', 'current.jsonl'].includes(fileName);

    const confirmMsg = esCritico
      ? t('system.file_manager.toast_delete_critical', {
        name: fileName,
        defaultValue: `⚠️ ADVERTENCIA CRÍTICA: Borrar "${fileName}" es un archivo esencial para el `
          + 'funcionamiento o auditoría.\n¿Desea continuar?'
      })
      : t('system.file_manager.toast_delete_confirm', {
        name: fileName,
        defaultValue: `¿Está seguro de eliminar el archivo "${fileName}"?`
      });

    if (window.confirm(confirmMsg)) {
      try {
        const res = await fetch(`/api/files/delete?name=${encodeURIComponent(path)}`, { method: 'DELETE' });
        if (res.ok) {
          loadFiles();
        } else {
          const data = await res.json();
          alert(data.error || t('common.error'));
        }
      } catch (e) {
        alert(t('common.error') + e);
      }
    }
  };

  // Mantenimiento de MicroSD: Formatear
  const handleFormatSd = async () => {
    setOpenFormatDialog(false);
    setSdOperating(true);
    try {
      const res = await fetch('/api/files/sd/format', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(t('system.file_manager.toast_format_success'));
        await loadFiles();
      } else {
        const errorDetail = data.message || t('system.file_manager.toast_format_error');
        alert(`❌ ${t('common.error')}: ${errorDetail}`);
      }
    } catch (e) {
      alert(`${t('common.error')}: ${e}`);
    } finally {
      setSdOperating(false);
    }
  };

  // Mantenimiento de MicroSD: Remontar
  const handleMountSd = async () => {
    setSdOperating(true);
    try {
      const res = await fetch('/api/files/sd/mount', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.mounted) {
        alert(t('system.file_manager.toast_remount_success'));
        await loadFiles();
      } else {
        alert(`⚠️ ${data.card_status || t('common.unknown')}`);
        await loadSdStatus();
      }
    } catch (e) {
      alert(`${t('common.error')}: ${e}`);
    } finally {
      setSdOperating(false);
    }
  };

  const filteredFiles = files.filter((f) => {
    if (activeTab === 'sd') {
      return f.name.startsWith('/sd') || f.storage === 'sd';
    }
    return !f.name.startsWith('/sd') && f.storage !== 'sd';
  });

  return (
    <SectionContent title={t('system.file_manager.title')}>
      <MessageBox
        level="info"
        message={t('system.file_manager.info')}
        my={2}
      />

      {/* Tarjeta de Resumen y Estado de la MicroSD */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <SdStorageIcon color={sdStatus?.mounted ? 'success' : (sdStatus?.present ? 'warning' : 'disabled')} sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {t('system.file_manager.sd_card_title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {sdStatus?.mounted ? (
                    t(
                      'system.file_manager.sd_fat_info',
                      'Formato FAT • Tipo: {{card_type}} • Capacidad: {{capacity}} GB ({{used}} MB usados)',
                      {
                        card_type: sdStatus.card_type,
                        capacity: (sdStatus.total_mb / 1024).toFixed(2),
                        used: sdStatus.used_mb.toFixed(1)
                      }
                    )
                  ) : sdStatus?.present ? (
                    t('system.file_manager.sd_present_need_format')
                  ) : (
                    t('system.file_manager.sd_not_present')
                  )}
                </Typography>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              {sdStatus?.mounted ? (
                <Chip
                  icon={<CheckCircleIcon />}
                  label={sdStatus.capacity_ok
                    ? t('system.file_manager.chip_sd_ok')
                    : t('system.file_manager.chip_sd_small')}
                  color={sdStatus.capacity_ok ? "success" : "warning"}
                  size="small"
                  variant="outlined"
                />
              ) : sdStatus?.present ? (
                <Chip
                  icon={<WarningAmberIcon />}
                  label={t('system.file_manager.chip_sd_need_format')}
                  color="warning"
                  size="small"
                />
              ) : (
                <Chip
                  icon={<ErrorOutlineIcon />}
                  label={t('system.file_manager.chip_sd_none')}
                  color="default"
                  size="small"
                />
              )}

              {/* Botones de Mantenimiento de MicroSD */}
              <Button
                variant="outlined"
                size="small"
                startIcon={<BuildIcon />}
                onClick={handleMountSd}
                disabled={sdOperating}
              >
                {sdOperating ? t('system.file_manager.btn_remounting') : t('system.file_manager.btn_remount')}
              </Button>
              <Button
                variant="contained"
                color="warning"
                size="small"
                onClick={() => setOpenFormatDialog(true)}
                disabled={sdOperating}
              >
                {t('system.file_manager.btn_format')}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Selector de Pestañas de Almacenamiento */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab
            value="littlefs"
            icon={<MemoryIcon />}
            iconPosition="start"
            label={t('system.file_manager.tab_littlefs')}
            sx={{ fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            value="sd"
            icon={<SdStorageIcon />}
            iconPosition="start"
            label={t('system.file_manager.tab_sd')}
            sx={{ fontWeight: 600, minHeight: 48 }}
          />
        </Tabs>
      </Box>

      {/* Barra de Acciones */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={loadFiles} color="primary" title={t('system.file_manager.btn_refresh')}>
            <RefreshIcon />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            {t('system.file_manager.files_count', {
              count: filteredFiles.length,
              storage: activeTab === 'littlefs' ? 'LittleFS' : 'MicroSD'
            })}
          </Typography>
        </Box>

        {activeTab === 'littlefs' && (
          <Button
            variant="contained"
            component="label"
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
            disabled={uploading}
            size="small"
          >
            {uploading
              ? t('system.file_manager.uploading')
              : t('system.file_manager.upload_btn')}
            <input type="file" hidden onChange={handleUpload} />
          </Button>
        )}
      </Box>

      {/* Alerta contextual en pestaña MicroSD si no está montada */}
      {activeTab === 'sd' && !sdStatus?.mounted && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t(
            'system.file_manager.sd_unmounted_warning',
            'La tarjeta MicroSD no se encuentra montada actualmente. Puede insertar una tarjeta de al menos 8GB y presionar "Remontar", '
              + 'o presionar "Formatear SD" para inicializar la partición FAT32.'
          )}
        </Alert>
      )}

      {/* Tabla de Archivos */}
      {loading ? (
        <FormLoader />
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: 480, overflowY: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>{t('system.file_manager.col_name')}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{t('system.file_manager.col_size')}</TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 'bold', width: 120 }}
                >
                  {t('system.file_manager.col_actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow key={file.name} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {file.name}
                  </TableCell>
                  <TableCell>
                    {file.size > 1024 * 1024
                      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                      : `${(file.size / 1024).toFixed(1)} KB (${file.size.toLocaleString()} bytes)`}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={() => downloadFile(file.name)}
                      color="primary"
                      size="small"
                      title={t('system.file_manager.action_download')}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      onClick={() => deleteFile(file.name)}
                      color="error"
                      size="small"
                      title={t('system.file_manager.action_delete')}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredFiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {t('system.file_manager.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Diálogo de Confirmación para Formateo de MicroSD */}
      <Dialog
        open={openFormatDialog}
        onClose={() => setOpenFormatDialog(false)}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          {t('system.file_manager.dialog_format_title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('system.file_manager.dialog_format_confirm')}
            <br /><br />
            ⚠️{' '}
            <b>
              {t(
                'system.file_manager.dialog_format_warning',
                'Todos los registros y bitácoras históricas almacenadas en la tarjeta MicroSD '
                  + 'serán eliminados permanentemente. Esta acción no se puede deshacer.'
              )}
            </b>
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenFormatDialog(false)} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleFormatSd} color="warning" variant="contained" autoFocus>
            {t('system.file_manager.dialog_format_btn')}
          </Button>
        </DialogActions>
      </Dialog>
    </SectionContent>
  );
};

export default FileManager;
