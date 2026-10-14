import { useCallback, useEffect, useState } from "react";
import { useSnackbar } from 'notistack';
import { AxiosPromise } from "axios";
import { useTranslation } from "react-i18next";

import { extractErrorMessage } from ".";

export interface RestRequestOptions<D> {
  read: () => AxiosPromise<D>;
  update?: (value: D) => AxiosPromise<D>;
}

export const useRest = <D>({ read, update }: RestRequestOptions<D>) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [saving, setSaving] = useState<boolean>(false);
  const [data, setData] = useState<D>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const loadData = useCallback(async () => {
    setData(undefined);
    setErrorMessage(undefined);
    try {
      setData((await read()).data);
    } catch (error: any) {
      const message = extractErrorMessage(error, t('messages.load_error'));
      enqueueSnackbar(message, { variant: 'error' });
      setErrorMessage(message);
    }
  }, [read, enqueueSnackbar, t]);

  const save = useCallback(async (toSave: D) => {
    if (!update) {
      return;
    }
    setSaving(true);
    setErrorMessage(undefined);
    try {
      setData((await update(toSave)).data);
      enqueueSnackbar(t('messages.save_success'), { variant: 'success' });
    } catch (error: any) {
      const message = extractErrorMessage(error, t('messages.save_error'));
      enqueueSnackbar(message, { variant: 'error' });
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }, [update, enqueueSnackbar, t]);

  const saveData = () => data && save(data);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { loadData, saveData, saving, setData, data, errorMessage } as const;
};
