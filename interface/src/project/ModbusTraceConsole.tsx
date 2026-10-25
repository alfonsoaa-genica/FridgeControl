import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useTranslation } from 'react-i18next';

type TraceDirection = 'RX' | 'TX';
type BusFilter = 'all' | 'fridgeio' | 'kide';
type DirectionFilter = 'all' | TraceDirection;

interface ModbusTraceMessage {
  type: 'MODBUS_TRACE';
  bus: string;
  direction: TraceDirection;
  length: number;
  hex: string;
  overflow: boolean;
}

interface TraceEntry extends ModbusTraceMessage {
  id: number;
  receivedAt: number;
}

const MAX_TRACE_ENTRIES = 500;

export const ModbusTraceConsole: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TraceEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'paused'>('connecting');
  const [busFilter, setBusFilter] = useState<BusFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [isMonitoring, setIsMonitoring] = useState(true);
  const entriesEndRef = useRef<HTMLDivElement | null>(null);
  const nextEntryId = useRef(0);

  useEffect(() => {
    if (!isMonitoring) {
      setConnectionStatus('paused');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/modbus-trace`);
    let active = true;

    ws.onopen = () => {
      if (active) setConnectionStatus('connected');
    };
    ws.onclose = () => {
      if (active) setConnectionStatus('disconnected');
    };
    ws.onerror = () => {
      if (active) setConnectionStatus('disconnected');
    };
    ws.onmessage = (event) => {
      if (!active) return;
      try {
        const message = JSON.parse(event.data) as Partial<ModbusTraceMessage>;
        if (
          message.type !== 'MODBUS_TRACE' ||
          typeof message.bus !== 'string' ||
          (message.direction !== 'RX' && message.direction !== 'TX') ||
          typeof message.length !== 'number' ||
          typeof message.hex !== 'string' ||
          typeof message.overflow !== 'boolean'
        ) {
          return;
        }

        const entry: TraceEntry = {
          type: 'MODBUS_TRACE',
          bus: message.bus,
          direction: message.direction,
          length: message.length,
          hex: message.hex,
          overflow: message.overflow,
          id: nextEntryId.current++,
          receivedAt: Date.now(),
        };
        setEntries((current) => [...current.slice(-(MAX_TRACE_ENTRIES - 1)), entry]);
      } catch (error) {
        console.error('Error procesando trama de diagnóstico Modbus:', error);
      }
    };

    return () => {
      active = false;
      ws.close();
    };
  }, [isMonitoring]);

  useEffect(() => {
    if (isMonitoring) entriesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, isMonitoring]);

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const matchesBus = busFilter === 'all' ||
      (busFilter === 'fridgeio' ? entry.bus.includes('FridgeIO') : entry.bus.includes('KIDE'));
    const matchesDirection = directionFilter === 'all' || entry.direction === directionFilter;
    return matchesBus && matchesDirection;
  }), [entries, busFilter, directionFilter]);

  const statusLabel = connectionStatus === 'connected'
    ? t('diagnostic.traceConnected')
    : connectionStatus === 'connecting'
      ? t('diagnostic.traceConnecting')
      : connectionStatus === 'paused'
        ? t('diagnostic.tracePaused')
        : t('diagnostic.traceDisconnected');

  return (
    <Card sx={{ mt: 3, borderRadius: 2 }}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t('diagnostic.traceTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('diagnostic.traceSubtitle')}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={statusLabel}
            color={connectionStatus === 'connected' ? 'success' : connectionStatus === 'disconnected' ? 'error' : 'default'}
            variant="outlined"
          />
        </Stack>

        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <ButtonGroup size="small" variant="outlined">
              <Button variant={busFilter === 'all' ? 'contained' : 'outlined'} onClick={() => setBusFilter('all')}>
                {t('diagnostic.traceAllBuses')}
              </Button>
              <Button variant={busFilter === 'fridgeio' ? 'contained' : 'outlined'} onClick={() => setBusFilter('fridgeio')}>
                FridgeIO
              </Button>
              <Button variant={busFilter === 'kide' ? 'contained' : 'outlined'} onClick={() => setBusFilter('kide')}>
                KIDE
              </Button>
            </ButtonGroup>
            <ButtonGroup size="small" variant="outlined">
              <Button variant={directionFilter === 'all' ? 'contained' : 'outlined'} onClick={() => setDirectionFilter('all')}>
                {t('diagnostic.traceAllDirections')}
              </Button>
              <Button color="success" variant={directionFilter === 'RX' ? 'contained' : 'outlined'} onClick={() => setDirectionFilter('RX')}>
                RX
              </Button>
              <Button color="warning" variant={directionFilter === 'TX' ? 'contained' : 'outlined'} onClick={() => setDirectionFilter('TX')}>
                TX
              </Button>
            </ButtonGroup>
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              size="small"
              variant="outlined"
              startIcon={isMonitoring ? <PauseIcon /> : <PlayArrowIcon />}
              onClick={() => setIsMonitoring((current) => !current)}
            >
              {isMonitoring ? t('diagnostic.tracePauseMonitoring') : t('diagnostic.traceResumeMonitoring')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<DeleteSweepIcon />}
              onClick={() => setEntries([])}
            >
              {t('diagnostic.traceClear')}
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            height: 360,
            overflow: 'auto',
            p: 1.5,
            bgcolor: '#0d1117',
            color: '#e6edf3',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
          }}
        >
          {filteredEntries.length === 0 ? (
            <Typography color="text.secondary">
              {isMonitoring ? t('diagnostic.traceEmpty') : t('diagnostic.tracePaused')}
            </Typography>
          ) : filteredEntries.map((entry) => (
            <Box
              key={entry.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr auto auto', md: '100px 1fr auto auto' },
                gap: 1,
                py: 0.4,
                borderBottom: '1px solid #21262d',
              }}
            >
              <Typography component="span" sx={{ color: '#8b949e', display: { xs: 'none', md: 'block' } }}>
                {new Date(entry.receivedAt).toLocaleTimeString()}
              </Typography>
              <Typography component="span" sx={{ color: '#8b949e', overflowWrap: 'anywhere' }}>
                {entry.bus}: <Box component="span" sx={{ color: entry.direction === 'RX' ? '#3fb950' : '#e3b341', fontWeight: 700 }}>{entry.direction}</Box>
                {'  '}
                <Box component="span" sx={{ color: '#c9d1d9' }}>{entry.hex}{entry.overflow ? ' …' : ''}</Box>
              </Typography>
              <Typography component="span" sx={{ color: '#8b949e', whiteSpace: 'nowrap' }}>
                {entry.length} B
              </Typography>
            </Box>
          ))}
          <div ref={entriesEndRef} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {t('diagnostic.traceEntryCount', { count: entries.length })}
        </Typography>
      </CardContent>
    </Card>
  );
};
