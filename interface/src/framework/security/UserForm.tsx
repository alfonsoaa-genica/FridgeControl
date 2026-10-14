import React, { FC, useState } from 'react';
import Schema, { ValidateFieldsError } from 'async-validator';
import { useTranslation } from "react-i18next";
import {
  Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  Box, Typography, Avatar, Stack
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { User } from '../../types';
import { BlockFormControlLabel, ValidatedPasswordField, ValidatedTextField } from '../../components';
import { validate } from '../../validators';
import { updateValue } from '../../utils';

interface UserFormProps {
  creating: boolean;
  validator: Schema;
  user?: User;
  setUser: React.Dispatch<React.SetStateAction<User | undefined>>;
  onDoneEditing: () => void;
  onCancelEditing: () => void;
}

const UserForm: FC<UserFormProps> = ({ creating, validator, user, setUser, onDoneEditing, onCancelEditing }) => {
  const { t } = useTranslation();
  const updateFormValue = updateValue(setUser);
  const [fieldErrors, setFieldErrors] = useState<ValidateFieldsError>();

  const handleCancel = () => {
    setFieldErrors(undefined);
    onCancelEditing();
  };

  const validateAndDone = async () => {
    if (user) {
      try {
        setFieldErrors(undefined);
        await validate(validator, user);
        onDoneEditing();
      } catch (errors: any) {
        setFieldErrors(errors);
      }
    }
  };

  return (
    <Dialog
      onClose={handleCancel}
      open={!!user}
      fullWidth
      maxWidth="xs"
    >
      {user && (
        <>
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: creating ? 'secondary.main' : 'primary.main' }}>
                {creating ? <PersonAddIcon /> : <EditIcon />}
              </Avatar>
              <Typography variant="h6">
                {creating
                  ? t('common.ADD_ENTITY', { entity: t('security.users.user_single') })
                  : `${t('common.EDIT')} ${user.username}`}
              </Typography>
            </Stack>
          </DialogTitle>

          <DialogContent dividers sx={{ py: 2 }}>
            <ValidatedTextField
              fieldErrors={fieldErrors}
              name="username"
              label={t('security.fields.username')}
              fullWidth
              variant="outlined"
              value={user.username}
              disabled={!creating}
              onChange={updateFormValue}
              margin="normal"
            />
            <ValidatedPasswordField
              fieldErrors={fieldErrors}
              name="password"
              label={t('security.fields.password')}
              fullWidth
              variant="outlined"
              value={user.password}
              onChange={updateFormValue}
              margin="normal"
              autoComplete="new-password"
            />
            <Box
              sx={{
                mt: 2,
                p: 2,
                borderRadius: 2,
                bgcolor: user.admin ? 'action.selected' : 'transparent',
                border: '1px dashed',
                borderColor: user.admin ? 'primary.main' : 'divider',
                transition: 'all 0.3s'
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <AdminPanelSettingsIcon color={user.admin ? 'primary' : 'action'} />
                <BlockFormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox
                      name="admin"
                      checked={user.admin}
                      onChange={updateFormValue}
                    />
                  }
                  label={t('security.fields.is_admin')}
                />
              </Stack>
              {user.admin && (
                <Typography variant="caption" color="primary" sx={{ display: 'block', ml: 4 }}>
                  {t('security.messages.admin_privileges')}
                </Typography>
              )}
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Button
              startIcon={<CancelIcon />}
              variant="outlined"
              onClick={handleCancel}
              color="inherit"
            >
              {t('common.CANCEL')}
            </Button>
            <Button
              startIcon={<SaveIcon />}
              variant="contained"
              onClick={validateAndDone}
              color="primary"
              autoFocus
              sx={{ px: 4 }}
            >
              {t('common.DONE')}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default UserForm;
