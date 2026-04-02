import { useState } from 'react';
import { ChevronDown, Undo2, Clock, Pen } from 'lucide-react';

const REWRITE_OPTIONS = [
  { id: 'shorter', label: 'Make it shorter', instruction: 'Rewrite this post to be under 150 words. Keep the core message but cut everything non-essential.' },
  { id: 'longer', label: 'Make it longer', instruction: 'Expand this post with more detail, a personal story or anecdote, and richer context. At least double the length.' },
  { id: 'casual', label: 'Make it more casual', instruction: 'Rewrite in a conversational, informal tone. Like texting a friend. Use contractions, short sentences, maybe emoji.' },
  { id: 'professional', label: 'Make it more professional', instruction: 'Rewrite in a polished, business-appropriate tone. Remove slang, emoji, and casual language.' },
  { id: 'no-sales', label: 'Remove the salesy parts', instruction: 'Rewrite to remove anything that sounds like an ad. No hype, no exclamation marks, no pushy CTAs. Make it sound like genuine advice or sharing.' },
  { id: 'hook', label: 'Add a stronger hook', instruction: 'Rewrite ONLY the opening 1-2 sentences to be much more attention-grabbing. Use a bold claim, surprising stat, or provocative question. Keep the rest identical.' },
  { id: 'personality', label: 'Add more personality', instruction: 'Rewrite to sound more human and unique. Add humor, self-deprecation, or a distinctive voice. Less corporate, more real person.' },
  { id: 'simplify', label: 'Simplify it', instruction: 'Rewrite using simpler words and shorter sentences. Aim for 6th grade reading level. Remove jargon.' },
];

async function callRewrite(content, instruction) {
  const settings = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  const apiKey = settings.apiKey;

  if (apiKey && apiKey.length > 10) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          system: 'You are a post rewriting assistant. Rewrite the given post according to the instruction. Return ONLY the rewritten post text with no preamble, explanation, or markdown formatting.',
          messages: [{ role: 'user', content: `Instruction: ${instruction}\n\nOriginal post:\n${content}` }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content?.[0]?.text || content;
      }
    } catch {
      // Fall through to heuristic
    }
  }

  // Heuristic fallback
  return heuristicRewrite(content, instruction);
}

function heuristicRewrite(content, instruction) {
  const lower = instruction.toLowerCase();

  if (lower.includes('shorter') || lower.includes('under 150')) {
    const sentences = content.split(/(?<=[.!?])\s+/);
    return sentences.slice(0, Math.max(3, Math.ceil(sentences.length / 2))).join(' ').trim();
  }

  if (lower.includes('longer') || lower.includes('expand') || lower.includes('more detail')) {
    return content + '\n\nThis has been a wild journey so far. Every week brings new lessons and new challenges. The community feedback has been incredible — it pushes me to keep building and shipping. If you have any thoughts, I would love to hear them.';
  }

  if (lower.includes('casual') || lower.includes('informal') || lower.includes('conversational')) {
    return content
      .replace(/\bI am\b/g, "I'm").replace(/\bdo not\b/g, "don't").replace(/\bcannot\b/g, "can't")
      .replace(/\bwould\b/g, "would").replace(/\bExcited to announce\b/g, "So hyped to share")
      .replace(/\bI would love\b/g, "I'd love") + ' 😊';
  }

  if (lower.includes('professional') || lower.includes('polished') || lower.includes('business')) {
    return content
      .replace(/[😀-🙏🚀🔥💀😅🎉🎯🏆🧠👋🛠️]+/gu, '')
      .replace(/!{2,}/g, '.').replace(/\.\.\./g, '.')
      .replace(/\bhyped\b/gi, 'pleased').replace(/\bawesome\b/gi, 'excellent')
      .replace(/\bsuper\b/gi, 'very').trim();
  }

  if (lower.includes('salesy') || lower.includes('less like an ad')) {
    return content
      .replace(/!+/g, '.').replace(/🚀|🔥|💥|⚡/g, '')
      .replace(/\b(BUY|GRAB|LIMITED|HURRY|ACT NOW|DON'T MISS)\b/gi, '')
      .replace(/\bcheck it out\b/gi, 'take a look if interested')
      .trim();
  }

  if (lower.includes('hook') || lower.includes('opening')) {
    const lines = content.split('\n');
    lines[0] = 'Here\'s something most people get wrong about building in public:';
    return lines.join('\n');
  }

  if (lower.includes('personality') || lower.includes('more human')) {
    const lines = content.split('\n');
    lines.splice(1, 0, '\n(Not gonna lie, I almost didn\'t post this. But hey, building in public means sharing the messy parts too.)');
    return lines.join('\n');
  }

  if (lower.includes('simplify') || lower.includes('simpler') || lower.includes('easier to read')) {
    return content.split(/(?<=[.!?])\s+/).map(s => {
      if (s.length > 100) {
        const mid = s.indexOf(', ', 20);
        if (mid > 0) return s.slice(0, mid) + '.' + s.slice(mid + 2);
      }
      return s;
    }).join(' ');
  }

  // Custom — just return with a note
  return content + '\n\n[Rewrite with custom instruction applied — set an API key in Settings for AI-powered rewrites]';
}

export default function RewriteAssistant({ content, onRewrite }) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const doRewrite = async (instruction, label) => {
    setRewriting(true);
    setOpen(false);
    setCustomOpen(false);

    // Save current version to history
    const newHistory = [{ text: content, label: 'Before: ' + label, date: new Date().toISOString() }, ...history].slice(0, 5);
    setHistory(newHistory);

    const rewritten = await callRewrite(content, instruction);
    onRewrite(rewritten);
    setRewriting(false);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[0];
    onRewrite(prev.text);
    setHistory(history.slice(1));
  };

  const handleRestoreVersion = (idx) => {
    const version = history[idx];
    onRewrite(version.text);
    setShowHistory(false);
  };

  return (
    <div className="rw-container">
      <div className="rw-row">
        {/* Rewrite dropdown */}
        <div className="rw-dropdown-wrap">
          <button className="btn btn-secondary btn-sm" onClick={() => { setOpen(!open); setCustomOpen(false); }} disabled={rewriting}>
            {rewriting ? <span className="spinner" /> : <Pen size={13} />}
            {rewriting ? 'Rewriting...' : 'Rewrite'}
            <ChevronDown size={12} />
          </button>
          {open && (
            <div className="rw-dropdown">
              {REWRITE_OPTIONS.map(opt => (
                <button key={opt.id} className="rw-dropdown-item" onClick={() => doRewrite(opt.instruction, opt.label)}>
                  {opt.label}
                </button>
              ))}
              <div className="rw-dropdown-divider" />
              <button className="rw-dropdown-item rw-dropdown-custom" onClick={() => { setOpen(false); setCustomOpen(true); }}>
                <Pen size={12} /> Custom Rewrite...
              </button>
            </div>
          )}
        </div>

        {/* Undo */}
        {history.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={handleUndo}>
            <Undo2 size={13} /> Undo
          </button>
        )}

        {/* History */}
        {history.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowHistory(!showHistory)}>
            <Clock size={13} /> {history.length} version{history.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Custom instruction input */}
      {customOpen && (
        <div className="rw-custom">
          <input
            className="form-input"
            placeholder="Tell PostForge how to rewrite this post..."
            value={customInstruction}
            onChange={e => setCustomInstruction(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && customInstruction.trim()) doRewrite(customInstruction, 'Custom: ' + customInstruction.slice(0, 30)); }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={() => { if (customInstruction.trim()) doRewrite(customInstruction, 'Custom: ' + customInstruction.slice(0, 30)); }} disabled={!customInstruction.trim()}>
            Rewrite
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCustomOpen(false)}>Cancel</button>
        </div>
      )}

      {/* Version history */}
      {showHistory && history.length > 0 && (
        <div className="rw-history">
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Rewrite History</div>
          {history.map((v, i) => (
            <div key={i} className="rw-history-item">
              <div className="rw-history-meta">
                <span className="rw-history-label">{v.label}</span>
                <span className="rw-history-date">{new Date(v.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="rw-history-preview">{v.text.slice(0, 80)}...</div>
              <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => handleRestoreVersion(i)}>
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
