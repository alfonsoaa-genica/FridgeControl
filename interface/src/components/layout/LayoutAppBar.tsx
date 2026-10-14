import React, { FC, useContext, useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import TranslateIcon from '@mui/icons-material/Translate';
import CheckIcon from '@mui/icons-material/Check';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { useTranslation } from 'react-i18next';

import { FeaturesContext } from '../../contexts/features';
import { useThemeMode } from '../../contexts/theme';
import LayoutAuthMenu from './LayoutAuthMenu';

export const DRAWER_WIDTH = 280;

interface LayoutAppBarProps {
  title: string;
  onToggleDrawer: () => void;
}

const LayoutAppBar: FC<LayoutAppBarProps> = ({ title, onToggleDrawer }) => {
  const { features } = useContext(FeaturesContext);
  const { mode, toggleThemeMode } = useThemeMode();
  const { t, i18n } = useTranslation();

  const [langAnchorEl, setLangAnchorEl] = useState<null | HTMLElement>(null);
  const langMenuOpen = Boolean(langAnchorEl);

  const currentLang = (i18n.language || 'es').substring(0, 2).toLowerCase();

  const handleOpenLangMenu = (event: React.MouseEvent<HTMLElement>) => {
    setLangAnchorEl(event.currentTarget);
  };

  const handleCloseLangMenu = () => {
    setLangAnchorEl(null);
  };

  const handleSelectLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    try {
      localStorage.setItem('i18nextLng', langCode);
    } catch {
      // Ignorar restricciones
    }
    handleCloseLangMenu();
  };

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { md: `${DRAWER_WIDTH}px` },
        boxShadow: 'none',
        backgroundColor: mode === 'dark' ? '#090d16' : '#1e3a8a',
        borderBottom: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.1)'
      }}
    >
      <Toolbar
        sx={{
          backgroundColor: mode === 'dark' ? '#090d16' : '#1e3a8a'
        }}
      >
        <IconButton
          color="inherit"
          aria-label={t('common.open_drawer')}
          edge="start"
          onClick={onToggleDrawer}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ color: '#ffffff', fontWeight: 700 }}>
          {title}
        </Typography>

        <Box flexGrow={1} />

        {/* Conmutador de Idioma (ES / EN) */}
        <Tooltip title={t('common.SELECT_LANGUAGE')}>
          <Chip
            icon={<TranslateIcon sx={{ fontSize: '18px !important', color: 'inherit !important' }} />}
            label={currentLang === 'es' ? 'ES' : 'EN'}
            onClick={handleOpenLangMenu}
            size="small"
            sx={{
              mr: 1.5,
              fontWeight: 700,
              fontSize: '0.8rem',
              color: '#ffffff',
              backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.18)',
              border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.35)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.28)',
                transform: 'scale(1.05)'
              }
            }}
          />
        </Tooltip>

        <Menu
          anchorEl={langAnchorEl}
          open={langMenuOpen}
          onClose={handleCloseLangMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={() => handleSelectLanguage('es')} selected={currentLang === 'es'}>
            <ListItemIcon>
              {currentLang === 'es' ? <CheckIcon fontSize="small" color="primary" /> : <Box width={20} />}
            </ListItemIcon>
            <ListItemText primary={t('common.SPANISH')} />
          </MenuItem>
          <MenuItem onClick={() => handleSelectLanguage('en')} selected={currentLang === 'en'}>
            <ListItemIcon>
              {currentLang === 'en' ? <CheckIcon fontSize="small" color="primary" /> : <Box width={20} />}
            </ListItemIcon>
            <ListItemText primary={t('common.ENGLISH')} />
          </MenuItem>
        </Menu>

        {/* Conmutador de Modo Oscuro / Claro */}
        <Tooltip
          title={mode === 'dark'
            ? t('common.switch_light_mode')
            : t('common.switch_dark_mode')}
        >
          <IconButton
            onClick={toggleThemeMode}
            color="inherit"
            size="small"
            sx={{
              mr: 1.5,
              p: 0.8,
              borderRadius: '8px',
              backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.18)',
              border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.35)',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.28)',
                transform: 'scale(1.05)'
              }
            }}
          >
            {mode === 'dark' ? (
              <LightModeIcon sx={{ fontSize: 20, color: '#facc15' }} />
            ) : (
              <DarkModeIcon sx={{ fontSize: 20, color: '#ffffff' }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Conmutador de Pantalla Completa (Tablets / Celulares / Kiosco) */}
        <Tooltip title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}>
          <IconButton
            onClick={toggleFullscreen}
            color="inherit"
            size="small"
            sx={{
              mr: 1.5,
              p: 0.8,
              borderRadius: '8px',
              backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.18)',
              border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.35)',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.28)',
                transform: 'scale(1.05)'
              }
            }}
          >
            {isFullscreen ? (
              <FullscreenExitIcon sx={{ fontSize: 20, color: '#ffffff' }} />
            ) : (
              <FullscreenIcon sx={{ fontSize: 20, color: '#ffffff' }} />
            )}
          </IconButton>
        </Tooltip>

        {features.security && <LayoutAuthMenu />}

        {/* Logo Corporativo Genica */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.95)' : '#ffffff',
            borderRadius: '6px',
            px: 1.2,
            py: 0.4,
            ml: 1.5,
            height: '36px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <img
            src="/app/LogoGenica.png"
            alt="Genica"
            style={{
              height: '100%',
              maxHeight: '28px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default LayoutAppBar;
