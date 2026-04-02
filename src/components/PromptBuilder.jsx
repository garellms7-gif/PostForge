import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Save, Plus, Trash2 } from 'lucide-react';

const DEFAULT_SYSTEM_PROMPT = `You are PostForge, an AI community post generator for indie builders. Write an engaging {{post_type}} post for the {{platform}} community "{{community_name}}" about {{product_name}}.

Product: {{product_name}} — {{tagline}}
Description: {{description}}
Price: {{price}}
Link: {{gumroad_link}}

Write in a {{tone}} tone. Make it authentic, not salesy. The post should feel like it was written by a real indie builder sharing their journey.

{{voice_samples}}
{{update_log}}
{{roadmap}}`;

const VARIABLES = [
  { token: '{{product_name}}', label: 'Product Name', desc: 'Your product name' },
  { token: '{{tagline}}', label: 'Tagline', desc: 'Product tagline' },
  { token: '{{description}}', label: 'Description', desc: 'Product description' },
  { token: '{{price}}', label: 'Price', desc: 'Product price' },
  { token: '{{gumroad_link}}', label: 'Gumroad Link', desc: 'Product link' },
  { token: '{{community_name}}', label: 'Community', desc: 'Target community name' },
  { token: '{{platform}}', label: 'Platform', desc: 'Discord, Reddit, etc.' },
  { token: '{{tone}}', label: 'Tone', desc: 'Selected tone' },
  { token: '{{post_type}}', label: 'Post Type', desc: 'Selected post type' },
  { token: '{{voice_samples}}', label: 'Voice Samples', desc: 'Your writing examples' },
  { token: '{{update_log}}', label: 'Update Log', desc: 'Recent product updates' },
  { token: '{{roadmap}}', label: 'Roadmap', desc: 'Upcoming features' },
];

const PRESET_TEMPLATES = [
  {
    id: 'authentic',
    name: 'Authentic Builder',
    prompt: `Write as a solo indie builder sharing their real journey. Be vulnerable about challenges. Use first person. Reference specific milestones and lessons learned. No corporate speak.\n\nProduct: {{product_name}} — {{tagline}}\nCommunity: {{community_name}} ({{platform}})\nTone: {{tone}}, authentic, personal\nType: {{post_type}}\n\n{{voice_samples}}`,
  },
  {
    id: 'problem',
    name: 'Problem Solver',
    prompt: `Lead with the specific problem {{product_name}} solves. Open with a pain point the audience relates to. Then show how the product addresses it naturally — no hard sell. End with a question or invitation.\n\nProduct: {{product_name}} — {{tagline}}\n{{description}}\nCommunity: {{community_name}} ({{platform}})\nTone: {{tone}}\nType: {{post_type}}`,
  },
  {
    id: 'social-proof',
    name: 'Social Proof First',
    prompt: `Open with a specific win, metric, or user testimonial. Let the numbers do the talking. Then briefly explain what {{product_name}} does. Keep the focus on results, not features.\n\nProduct: {{product_name}} — {{tagline}}\nPrice: {{price}}\nCommunity: {{community_name}} ({{platform}})\nTone: {{tone}}\nType: {{post_type}}`,
  },
  {
    id: 'punchy',
    name: 'Direct & Punchy',
    prompt: `Write in short, punchy sentences. Max 2-3 words per line if possible. No filler. No fluff. Cut everything that doesn't earn its place. Bold opening. Clear CTA. Under 150 words.\n\nProduct: {{product_name}} — {{tagline}}\nLink: {{gumroad_link}}\nCommunity: {{community_name}} ({{platform}})\nTone: {{tone}}, direct\nType: {{post_type}}`,
  },
  {
    id: 'storyteller',
    name: 'Storyteller',
    prompt: `Tell a story. Start before {{product_name}} existed — what was the moment that sparked the idea? Walk through the journey. Include a turning point. End with where things are now and what's next. Make the reader feel like they're part of the story.\n\nProduct: {{product_name}} — {{tagline}}\n{{description}}\nCommunity: {{community_name}} ({{platform}})\nTone: {{tone}}, narrative\nType: {{post_type}}\n\n{{voice_samples}}`,
  },
];

function getSavedTemplates() {
  return JSON.parse(localStorage.getItem('postforge_custom_prompts') || '[]');
}

function saveSavedTemplates(templates) {
  localStorage.setItem('postforge_custom_prompts', JSON.stringify(templates));
}

export function getCustomPromptConfig() {
  const data = JSON.parse(localStorage.getItem('postforge_prompt_config') || '{}');
  return {
    enabled: data.enabled || false,
    prompt: data.prompt || DEFAULT_SYSTEM_PROMPT,
    abPromptTest: data.abPromptTest || false,
  };
}

export { DEFAULT_SYSTEM_PROMPT };

export default function PromptBuilder({ onConfigChange }) {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [abPromptTest, setAbPromptTest] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const config = getCustomPromptConfig();
    setEnabled(config.enabled);
    setPrompt(config.prompt);
    setAbPromptTest(config.abPromptTest);
    setSavedTemplates(getSavedTemplates());
  }, []);

  const persistConfig = (updates) => {
    const config = { enabled, prompt, abPromptTest, ...updates };
    localStorage.setItem('postforge_prompt_config', JSON.stringify(config));
    if (onConfigChange) onConfigChange(config);
  };

  const handleToggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    persistConfig({ enabled: next });
  };

  const handlePromptChange = (val) => {
    setPrompt(val);
    persistConfig({ prompt: val });
  };

  const handleReset = () => {
    setPrompt(DEFAULT_SYSTEM_PROMPT);
    persistConfig({ prompt: DEFAULT_SYSTEM_PROMPT });
  };

  const handleInsertVariable = (token) => {
    const ta = textareaRef.current;
    if (!ta) { handlePromptChange(prompt + ' ' + token); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newPrompt = prompt.slice(0, start) + token + prompt.slice(end);
    handlePromptChange(newPrompt);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + token.length, start + token.length); }, 0);
  };

  const handleLoadTemplate = (templatePrompt) => {
    handlePromptChange(templatePrompt);
    setEnabled(true);
    persistConfig({ prompt: templatePrompt, enabled: true });
  };

  const handleSaveTemplate = () => {
    if (!saveName.trim()) return;
    const template = { id: Date.now(), name: saveName.trim(), prompt };
    const updated = [...savedTemplates, template];
    saveSavedTemplates(updated);
    setSavedTemplates(updated);
    setSaveName('');
    setShowSave(false);
  };

  const handleDeleteSaved = (id) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    saveSavedTemplates(updated);
    setSavedTemplates(updated);
  };

  const handleToggleABPrompt = () => {
    const next = !abPromptTest;
    setAbPromptTest(next);
    persistConfig({ abPromptTest: next });
  };

  return (
    <div className="pb-container">
      <button className="pb-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Advanced: Custom Prompt Builder
        {enabled && <span className="pb-active-badge">Custom prompt active</span>}
      </button>

      {expanded && (
        <div className="pb-panel">
          {/* 1. System Prompt Override */}
          <div className="pb-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>System Prompt Override</div>
              <div className="toggle-wrapper" onClick={handleToggleEnabled} style={{ marginLeft: 0 }}>
                <div className={`toggle ${enabled ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
                <span className="toggle-label">{enabled ? 'Custom' : 'Default'}</span>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="form-textarea pb-textarea"
              value={prompt}
              onChange={e => handlePromptChange(e.target.value)}
              disabled={!enabled}
              style={{ opacity: enabled ? 1 : 0.5 }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleReset} disabled={!enabled}>
                <RotateCcw size={12} /> Reset to Default
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSave(!showSave)} disabled={!enabled}>
                <Save size={12} /> Save as Template
              </button>
            </div>
            {showSave && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input className="form-input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} placeholder="Template name..." value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()} />
                <button className="btn btn-primary btn-sm" onClick={handleSaveTemplate} disabled={!saveName.trim()}>Save</button>
              </div>
            )}
          </div>

          {/* 2. Prompt Variables */}
          <div className="pb-section">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Prompt Variables</div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Click to insert at cursor position in the prompt above.</p>
            <div className="pb-vars">
              {VARIABLES.map(v => (
                <button key={v.token} className="pb-var-chip" onClick={() => handleInsertVariable(v.token)} disabled={!enabled} title={v.desc}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Prompt Templates */}
          <div className="pb-section">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Prompt Templates</div>
            <div className="pb-templates">
              {PRESET_TEMPLATES.map(t => (
                <button key={t.id} className="pb-template-btn" onClick={() => handleLoadTemplate(t.prompt)}>
                  {t.name}
                </button>
              ))}
            </div>
            {savedTemplates.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 10, marginBottom: 6 }}>Your Saved Templates</div>
                <div className="pb-templates">
                  {savedTemplates.map(t => (
                    <div key={t.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button className="pb-template-btn pb-template-saved" onClick={() => handleLoadTemplate(t.prompt)}>
                        {t.name}
                      </button>
                      <button className="pb-template-delete" onClick={() => handleDeleteSaved(t.id)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 5. A/B Prompt Test */}
          <div className="pb-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>A/B Prompt Test</div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Compare default prompt vs your custom prompt side by side</p>
              </div>
              <div className="toggle-wrapper" onClick={handleToggleABPrompt} style={{ marginLeft: 0 }}>
                <div className={`toggle ${abPromptTest ? 'toggle-on' : ''}`}><div className="toggle-knob" /></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
