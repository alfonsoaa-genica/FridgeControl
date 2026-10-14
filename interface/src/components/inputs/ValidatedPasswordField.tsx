import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton, InputAdornment } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import ValidatedTextField, { ValidatedTextFieldProps } from './ValidatedTextField';

type ValidatedPasswordFieldProps = Omit<ValidatedTextFieldProps, 'type'>

const ValidatedPasswordField: FC<ValidatedPasswordFieldProps> = ({ InputProps, ...props }) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState<boolean>(false);

  return (
    <ValidatedTextField
      {...props}
      type={showPassword ? 'text' : 'password'}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={t('common.toggle_password_visibility')}
              onClick={() => setShowPassword(!showPassword)}
              edge="end"
            >
              {showPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </IconButton>
          </InputAdornment>
        )
      }}
    />
  );
};

export default ValidatedPasswordField;
