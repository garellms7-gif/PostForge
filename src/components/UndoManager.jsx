import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Undo2, X } from 'lucide-react';

/**
 * Global undo queue — lives in memory only (lost on refresh = safety feature).
 */
let globalToasts = [];
let globalListeners = [];
let toastIdCounter = 0;

function notify() { globalListeners.forEach(fn => fn([...globalToasts])); }

/**
 * Show an undo toast. Returns a promise that resolves to true if undone, false if permanent.
 */
export function showUndoToast(message, onUndo, duration = 5000) {
  const id = ++toastIdCounter;
  return new Promise((resolve) => {
    const toast = {
      id, message, duration,
      startTime: Date.now(),
      onUndo: () => { onUndo(); resolve(true); removeToast(id); },
      onExpire: () => { resolve(false); removeToast(id); },
      onDismiss: () => { resolve(false); removeToast(id); },
    };
    // Max 3 visible
    if (globalToasts.length >= 3) {
      const oldest = globalToasts[0];
      oldest.onExpire();
    }
    globalToasts.push(toast);
    notify();
  });
}

function removeToast(id) {
  globalToasts = globalToasts.filter(t => t.id !== id);
  notify();
}

/**
 * Type-to-confirm dialog for extra dangerous actions.
 * Returns a promise resolving to true/false.
 */
let confirmResolve = null;
let confirmData = null;
let confirmListeners = [];

function notifyConfirm() { confirmListeners.forEach(fn => fn(confirmData ? { ...confirmData } : null)); }

export function showTypeConfirm(message) {
  return new Promise((resolve) => {
    confirmData = { message };
    confirmResolve = resolve;
    notifyConfirm();
  });
}

function handleConfirmResult(result) {
  if (confirmResolve) confirmResolve(result);
  confirmResolve = null;
  confirmData = null;
  notifyConfirm();
}

/**
 * React component that renders the global toast stack and confirm dialog.
 * Mount this once at the app root.
 */
export function UndoManager() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    const handler = (t) => setToasts(t);
    globalListeners.push(handler);
    return () => { globalListeners = globalListeners.filter(h => h !== handler); };
  }, []);

  useEffect(() => {
    const handler = (c) => setConfirm(c);
    confirmListeners.push(handler);
    return () => { confirmListeners = confirmListeners.filter(h => h !== handler); };
  }, []);

  return createPortal(
    <>
      {/* Toast stack */}
      <div className="um-toast-stack">
        {toasts.map((t, i) => (
          <UndoToastItem key={t.id} toast={t} index={i} />
        ))}
      </div>

      {/* Type-to-confirm dialog */}
      {confirm && <TypeConfirmDialog message={confirm.message} onResult={handleConfirmResult} />}
    </>,
    document.body
  );
}

function UndoToastItem({ toast }) {
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - toast.startTime;
      const pct = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(pct);
      if (pct <= 0) {
        clearInterval(timerRef.current);
        toast.onExpire();
      }
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [toast]);

  return (
    <div className="um-toast" onClick={(e) => { if (e.target.closest('.um-undo-btn')) return; clearInterval(timerRef.current); toast.onDismiss(); }}>
      <div className="um-toast-content">
        <span className="um-toast-msg">{toast.message}</span>
        <button className="um-undo-btn btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); clearInterval(timerRef.current); toast.onUndo(); }}>
          <Undo2 size={12} /> Undo
        </button>
      </div>
      <div className="um-toast-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}

function TypeConfirmDialog({ message, onResult }) {
  const [typed, setTyped] = useState('');
  return (
    <div className="um-confirm-overlay" onClick={() => onResult(false)}>
      <div className="um-confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="um-confirm-title">Confirm Destructive Action</div>
        <p className="um-confirm-msg">{message}</p>
        <div className="um-confirm-input-row">
          <label className="form-label">Type <strong>DELETE</strong> to confirm:</label>
          <input className="form-input" value={typed} onChange={e => setTyped(e.target.value)} placeholder="DELETE" autoFocus />
        </div>
        <div className="um-confirm-actions">
          <button className="btn btn-danger" onClick={() => onResult(true)} disabled={typed !== 'DELETE'}>Confirm Delete</button>
          <button className="btn btn-secondary" onClick={() => onResult(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
