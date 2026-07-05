'use client';

import type { PublicCatalogSettings } from '@aranyam/shared-types';
import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

const PublicSettingsContext = createContext<PublicCatalogSettings | undefined>(
  undefined,
);

export function PublicSettingsProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, setSettings] = useState<PublicCatalogSettings>();

  useEffect(() => {
    apiRequest<PublicCatalogSettings>('/catalog/public-settings')
      .then(setSettings)
      .catch(() => setSettings(undefined));
  }, []);

  return (
    <PublicSettingsContext.Provider value={settings}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings() {
  return useContext(PublicSettingsContext);
}
