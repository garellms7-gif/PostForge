import { useState } from 'react';
import { Sparkles, Copy, Save, Eye, EyeOff, RefreshCw, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const POST_TYPES = [
  'Share an Update',
  'Ask for Help',
  'Tease a Feature',
  'Product Launch',
  'General Engagement',
];

const MAX_CONTEXT = 200;

const SYSTEM_PROMPT =
  'You are PostForge, an AI writing assistant for indie builders. Write authentic community posts that sound like a real person - not corporate or AI-generated. Match the community tone exactly. Return only the JSON object requested.';

function buildUserMessage({ product, community, postType, voiceSamples, context }) {
  const lines = [];

  if (product && product.name) {
    lines.push('PRODUCT:');
    lines.push(`- Name: ${product.name}`);
    if (product.tagline) lines.push(`- Tagline: ${product.tagline}`);
    if (product.description) lines.push(`- Description: ${product.description}`);
    if (product.price) lines.push(`- Price: ${product.price}`);
    if (product.gumroadLink) lines.push(`- Link: ${product.gumroadLink}`);
    lines.push('');
  }

  lines.push('COMMUNITY:');
  lines.push(`- Name: ${community.name}`);
  lines.push(`- Platform: ${community.platform}`);
  lines.push(`- Tone: ${community.tone}`);
  if (community.notes) lines.push(`- Notes: ${community.notes}`);
  lines.push('');

  lines.push(`POST TYPE: ${postType}`);
  lines.push('');

  if (Array.isArray(voiceSamples) && voiceSamples.length > 0) {
    lines.push('Write in this style:');
    voiceSamples.forEach((s, i) => {
      lines.push(`Sample ${i + 1}:`);
      lines.push(s);
      lines.push('');
    });
  }

  if (context && context.trim()) {
    lines.push(`ADDITIONAL CONTEXT: ${context.trim()}`);
    lines.push('');
  }

  lines.push('Write two distinct variants of this post for A/B testing. They should have different angles or hooks but feel equally authentic.');
  lines.push('');
  lines.push('Return ONLY a JSON object: { variant_a: string, variant_b: string }');

  return lines.join('\n');
}

function extractJson(text) {
  if (!text) return null;
  // Try raw JSON first
  try { return JSON.parse(text); } catch {}
  // Find first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

async function callClaude({ apiKey, userMessage }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  const parsed = extractJson(text);
  if (!parsed || typeof parsed.variant_a !== 'string' || typeof parsed.variant_b !== 'string') {
    throw new Error('Could not parse variants from response');
  }
  return { variantA: parsed.variant_a, variantB: parsed.variant_b };
}

function VariantCard({ label, value, onChange, onSave, communitySelected }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleSave = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {label}
        </h3>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{value.length} chars</span>
      </div>
      <textarea
        className="form-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ minHeight: 200, height: 'auto', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
          <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleSave}
          disabled={!communitySelected}
        >
          <Save size={14} /> {saved ? 'Saved!' : 'Save to History'}
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div
        style={{
          height: 14,
          width: 80,
          background: 'var(--border)',
          borderRadius: 4,
          marginBottom: 16,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          minHeight: 200,
          background: 'linear-gradient(90deg, var(--border) 0%, var(--surface) 50%, var(--border) 100%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 1.4s infinite',
          borderRadius: 8,
        }}
      />
    </div>
  );
}

export default function Generator() {
  const { apiKey, setApiKey, communities, product, voiceSamples, history, setHistory } = useApp();

  const [showKey, setShowKey] = useState(false);
  const [communityId, setCommunityId] = useState('');
  const [postType, setPostType] = useState(POST_TYPES[0]);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  const communityList = communities || [];
  const selectedCommunity = communityList.find(c => c.id === communityId) || null;

  const canGenerate = !!apiKey && !!selectedCommunity && !loading;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError('');
    setLoading(true);
    setHasGenerated(true);
    try {
      const userMessage = buildUserMessage({
        product,
        community: selectedCommunity,
        postType,
        voiceSamples,
        context,
      });
      const { variantA: a, variantB: b } = await callClaude({ apiKey, userMessage });
      setVariantA(a);
      setVariantB(b);
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVariant = (which) => {
    if (!selectedCommunity) return;
    const entry = {
      id: Date.now().toString() + '-' + which,
      date: new Date().toISOString(),
      communityId: selectedCommunity.id,
      communityName: selectedCommunity.name,
      postType,
      variantA,
      variantB,
    };
    setHistory([entry, ...(history || [])]);
  };

  return (
    <div>
      <h1 className="page-title">Generator</h1>

      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .gen-pill {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .gen-pill:hover { border-color: #6366f1; }
        .gen-pill.gen-pill-active {
          background: #6366f1;
          color: #fff;
          border-color: #6366f1;
        }
      `}</style>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* LEFT COLUMN */}
        <div style={{ width: 360, flexShrink: 0 }}>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Anthropic API Key</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey || ''}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    style={{ paddingRight: 40, width: '100%' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                    }}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Community</label>
                {communityList.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                    Add a community first
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={communityId}
                    onChange={e => setCommunityId(e.target.value)}
                  >
                    <option value="">Select a community…</option>
                    {communityList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.platform})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Post Type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {POST_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`gen-pill ${postType === t ? 'gen-pill-active' : ''}`}
                      onClick={() => setPostType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Additional Context (optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  maxLength={MAX_CONTEXT}
                  value={context}
                  onChange={e => setContext(e.target.value.slice(0, MAX_CONTEXT))}
                  placeholder="Any extra context for this post…"
                />
                <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                  {context.length} / {MAX_CONTEXT}
                </span>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!canGenerate}
                style={{
                  width: '100%',
                  background: canGenerate ? '#6366f1' : undefined,
                  borderColor: canGenerate ? '#6366f1' : undefined,
                  justifyContent: 'center',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Generate
                  </>
                )}
              </button>

              {error && (
                <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!hasGenerated ? null : loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (variantA || variantB) ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <VariantCard
                  label="Variant A"
                  value={variantA}
                  onChange={setVariantA}
                  onSave={() => handleSaveVariant('a')}
                  communitySelected={!!selectedCommunity}
                />
                <VariantCard
                  label="Variant B"
                  value={variantB}
                  onChange={setVariantB}
                  onSave={() => handleSaveVariant('b')}
                  communitySelected={!!selectedCommunity}
                />
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  <RefreshCw size={16} /> Regenerate
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
