import { safeGet } from './safeStorage';

/**
 * Score a post using the Claude API.
 * Falls back to heuristic scoring if no API key is configured.
 */

const SCORING_SYSTEM_PROMPT = `You are a community post quality analyst. Score this post from 1-10 on these dimensions and return ONLY a JSON object with no markdown:
{ "hook": number, "clarity": number, "authenticity": number, "cta_strength": number, "community_fit": number, "overall": number, "tip": string, "warnings": [] }

hook: Does the opening line grab attention immediately?
clarity: Is the message clear and easy to understand?
authenticity: Does this sound like a real person or like AI marketing copy?
community_fit: Is the tone and style appropriate for this type of community?
cta_strength: Is the call to action or ask clear and compelling?
overall: Overall post quality score
tip: One specific improvement suggestion in under 15 words
warnings: Array of specific issues found like "too salesy", "too long", "starts with I", "uses buzzwords" etc`;

export async function scorePost(content, communityName, platform) {
  // Try Claude API first
  const settings = safeGet('postforge_settings', {});
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
          max_tokens: 300,
          system: SCORING_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Community: ${communityName || 'General'} (${platform || 'unknown platform'})\n\nPost:\n${content}` }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const scores = JSON.parse(jsonMatch[0]);
          return { ...scores, source: 'api' };
        }
      }
    } catch {
      // Fall through to heuristic
    }
  }

  // Heuristic fallback
  return heuristicScore(content, platform);
}

function heuristicScore(content, platform) {
  const len = content.length;
  const firstLine = content.split('\n')[0] || '';
  const warnings = [];

  // Hook
  let hook = 6;
  if (firstLine.length < 10) { hook = 3; warnings.push('Opening line too short'); }
  else if (firstLine.includes('?') || firstLine.includes('!') || /[\u{1F600}-\u{1F9FF}]/u.test(firstLine)) hook = 8;
  if (firstLine.toLowerCase().startsWith('i ') || firstLine.toLowerCase().startsWith('i\'')) { hook -= 1; warnings.push('Starts with "I" — try leading with value'); }

  // Clarity
  let clarity = 7;
  if (len > 2000) { clarity -= 2; warnings.push('Too long — consider trimming'); }
  if (len < 50) { clarity -= 2; warnings.push('Too short to convey a clear message'); }
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  const avgSentLen = len / Math.max(1, sentences.length);
  if (avgSentLen > 150) { clarity -= 1; warnings.push('Sentences too long — break them up'); }

  // Authenticity
  let authenticity = 7;
  const buzzwords = (content.match(/\b(revolutionary|game-?changing|cutting-?edge|synergy|leverage|disrupt|innovative|seamless)\b/gi) || []).length;
  if (buzzwords > 1) { authenticity -= 2; warnings.push('Uses buzzwords — sounds like marketing copy'); }
  const capsWords = (content.match(/\b[A-Z]{4,}\b/g) || []).length;
  if (capsWords > 2) { authenticity -= 1; warnings.push('Too many ALL CAPS words'); }
  const personalWords = (content.match(/\b(I|my|we|our)\b/gi) || []).length;
  if (personalWords >= 2) authenticity += 1;
  if (/[\u{1F600}-\u{1F9FF}]/u.test(content)) authenticity += 1;

  // CTA Strength
  let cta_strength = 5;
  if (/https?:\/\//.test(content)) cta_strength += 1;
  if (/\b(check it out|try it|sign up|join|get started|grab|download|subscribe)\b/i.test(content)) cta_strength += 2;
  if (/\?/.test(content)) cta_strength += 1;

  // Community Fit
  let community_fit = 6;
  const p = (platform || '').toLowerCase();
  if (p === 'x' && len <= 280) community_fit = 8;
  if (p === 'x' && len > 280) { community_fit = 4; warnings.push('Too long for Twitter/X'); }
  if (p === 'reddit' && len > 100 && len < 2000) community_fit = 8;
  if (p === 'linkedin' && /\b(professional|team|industry|career)\b/i.test(content)) community_fit += 1;
  if (p === 'discord' && len < 500) community_fit = 8;

  // Exclamation spam
  const exclCount = (content.match(/!/g) || []).length;
  if (exclCount > 5) { warnings.push('Too many exclamation marks — feels salesy'); authenticity -= 1; }

  const clamp = (v) => Math.max(1, Math.min(10, Math.round(v)));
  const scores = {
    hook: clamp(hook),
    clarity: clamp(clarity),
    authenticity: clamp(authenticity),
    cta_strength: clamp(cta_strength),
    community_fit: clamp(community_fit),
  };
  scores.overall = clamp(Math.round((scores.hook + scores.clarity + scores.authenticity + scores.cta_strength + scores.community_fit) / 5));

  // Generate tip
  let tip = 'Add a question to spark engagement';
  if (scores.hook < 6) tip = 'Lead with a bold claim or question to hook readers';
  else if (scores.authenticity < 6) tip = 'Replace buzzwords with specific details from your experience';
  else if (scores.cta_strength < 5) tip = 'End with a clear ask — what should the reader do next?';
  else if (scores.community_fit < 6) tip = `Adjust length and tone for ${platform || 'this platform'}`;

  return { ...scores, tip, warnings, source: 'heuristic' };
}
