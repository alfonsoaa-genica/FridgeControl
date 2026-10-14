import React, { FC, useContext, useState } from "react";
import {
  Box,
  Button,
  Divider,
  Popover,
  Typography,
  Avatar,
  styled,
  TypographyProps,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material';
import KeyIcon from '@mui/icons-material/VpnKey';
import LogoutIcon from '@mui/icons-material/Logout';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

import { AuthenticatedContext } from "../../contexts/authentication";
import { AXIOS } from "../../api/endpoints";

const ItemTypography = styled(Typography)<TypographyProps>({
  maxWidth: '250px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const LayoutAuthMenu: FC = () => {
  const { t } = useTranslation();
  const { me, signOut } = useContext(AuthenticatedContext);
  const { enqueueSnackbar } = useSnackbar();

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Estado para el modal de cambio de contraseña
  const [pwdDialogOpen, setPwdDialogOpen] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [pwdError, setPwdError] = useState<string>('');
  const [submittingPwd, setSubmittingPwd] = useState<boolean>(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = anchorEl ? 'app-menu-popover' : undefined;

  const username = me?.username || 'admin';
  const initial = username.charAt(0).toUpperCase();

  const handleOpenPwdDialog = () => {
    handleClose();
    setNewPassword('');
    setConfirmPassword('');
    setPwdError('');
    setPwdDialogOpen(true);
  };

  const handleClosePwdDialog = () => {
    if (!submittingPwd) {
      setPwdDialogOpen(false);
    }
  };

  const handleSubmitPassword = async () => {
    if (newPassword.length < 4) {
      setPwdError(t('auth.user_menu.password_min_len'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError(t('auth.user_menu.password_mismatch'));
      return;
    }

    setSubmittingPwd(true);
    setPwdError('');

    try {
      const response = await AXIOS.post('/changePassword', { password: newPassword });
      if (response.data && response.data.error) {
        setPwdError(response.data.error);
      } else {
        enqueueSnackbar(t('auth.user_menu.password_changed'), { variant: 'success' });
        setPwdDialogOpen(false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || t('common.error');
      setPwdError(msg);
    } finally {
      setSubmittingPwd(false);
    }
  };

  return (
    <>
      <Button
        id="open-auth-menu"
        aria-describedby={id}
        color="inherit"
        onClick={handleClick}
        sx={{
          textTransform: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 1.2,
          px: 1.5,
          py: 0.5,
          borderRadius: 3,
          transition: 'background-color 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: 'secondary.main',
            color: 'secondary.contrastText',
            fontSize: '1rem',
            fontWeight: 700,
            boxShadow: 1
          }}
        >
          {initial}
        </Avatar>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: 'inherit',
            letterSpacing: 0.3
          }}
        >
          {username}
        </Typography>
      </Button>

      <Popover
        id="app-menu-popover"
        sx={{ mt: 1 }}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box display="flex" flexDirection="row" alignItems="center" p={2.5}>
          <Avatar
            sx={{
              width: 58,
              height: 58,
              bgcolor: 'primary.main',
              fontSize: '1.6rem',
              fontWeight: 700,
              boxShadow: 2
            }}
          >
            {initial}
          </Avatar>
          <Box pl={2}>
            <ItemTypography variant="h6" fontWeight="bold">
              {username}
            </ItemTypography>
            <ItemTypography variant="body2" color="text.secondary">
              {me?.admin ? t('auth.user_menu.admin') : t('auth.user_menu.guest')}
            </ItemTypography>
          </Box>
        </Box>
        <Divider />
        <Box p={1.5} display="flex" flexDirection="column" gap={1}>
          <Button
            variant="outlined"
            fullWidth
            color="primary"
            startIcon={<KeyIcon />}
            onClick={handleOpenPwdDialog}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {t('auth.user_menu.change_password')}
          </Button>

          <Button
            variant="contained"
            fullWidth
            color="primary"
            startIcon={<LogoutIcon />}
            onClick={() => signOut(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {t('auth.user_menu.sign_out')}
          </Button>
        </Box>
      </Popover>

      {/* Dialogo para Cambio de Contraseña */}
      <Dialog
        open={pwdDialogOpen}
        onClose={handleClosePwdDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('auth.user_menu.change_password')} ({username})
        </DialogTitle>
        <DialogContent dividers>
          {pwdError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {pwdError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label={t('auth.user_menu.new_password')}
            type="password"
            fullWidth
            variant="outlined"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submittingPwd}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label={t('auth.user_menu.confirm_password')}
            type="password"
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submittingPwd}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClosePwdDialog} disabled={submittingPwd} color="inherit">
            {t('auth.user_menu.cancel')}
          </Button>
          <Button
            onClick={handleSubmitPassword}
            variant="contained"
            color="primary"
            disabled={submittingPwd || !newPassword}
            startIcon={submittingPwd ? <CircularProgress size={16} color="inherit" /> : <KeyIcon />}
          >
            {t('auth.user_menu.save_password')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LayoutAuthMenu;
