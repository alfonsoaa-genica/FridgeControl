import { FC, useContext, useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import {
  Button, IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Avatar, Chip, Tooltip, Box
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';

import * as SecurityApi from "../../api/security";
import { SecuritySettings, User } from '../../types';
import { ButtonRow, FormLoader, MessageBox, SectionContent } from '../../components';
import { createUserValidator } from '../../validators';
import { useRest } from '../../utils';
import { AuthenticatedContext } from '../../contexts/authentication';

import UserForm from './UserForm';

// Función de ordenación optimizada
const sortUsers = (users: User[]) => [...users].sort((a, b) => a.username.localeCompare(b.username));

const ManageUsersForm: FC = () => {
  const { t } = useTranslation();
  const {
    loadData, saving, data, setData, saveData, errorMessage
  } = useRest<SecuritySettings>({
    read: SecurityApi.readSecuritySettings,
    update: SecurityApi.updateSecuritySettings
  });

  const [user, setUser] = useState<User>();
  const [creating, setCreating] = useState<boolean>(false);
  const authenticatedContext = useContext(AuthenticatedContext);

  // Memoizar la lista ordenada para evitar re-cálculos innecesarios
  const sortedUsers = useMemo(() => (data ? sortUsers(data.users) : []), [data]);

  const noAdminConfigured = () => !data?.users.find((u) => u.admin);

  const content = () => {
    if (!data) {
      return (<FormLoader onRetry={loadData} errorMessage={errorMessage} />);
    }

    const removeUser = (toRemove: User) => {
      const users = data.users.filter((u) => u.username !== toRemove.username);
      setData({ ...data, users });
    };

    const createUser = () => {
      setCreating(true);
      setUser({ username: "", password: "", admin: false });
    };

    const editUser = (toEdit: User) => {
      setCreating(false);
      setUser({ ...toEdit });
    };

    const doneEditingUser = () => {
      if (user) {
        const users = [...data.users.filter((u) => u.username !== user.username), user];
        setData({ ...data, users });
        setUser(undefined);
      }
    };

    const onSubmit = async () => {
      await saveData();
      authenticatedContext.refresh();
    };

    return (
      <>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell width="60px" />
                <TableCell><strong>{t('security.users.username')}</strong></TableCell>
                <TableCell align="center"><strong>{t('security.users.role')}</strong></TableCell>
                <TableCell align="right"><strong>{t('common.ACTIONS')}</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedUsers.map((u) => (
                <TableRow key={u.username} hover>
                  <TableCell>
                    <Avatar sx={{ width: 32, height: 32, fontSize: '1rem' }}>
                      {u.username.charAt(0).toUpperCase()}
                    </Avatar>
                  </TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell align="center">
                    {u.admin ? (
                      <Chip
                        icon={<AdminPanelSettingsIcon />}
                        label={t('security.users.admin')}
                        color="primary"
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        icon={<PersonIcon />}
                        label={t('security.users.standard_user')}
                        size="small"
                        variant="filled"
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.EDIT')}>
                      <IconButton size="small" color="primary" onClick={() => editUser(u)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.DELETE')}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeUser(u)}
                        disabled={u.username === authenticatedContext.me.username} // No borrarse a sí mismo
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box display="flex" justifyContent="flex-end">
          <Button
            startIcon={<PersonAddIcon />}
            variant="outlined"
            color="secondary"
            onClick={createUser}
          >
            {t('security.users.add_user')}
          </Button>
        </Box>

        {noAdminConfigured() && (
          <MessageBox
            level="warning"
            message={t('security.messages.admin_required')}
            my={2}
          />
        )}
        <ButtonRow mt={4}>
          <Button
            startIcon={<SaveIcon />}
            disabled={saving || noAdminConfigured()}
            variant="contained"
            color="primary"
            size="large"
            onClick={onSubmit}
          >
            {t('common.SAVE')}
          </Button>
        </ButtonRow>

        <UserForm
          user={user}
          setUser={setUser}
          creating={creating}
          onDoneEditing={doneEditingUser}
          onCancelEditing={() => setUser(undefined)}
          validator={createUserValidator(data.users, creating)}
        />
      </>
    );
  };

  return (
    <SectionContent title={t('security.tabs.users')} titleGutter>
      {content()}
    </SectionContent>
  );
};

export default ManageUsersForm;
