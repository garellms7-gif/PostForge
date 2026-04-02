import { useState, useEffect } from 'react';
import { Save, Sparkles, MessageSquare } from 'lucide-react';

function getVoiceData() {
  return JSON.parse(localStorage.getItem('postforge_voice') || '{}');
}

function saveVoiceData(data) {
  localStorage.setItem('postforge_voice', JSON.stringify(data));
}

const EMPTY_SAMPLES = ['', '', '', '', ''];

async function analyzeVoice(samples) {
  const settings = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  const apiKey = settings.apiKey;
  const filtered = samples.filter(s => s.trim().length > 20);

  if (apiKey && apiKey.length > 10 && filtered.length > 0) {
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
          max_tokens: 500,
          system: 'Analyze writing samples and return ONLY a JSON object with no markdown.',
          messages: [{
            role: 'user',
            content: `Analyze these writing samples and return ONLY a JSON object:\n{ "avg_sentence_length": "short" or "medium" or "long", "tone": string, "humor_level": "low" or "medium" or "high", "formality": "casual" or "semi-formal" or "professional", "common_phrases": string[], "avoid_phrases": string[], "writing_style_summary": string }\n\nSamples:\n${filtered.map((s, i) => `[${i + 1}]\n${s}`).join('\n\n')}`,
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return { ...JSON.parse(match[0]), source: 'api' };
      }
    } catch { /* fall through */ }
  }

  // Heuristic fallback
  return heuristicAnalysis(filtered);
}

function heuristicAnalysis(samples) {
  const all = samples.join(' ');
  const sentences = all.split(/[.!?]+/).filter(s => s.trim());
  const avgLen = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / Math.max(1, sentences.length);

  const hasEmoji = /[\u{1F600}-\u{1F9FF}]/u.test(all);
  const excl = (all.match(/!/g) || []).length;
  const questions = (all.match(/\?/g) || []).length;
  const contractions = (all.match(/\b\w+'\w+\b/g) || []).length;

  const avg_sentence_length = avgLen < 10 ? 'short' : avgLen < 20 ? 'medium' : 'long';
  const formality = contractions > 3 || hasEmoji ? 'casual' : avgLen > 18 ? 'professional' : 'semi-formal';
  const humor_level = hasEmoji && excl > 3 ? 'high' : excl > 1 || questions > 2 ? 'medium' : 'low';

  const words = all.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const common_phrases = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);

  let tone = 'Friendly';
  if (formality === 'professional') tone = 'Professional';
  if (humor_level === 'high') tone = 'Witty & Playful';
  if (questions > excl) tone = 'Curious & Engaging';

  return {
    avg_sentence_length,
    tone,
    humor_level,
    formality,
    common_phrases,
    avoid_phrases: ['actually', 'basically', 'just'],
    writing_style_summary: `Your writing is ${formality} with ${avg_sentence_length} sentences. You tend toward a ${tone.toLowerCase()} tone${hasEmoji ? ' with emoji' : ''}${questions > 1 ? ' and use questions to engage' : ''}.`,
    source: 'heuristic',
  };
}

const HUMOR_LEVELS = { low: 20, medium: 55, high: 90 };
const FORMALITY_COLORS = { casual: 'var(--success)', 'semi-formal': '#eab308', professional: 'var(--accent)' };

export default function MyVoice() {
  const [samples, setSamples] = useState(EMPTY_SAMPLES);
  const [profile, setProfile] = useState(null);
  const [saved, setSaved] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const data = getVoiceData();
    if (data.samples) setSamples(data.samples);
    if (data.profile) setProfile(data.profile);
  }, []);

  const handleSaveSamples = () => {
    const data = getVoiceData();
    saveVoiceData({ ...data, samples });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const result = await analyzeVoice(samples);
    setProfile(result);
    const data = getVoiceData();
    saveVoiceData({ ...data, samples, profile: result });
    setAnalyzing(false);
  };

  const updateSample = (i, val) => {
    const updated = [...samples];
    updated[i] = val;
    setSamples(updated);
  };

  const filledCount = samples.filter(s => s.trim().length > 20).length;

  return (
    <div>
      {/* Section 1 - Writing Samples */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={16} />
          Writing Samples
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          PostForge learns your vocabulary, sentence length, humor style, and energy from these examples.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {samples.map((s, i) => (
            <div key={i} className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Sample {i + 1}</label>
                <span style={{ fontSize: 11, color: s.length > 0 ? 'var(--muted)' : 'transparent' }}>{s.length} chars</span>
              </div>
              <textarea
                className="form-textarea"
                style={{ minHeight: 70 }}
                placeholder="Paste one of your real posts here..."
                value={s}
                onChange={e => updateSample(i, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSaveSamples}>
            <Save size={14} /> Save Samples
          </button>
          {filledCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? <span className="spinner" /> : <Sparkles size={14} />}
              {analyzing ? 'Analyzing...' : 'Analyze My Voice'}
            </button>
          )}
          {saved && <span className="status-msg">Saved!</span>}
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{filledCount}/5 samples provided</span>
        </div>
      </div>

      {/* Section 2 - Voice Profile */}
      {profile && (
        <div className="card voice-profile-card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} />
            Your Voice Profile
            {profile.source === 'api' && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>via Claude API</span>}
          </div>

          {/* Tone badge + formality */}
          <div className="vp-badges">
            <span className="vp-tone-badge">{profile.tone || 'Friendly'}</span>
            <span className="vp-formality-badge" style={{ background: (FORMALITY_COLORS[profile.formality] || 'var(--accent)') + '18', color: FORMALITY_COLORS[profile.formality] || 'var(--accent)' }}>
              {profile.formality || 'casual'}
            </span>
          </div>

          {/* Metrics */}
          <div className="vp-metrics">
            <div className="vp-metric">
              <span className="vp-metric-label">Sentence Length</span>
              <div className="vp-metric-bar-wrap">
                <div className="vp-metric-bar" style={{ width: `${profile.avg_sentence_length === 'short' ? 30 : profile.avg_sentence_length === 'medium' ? 60 : 90}%` }} />
              </div>
              <span className="vp-metric-value">{profile.avg_sentence_length || 'medium'}</span>
            </div>
            <div className="vp-metric">
              <span className="vp-metric-label">Humor Level</span>
              <div className="vp-metric-bar-wrap">
                <div className="vp-metric-bar vp-humor-bar" style={{ width: `${HUMOR_LEVELS[profile.humor_level] || 50}%` }} />
              </div>
              <span className="vp-metric-value">{profile.humor_level || 'medium'}</span>
            </div>
          </div>

          {/* Common phrases */}
          {profile.common_phrases?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Your Common Phrases</div>
              <div className="vp-chips">
                {profile.common_phrases.map((p, i) => (
                  <span key={i} className="vp-chip">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Avoid phrases */}
          {profile.avoid_phrases?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Phrases to Avoid</div>
              <div className="vp-chips">
                {profile.avoid_phrases.map((p, i) => (
                  <span key={i} className="vp-chip vp-chip-avoid">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {profile.writing_style_summary && (
            <div className="vp-summary">
              {profile.writing_style_summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
