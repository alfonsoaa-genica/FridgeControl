import { FC } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next'; // 1. Importamos el hook
import { MessageBox } from '..';

interface FormLoaderProps {
  message?: string;
  errorMessage?: string;
  onRetry?: () => void;
}

const FormLoader: FC<FormLoaderProps> = ({ errorMessage, onRetry, message }) => {
  const { t } = useTranslation(); // 2. Inicializamos la función de traducción

  // Si no se pasa un mensaje por props, usamos el valor traducido por defecto
  const displayMessage = message || t('common.loading');

  if (errorMessage) {
    return (
      <MessageBox my={2} level="error" message={errorMessage}>
        {
          onRetry &&
          <Button
            startIcon={<RefreshIcon />}
            variant="contained"
            color="error"
            onClick={onRetry}
          >
            {t('common.retry')}
          </Button>
        }
      </MessageBox>
    );
  }

  return (
    <Box m={2} py={2} display="flex" alignItems="center" flexDirection="column">
      <Box py={2}>
        <CircularProgress size={100} />
      </Box>
      <Typography variant="h6" fontWeight={400} textAlign="center">
        {displayMessage}
      </Typography>
    </Box>
  );
};

export default FormLoader;
