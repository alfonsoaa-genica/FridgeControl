import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem, Select, FormControl, InputLabel, Box, Typography } from '@mui/material';
import { SectionContent } from '../components';
import LanguageIcon from '@mui/icons-material/Language';

const LanguageSettingsForm: FC = () => {
    const { t, i18n } = useTranslation();

    const changeLanguage = (event: any) => {
        const newLang = event.target.value;
        i18n.changeLanguage(newLang);
        // Opcional: Guardar en localStorage para que persista al reiniciar
        localStorage.setItem('i18nextLng', newLang);
    };
    const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';

    return (
        <SectionContent title={t('system.language.title')} titleGutter>
            <Box display="flex" alignItems="center" gap={2} mt={2}>
                <LanguageIcon color="action" />
                <FormControl fullWidth>
                    <InputLabel id="select-language-label">{t('system.language.select_label')}</InputLabel>
                    <Select
                        labelId="select-language-label"
                        value={currentLang}
                        label={t('system.language.select_label')}
                        onChange={changeLanguage}
                    >
                        <MenuItem value="es">Español</MenuItem>
                        <MenuItem value="en">English</MenuItem>
                    </Select>
                </FormControl>
            </Box>
            <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
                {t('system.language.helper_text')}
            </Typography>
        </SectionContent>
    );
};

export default LanguageSettingsForm;
