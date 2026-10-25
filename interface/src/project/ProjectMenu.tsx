import { FC, useContext } from 'react';
import { List } from '@mui/material';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import KitchenIcon from '@mui/icons-material/Kitchen';
import HistoryIcon from '@mui/icons-material/History';
import MemoryIcon from '@mui/icons-material/Memory';
import { PROJECT_PATH } from '../api/env';
import LayoutMenuItem from '../components/layout/LayoutMenuItem';
import { useTranslation } from 'react-i18next';
import { AuthenticatedContext } from '../contexts/authentication';

const ProjectMenu: FC = () => {
  const { t } = useTranslation();
  const authenticatedContext = useContext(AuthenticatedContext);
  const isAdmin = authenticatedContext?.me?.admin ?? false;

  return (
    <List>
      <LayoutMenuItem icon={AcUnitIcon} label={t('cavas.liveView', 'Cavas en Vivo')} to={`/${PROJECT_PATH}/dashboard`}/>
      <LayoutMenuItem icon={KitchenIcon} label={t('cavas.configTitle', 'Mantenimiento Cavas')} to={`/${PROJECT_PATH}/cavas-setup`} disabled={!isAdmin}/>
      <LayoutMenuItem icon={MemoryIcon} label={t('cavas.auxiliaryTitle', 'Equipos Auxiliares')} to={`/${PROJECT_PATH}/auxiliary-equipment`}/>
      <LayoutMenuItem icon={NotificationsActiveIcon} label={t('cavas.alarmsTitle', 'Alarmas ISA-18.2')} to={`/${PROJECT_PATH}/alarms`} disabled={!isAdmin}/>
      <LayoutMenuItem icon={HistoryIcon} label="Auditoría de Operaciones" to={`/${PROJECT_PATH}/audit`} disabled={!isAdmin}/>
      <LayoutMenuItem icon={SettingsEthernetIcon} label={t('cavas.diagnostic', 'Diagnóstico Modbus')} to={`/${PROJECT_PATH}/diagnostic`}/>
    </List>
  );
};

export default ProjectMenu;
