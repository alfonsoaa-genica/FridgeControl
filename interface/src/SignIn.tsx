import React, { FC, useContext, useState } from 'react';
import { ValidateFieldsError } from 'async-validator';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

import {
  Box,
  Fab,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import ForwardIcon from '@mui/icons-material/Forward';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import TranslateIcon from '@mui/icons-material/Translate';
import CheckIcon from '@mui/icons-material/Check';

import * as AuthenticationApi from './api/authentication';
import { PROJECT_NAME } from './api/env';
import { SignInRequest } from './types';
import { ValidatedTextField } from './components';
import { SIGN_IN_REQUEST_VALIDATOR, validate } from './validators';
import { extractErrorMessage, onEnterCallback, updateValue } from './utils';
import { AuthenticationContext } from './contexts/authentication';
import { useThemeMode } from './contexts/theme';

const SignIn: FC = () => {
  const { t, i18n } = useTranslation();
  const authenticationContext = useContext(AuthenticationContext);
  const { enqueueSnackbar } = useSnackbar();
  const { mode, toggleThemeMode } = useThemeMode();

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

  const [signInRequest, setSignInRequest] = useState<SignInRequest>({
    username: '',
    password: ''
  });
  const [processing, setProcessing] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<ValidateFieldsError>();

  const updateLoginRequestValue = updateValue(setSignInRequest);

  const validateAndSignIn = async () => {
    setProcessing(true);
    try {
      await validate(SIGN_IN_REQUEST_VALIDATOR, signInRequest);
      signIn();
    } catch (errors: any) {
      setFieldErrors(errors);
      setProcessing(false);
    }
  };
  const signIn = async () => {
    try {
      const { data: loginResponse } = await AuthenticationApi.signIn(signInRequest);
      authenticationContext.signIn(loginResponse.access_token);
    } catch (error: any) {
      if (error.response?.status === 401) {
        enqueueSnackbar(t('auth.errors.invalid_details'), { variant: "warning" });
      } else {
        enqueueSnackbar(extractErrorMessage(error, t('auth.errors.unexpected')), { variant: "error" });
      }
      setProcessing(false);
    }
  };

  const submitOnEnter = onEnterCallback(signIn);

  return (
    <Box
      display="flex"
      height="100vh"
      flexDirection="column"
      sx={{
        width: '100%',
        position: 'relative',
        backgroundColor: mode === 'dark' ? '#090d16' : '#f8fafc',
        transition: 'background-color 0.3s ease'
      }}
    >
      {/* Controles flotantes superiores: Idioma y Modo Oscuro/Claro */}
      <Box sx={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* Selector de Idioma */}
        <Tooltip title={t('common.SELECT_LANGUAGE')}>
          <Chip
            icon={<TranslateIcon sx={{ fontSize: '18px !important', color: 'inherit !important' }} />}
            label={currentLang === 'es' ? 'ES' : 'EN'}
            onClick={handleOpenLangMenu}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.8rem',
              color: mode === 'dark' ? '#ffffff' : '#1e3a8a',
              backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              py: 2,
              px: 0.5,
              borderRadius: '12px',
              transition: 'all 0.2s ease',
              '&:hover': {
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

        {/* Botón alternar Modo Oscuro / Claro */}
        <Tooltip
          title={mode === 'dark'
            ? t('common.switch_light_mode')
            : t('common.switch_dark_mode')}
        >
          <IconButton
            onClick={toggleThemeMode}
            sx={{
              p: 1.2,
              borderRadius: '12px',
              backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(0, 0, 0, 0.1)',
              color: mode === 'dark' ? '#facc15' : '#1e3a8a',
              boxShadow: mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)'
              }
            }}
          >
            {mode === 'dark' ? (
              <LightModeIcon sx={{ fontSize: 22 }} />
            ) : (
              <DarkModeIcon sx={{ fontSize: 22 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        display="flex"
        flex={1}
        justifyContent="center"
        alignItems="center"
        padding={2}
        sx={{ width: '100%', margin: '0 auto', maxWidth: (theme) => theme.breakpoints.values.sm }}
      >
        <Paper
          sx={(theme) => ({
            textAlign: "center",
            padding: theme.spacing(4),
            width: "100%",
            borderRadius: 3,
            boxShadow: theme.palette.mode === 'dark' ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.08)'
          })}
        >
          {/* Logo Corporativo Genica Superior */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              px: 2.5,
              py: 0.8,
              mb: 2.5,
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
            }}
          >
            <img
              src="/app/LogoGenica.png"
              alt="Genica"
              style={{
                height: '36px',
                width: 'auto',
                display: 'block'
              }}
            />
          </Box>

          {/* Icono Circular Tecnologico Centrado */}
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
            <Box
              component="img"
              src="/app/fridgeControl.png"
              alt={PROJECT_NAME}
              sx={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.45)',
                border: '2px solid rgba(0, 229, 255, 0.6)'
              }}
            />
          </Box>

          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              letterSpacing: '1px',
              color: mode === 'dark' ? '#00e5ff' : 'primary.main',
              mb: 0.5
            }}
          >
            {PROJECT_NAME}
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 500,
              color: 'text.secondary',
              mb: 2.5
            }}
          >
            {t('auth.project_name')}
          </Typography>
          <ValidatedTextField
            fieldErrors={fieldErrors}
            disabled={processing}
            name="username"
            label={t('auth.username')}
            value={signInRequest.username}
            onChange={updateLoginRequestValue}
            margin="normal"
            variant="outlined"
            fullWidth
          />
          <ValidatedTextField
            fieldErrors={fieldErrors}
            disabled={processing}
            type="password"
            name="password"
            label={t('auth.password')}
            value={signInRequest.password}
            onChange={updateLoginRequestValue}
            onKeyDown={submitOnEnter}
            margin="normal"
            variant="outlined"
            fullWidth
          />
          <Fab
            variant="extended"
            color="primary"
            sx={{ mt: 2 }}
            onClick={validateAndSignIn}
            disabled={processing}
          >
            <ForwardIcon sx={{ mr: 1 }} />
            {t('auth.sign_in')}
          </Fab>
        </Paper>
      </Box>
    </Box>
  );
};

export default SignIn;
