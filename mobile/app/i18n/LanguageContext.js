import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANGUAGE, translate } from './translations';

const STORAGE_KEY = '@ufundi_language';

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (text, params) => text,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'en' || stored === 'lg') setLanguageState(stored);
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback(async (lang) => {
    if (lang !== 'en' && lang !== 'lg') return;
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      console.warn('Could not persist language preference', err);
    }
  }, []);

  const t = useCallback((text, params) => translate(language, text, params), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
