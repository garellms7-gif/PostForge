import { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { scorePost } from '../lib/scorer';

const DIMENSIONS = [
  { key: 'hook', label: 'Hook' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'authenticity', label: 'Authenticity' },
  { key: 'community_fit', label: 'Community Fit' },
  { key: 'cta_strength', label: 'CTA Strength' },
];

function scoreColor(v) {
  if (v >= 8) return 'var(--success)';
  if (v >= 5) return '#eab308';
  return 'var(--danger)';
}

function OverallBadge({ score }) {
  if (score == null) return null;
  return (
    <span className="qs-overall-badge" style={{ background: scoreColor(score) + '22', color: scoreColor(score), borderColor: scoreColor(score) + '44' }}>
      {score}/10
    </span>
  );
}

export function OverallScoreBadge({ scores }) {
  if (!scores) return null;
  return <OverallBadge score={scores.overall} />;
}

export default function PostScorer({ content, communityName, platform }) {
  const [scores, setScores] = useState(null);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    if (!content) { setScores(null); return; }
    let cancelled = false;
    setScoring(true);
    scorePost(content, communityName, platform).then(s => {
      if (!cancelled) { setScores(s); setScoring(false); }
    }).catch(() => { if (!cancelled) setScoring(false); });
    return () => { cancelled = true; };
  }, [content, communityName, platform]);

  if (!content) return null;

  if (scoring) {
    return (
      <div className="qs-container">
        <div className="qs-loading"><span className="spinner" /> Scoring post quality...</div>
      </div>
    );
  }

  if (!scores) return null;

  return (
    <div className="qs-container">
      <div className="qs-header">
        <span className="qs-title">Quality Score</span>
        <OverallBadge score={scores.overall} />
        {scores.source === 'api' && <span className="qs-source">via Claude API</span>}
      </div>

      <div className="qs-bars">
        {DIMENSIONS.map(d => {
          const val = scores[d.key] || 0;
          return (
            <div key={d.key} className="qs-bar-row">
              <span className="qs-bar-label">{d.label}</span>
              <div className="qs-bar-track">
                <div className="qs-bar-fill" style={{ width: `${val * 10}%`, background: scoreColor(val) }} />
              </div>
              <span className="qs-bar-value" style={{ color: scoreColor(val) }}>{val}</span>
            </div>
          );
        })}
      </div>

      {scores.warnings && scores.warnings.length > 0 && (
        <div className="qs-warnings">
          {scores.warnings.map((w, i) => (
            <span key={i} className="qs-warning-pill">{w}</span>
          ))}
        </div>
      )}

      {scores.tip && (
        <div className="qs-tip">
          <Lightbulb size={14} />
          {scores.tip}
        </div>
      )}
    </div>
  );
}
