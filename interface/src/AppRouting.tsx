import { FC, useContext, useEffect } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useSnackbar, VariantType } from 'notistack';
import { useTranslation } from 'react-i18next';

import { Authentication, AuthenticationContext } from './contexts/authentication';
import { FeaturesContext } from './contexts/features';
import { RequireAuthenticated, RequireUnauthenticated } from './components';

import SignIn from './SignIn';
import AuthenticatedRouting from './AuthenticatedRouting';

interface SecurityRedirectProps {
  message: string;
  variant?: VariantType;
  signOut?: boolean;
}

const RootRedirect: FC<SecurityRedirectProps> = ({ message, variant, signOut }) => {
  const authenticationContext = useContext(AuthenticationContext);
  const { enqueueSnackbar } = useSnackbar();
  useEffect(() => {
    if (signOut) {
      authenticationContext.signOut(false);
    }
    enqueueSnackbar(message, { variant });
  }, [message, variant, signOut, authenticationContext, enqueueSnackbar]);
  return (<Navigate to="/" />);
};

export const RemoveTrailingSlashes = () => {
  const location = useLocation();
  return location.pathname.match('/.*/$') && (
    <Navigate
      to={{
        pathname: location.pathname.replace(/\/+$/, ""),
        search: location.search
      }}
    />
  );
};

const AppRouting: FC = () => {
  const { t } = useTranslation();
  const { features } = useContext(FeaturesContext);

  return (
    <Authentication>
      <RemoveTrailingSlashes />
      <Routes>
        <Route
          path="/unauthorized"
          element={<RootRedirect message={t('auth.errors.unauthorized_redirect')} signOut />}
        />
        <Route
          path="/firmwareUpdated"
          element={<RootRedirect message={t('system.messages.firmware_updated')} variant="success" />}
        />

        {features.security &&
          <Route
            path="/"
            element={

              <RequireUnauthenticated>
                <SignIn />
              </RequireUnauthenticated>
            }
          />}
        <Route
          path="/*"
          element={
            <RequireAuthenticated>
              <AuthenticatedRouting />
            </RequireAuthenticated>
          }
        />
      </Routes>
    </Authentication>
  );
};

export default AppRouting;
