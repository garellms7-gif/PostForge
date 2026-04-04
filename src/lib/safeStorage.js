/**
 * Safe localStorage wrapper for PostForge.
 * Prevents crashes from corrupted data or full storage.
 */

let _storageErrorToast = null;

function showStorageError(message) {
  if (_storageErrorToast) return; // Don't spam
  _storageErrorToast = document.createElement('div');
  _storageErrorToast.className = 'ss-error-toast';
  _storageErrorToast.textContent = message;
  document.body.appendChild(_storageErrorToast);
  setTimeout(() => {
    _storageErrorToast?.remove();
    _storageErrorToast = null;
  }, 5000);
}

/**
 * Safely get and parse a JSON value from localStorage.
 * Returns defaultValue if key is missing, empty, or corrupted.
 */
export function safeGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;
    if (raw === '') return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`PostForge: corrupted data found for key "${key}" - using defaults`, err);
    return defaultValue;
  }
}

/**
 * Safely get a raw string from localStorage (no JSON parse).
 */
export function safeGetRaw(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? raw : defaultValue;
  } catch (err) {
    console.warn(`PostForge: error reading key "${key}"`, err);
    return defaultValue;
  }
}

/**
 * Safely set a JSON value in localStorage.
 * Shows visible error if storage is full.
 */
export function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`PostForge: failed to save key "${key}"`, err);
    if (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014) {
      showStorageError('Storage is full — please export and clear old data in Settings.');
    } else {
      showStorageError(`Failed to save data: ${err.message}`);
    }
  }
}

/**
 * Safely set a raw string in localStorage (no JSON stringify).
 */
export function safeSetRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error(`PostForge: failed to save key "${key}"`, err);
    showStorageError('Storage is full — please export and clear old data in Settings.');
  }
}

/**
 * Safely remove a key from localStorage.
 */
export function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`PostForge: failed to remove key "${key}"`, err);
  }
}

/**
 * Run a health check on all PostForge localStorage keys.
 * Returns { healthy: string[], corrupted: { key: string, error: string }[] }
 */
export function runHealthCheck() {
  const healthy = [];
  const corrupted = [];

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('postforge_')) continue;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === '') { healthy.push(key); continue; }
      // Some keys are raw strings (dismissed dates, paused flags, etc.)
      if (raw === 'true' || raw === 'false' || /^\d{4}-\d{2}-\d{2}/.test(raw)) { healthy.push(key); continue; }
      JSON.parse(raw);
      healthy.push(key);
    } catch (err) {
      corrupted.push({ key, error: err.message });
    }
  }

  return { healthy, corrupted };
}

/**
 * Reset a specific key to empty/default state.
 */
export function resetKey(key) {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}
