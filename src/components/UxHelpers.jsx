import { useState, useEffect, useRef } from 'react';
import { Undo2, X } from 'lucide-react';

export function UndoToast({ message, onUndo, duration = 5000 }) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct <= 0) {
        clearInterval(tick);
        setVisible(false);
      }
    }, 50);
    timerRef.current = tick;
    return () => clearInterval(tick);
  }, [duration]);

  if (!visible) return null;

  return (
    <div className="undo-toast">
      <div className="undo-toast-content">
        <span>{message}</span>
        <button className="btn btn-primary btn-sm" onClick={() => { clearInterval(timerRef.current); setVisible(false); onUndo(); }}>
          <Undo2 size={13} /> Undo
        </button>
        <button className="undo-toast-close" onClick={() => { clearInterval(timerRef.current); setVisible(false); }}>
          <X size={14} />
        </button>
      </div>
      <div className="undo-toast-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}

export function CharCounter({ text }) {
  const len = (text || '').length;
  let color = 'var(--success)';
  let label = 'Twitter-safe';
  let pct = Math.min(100, (len / 280) * 100);

  if (len > 3000) {
    color = 'var(--danger)';
    label = 'Too long for most platforms';
    pct = 100;
  } else if (len > 1000) {
    color = 'var(--muted)';
    label = 'Long-form';
    pct = Math.min(100, (len / 3000) * 100);
  } else if (len > 280) {
    color = '#eab308';
    label = 'Reddit sweet spot';
    pct = Math.min(100, (len / 1000) * 100);
  }

  return (
    <div className="char-counter">
      <div className="char-counter-bar-wrap">
        <div className="char-counter-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="char-counter-text" style={{ color }}>{len} chars · {label}</span>
    </div>
  );
}

export function PlatformPreview({ content, platform, visible }) {
  if (!visible || !content) return null;
  const p = (platform || '').toLowerCase();

  if (p === 'discord') {
    return (
      <div className="preview-discord">
        <div className="preview-discord-avatar" />
        <div className="preview-discord-body">
          <div className="preview-discord-name">PostForge Bot <span className="preview-discord-tag">BOT</span></div>
          <div className="preview-discord-text">{content}</div>
        </div>
      </div>
    );
  }

  if (p === 'linkedin') {
    return (
      <div className="preview-linkedin">
        <div className="preview-linkedin-header">
          <div className="preview-linkedin-avatar" />
          <div>
            <div className="preview-linkedin-name">You</div>
            <div className="preview-linkedin-sub">Just now</div>
          </div>
        </div>
        <div className="preview-linkedin-text">{content}</div>
      </div>
    );
  }

  if (p === 'reddit') {
    const lines = content.split('\n');
    const title = lines[0]?.replace(/[^\w\s!?.,'"-]/g, '').trim().slice(0, 120) || 'Post Title';
    const body = lines.slice(1).join('\n').trim();
    return (
      <div className="preview-reddit">
        <div className="preview-reddit-votes">
          <span>▲</span><span>1</span><span>▼</span>
        </div>
        <div className="preview-reddit-body">
          <div className="preview-reddit-title">{title}</div>
          {body && <div className="preview-reddit-text">{body}</div>}
          <div className="preview-reddit-meta">Posted just now by u/you</div>
        </div>
      </div>
    );
  }

  if (p === 'x') {
    return (
      <div className="preview-x">
        <div className="preview-x-avatar" />
        <div className="preview-x-body">
          <div className="preview-x-header"><span className="preview-x-name">You</span> <span className="preview-x-handle">@you · now</span></div>
          <div className="preview-x-text">{content.slice(0, 280)}</div>
        </div>
      </div>
    );
  }

  // Generic
  return (
    <div className="preview-generic">
      <div className="preview-generic-text">{content}</div>
    </div>
  );
}
