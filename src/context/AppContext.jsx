import { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEYS = {
  product: 'postforge_product',
  communities: 'postforge_communities',
  history: 'postforge_history',
  voiceSamples: 'postforge_voice_samples',
  apiKey: 'postforge_api_key',
};

function safeLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / serialization errors
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [product, setProduct] = useState(() => safeLoad(STORAGE_KEYS.product, null));
  const [communities, setCommunities] = useState(() => safeLoad(STORAGE_KEYS.communities, []));
  const [history, setHistory] = useState(() => safeLoad(STORAGE_KEYS.history, []));
  const [voiceSamples, setVoiceSamples] = useState(() => safeLoad(STORAGE_KEYS.voiceSamples, []));
  const [apiKey, setApiKey] = useState(() => safeLoad(STORAGE_KEYS.apiKey, ''));

  useEffect(() => { safeSave(STORAGE_KEYS.product, product); }, [product]);
  useEffect(() => { safeSave(STORAGE_KEYS.communities, communities); }, [communities]);
  useEffect(() => { safeSave(STORAGE_KEYS.history, history); }, [history]);
  useEffect(() => { safeSave(STORAGE_KEYS.voiceSamples, voiceSamples); }, [voiceSamples]);
  useEffect(() => { safeSave(STORAGE_KEYS.apiKey, apiKey); }, [apiKey]);

  const value = {
    product, setProduct,
    communities, setCommunities,
    history, setHistory,
    voiceSamples, setVoiceSamples,
    apiKey, setApiKey,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
