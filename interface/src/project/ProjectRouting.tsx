import { FC } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { CavasDashboard } from './CavasDashboard';
import { ModbusDiagnostic } from './ModbusDiagnostic';
import { AlarmsConfigPage } from './AlarmsConfigPage';
import { CavasConfigPage } from './CavasConfigPage';
import { AuditLogPage } from './AuditLogPage';
import { AuxiliaryEquipmentPage } from './AuxiliaryEquipmentPage';

const ProjectRouting: FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard/*" element={<CavasDashboard />} />
      <Route path="cavas-setup/*" element={<CavasConfigPage />} />
      <Route path="auxiliary-equipment/*" element={<AuxiliaryEquipmentPage />} />
      <Route path="alarms/*" element={<AlarmsConfigPage />} />
      <Route path="audit/*" element={<AuditLogPage />} />
      <Route path="diagnostic/*" element={<ModbusDiagnostic />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default ProjectRouting;
