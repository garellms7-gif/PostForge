import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short (under 100 words)' },
  { value: 'medium', label: 'Medium (100-250 words)' },
  { value: 'long', label: 'Long (250-500 words)' },
  { value: 'none', label: 'No limit' },
];

const EMOJI_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal (1-2 max)' },
  { value: 'normal', label: 'Normal' },
  { value: 'heavy', label: 'Heavy' },
];

const REQUIRED_ELEMENTS = [
  { key: 'includeLink', label: 'Always include Gumroad link' },
  { key: 'endWithQuestion', label: 'Always end with a question' },
  { key: 'mentionPrice', label: 'Always mention current price' },
  { key: 'personalStory', label: 'Always include a personal story element' },
  { key: 'firstPerson', label: 'Always use first person (I/we)' },
];

export default function AdvancedPostingSettings({ community, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const posting = community.postingSettings || {};

  const update = (key, value) => {
    onUpdate(community.id, { postingSettings: { ...posting, [key]: value } });
  };

  const handleAddForbidden = () => {
    const word = tagInput.trim().toLowerCase();
    if (!word) return;
    const current = posting.forbiddenWords || [];
    if (!current.includes(word)) {
      update('forbiddenWords', [...current, word]);
    }
    setTagInput('');
  };

  const handleRemoveForbidden = (word) => {
    update('forbiddenWords', (posting.forbiddenWords || []).filter(w => w !== word));
  };

  const toggleRequired = (key) => {
    const current = posting.required || {};
    update('required', { ...current, [key]: !current[key] });
  };

  return (
    <div className="aps-container">
      <button className="aps-toggle" onClick={() => setOpen(!open)}>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Advanced Posting Settings
        {(posting.customInstructions || (posting.forbiddenWords || []).length > 0) && (
          <span className="aps-configured-dot" />
        )}
      </button>

      {open && (
        <div className="aps-panel">
          {/* 1. Custom Instructions */}
          <div className="aps-section">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Custom Instructions</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 70, fontSize: 13 }}
              placeholder="Any specific instructions for posts to this community? E.g. always mention you're an indie developer, never mention pricing, always end with a question"
              value={posting.customInstructions || ''}
              onChange={e => update('customInstructions', e.target.value)}
            />
          </div>

          {/* 2. Forbidden Words */}
          <div className="aps-section">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Forbidden Words/Phrases</label>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>These words will never appear in generated posts for this community.</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                placeholder="Type a word and press Enter..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddForbidden(); } }}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleAddForbidden}>Add</button>
            </div>
            {(posting.forbiddenWords || []).length > 0 && (
              <div className="aps-tags">
                {posting.forbiddenWords.map(w => (
                  <span key={w} className="aps-tag">
                    {w}
                    <button className="aps-tag-remove" onClick={() => handleRemoveForbidden(w)}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 3. Required Elements */}
          <div className="aps-section">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Required Elements</label>
            <div className="aps-checklist">
              {REQUIRED_ELEMENTS.map(el => (
                <label key={el.key} className="aps-checkbox-row">
                  <input
                    type="checkbox"
                    checked={posting.required?.[el.key] || false}
                    onChange={() => toggleRequired(el.key)}
                  />
                  <span>{el.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 4. Post Length */}
          <div className="aps-section">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Post Length Preference</label>
            <div className="aps-radio-group">
              {LENGTH_OPTIONS.map(opt => (
                <label key={opt.value} className="aps-radio-row">
                  <input
                    type="radio"
                    name={`length-${community.id}`}
                    value={opt.value}
                    checked={(posting.lengthPref || 'none') === opt.value}
                    onChange={() => update('lengthPref', opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 5. Emoji Usage */}
          <div className="aps-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Emoji Usage</label>
            <div className="aps-radio-group">
              {EMOJI_OPTIONS.map(opt => (
                <label key={opt.value} className="aps-radio-row">
                  <input
                    type="radio"
                    name={`emoji-${community.id}`}
                    value={opt.value}
                    checked={(posting.emojiPref || 'normal') === opt.value}
                    onChange={() => update('emojiPref', opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Build a context string from a community's posting settings
 * to append to generated posts.
 */
export function buildPostingSettingsContext(community) {
  const posting = community?.postingSettings;
  if (!posting) return '';
  const parts = [];

  if (posting.customInstructions?.trim()) {
    parts.push(`[Community-specific instructions: ${posting.customInstructions.trim()}]`);
  }

  if (posting.forbiddenWords?.length > 0) {
    parts.push(`[NEVER use these words/phrases: ${posting.forbiddenWords.join(', ')}]`);
  }

  const req = posting.required || {};
  const reqs = [];
  if (req.includeLink) reqs.push('include the Gumroad/product link');
  if (req.endWithQuestion) reqs.push('end the post with a question');
  if (req.mentionPrice) reqs.push('mention the current price');
  if (req.personalStory) reqs.push('include a personal story element');
  if (req.firstPerson) reqs.push('write in first person (I/we)');
  if (reqs.length > 0) {
    parts.push(`[Required: ${reqs.join('; ')}]`);
  }

  if (posting.lengthPref && posting.lengthPref !== 'none') {
    const lengthMap = { short: 'Keep under 100 words', medium: 'Aim for 100-250 words', long: 'Write 250-500 words' };
    parts.push(`[Length: ${lengthMap[posting.lengthPref]}]`);
  }

  if (posting.emojiPref && posting.emojiPref !== 'normal') {
    const emojiMap = { none: 'Do not use any emoji', minimal: 'Use 1-2 emoji maximum', heavy: 'Use emoji liberally throughout' };
    if (emojiMap[posting.emojiPref]) parts.push(`[Emoji: ${emojiMap[posting.emojiPref]}]`);
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n') : '';
}
