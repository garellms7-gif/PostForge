/**
 * Style DNA Extraction and Community Style Profile System.
 */

const EXTRACTION_PROMPT = `Analyze this post and extract its writing style characteristics. Return ONLY a JSON object:
{
  "opening_pattern": "question" or "statement" or "story" or "stat" or "hook",
  "sentence_style": "short" or "medium" or "long" or "mixed",
  "paragraph_count": number,
  "personal_level": "high" or "medium" or "low",
  "energy": "calm" or "conversational" or "enthusiastic" or "urgent",
  "structure": "list" or "narrative" or "single-block" or "question-answer",
  "cta_style": "soft" or "direct" or "question" or "none",
  "authenticity_markers": string[],
  "avoid_patterns": string[]
}`;

/**
 * Extract Style DNA from a post via Claude API, with heuristic fallback.
 */
export async function extractStyleDNA(content) {
  const settings = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  const apiKey = settings.apiKey;

  if (apiKey && apiKey.length > 10) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: EXTRACTION_PROMPT, messages: [{ role: 'user', content: `Post:\n${content}` }] }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return { ...JSON.parse(match[0]), source: 'api' };
      }
    } catch { /* fall through */ }
  }

  return heuristicExtract(content);
}

function heuristicExtract(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  const avgWords = sentences.reduce((s, sent) => s + sent.trim().split(/\s+/).length, 0) / Math.max(1, sentences.length);
  const firstLine = (lines[0] || '').trim();
  const personalWords = (content.match(/\b(I|my|me|we|our)\b/gi) || []).length;
  const hasEmoji = /[\u{1F600}-\u{1F9FF}]/u.test(content);
  const excl = (content.match(/!/g) || []).length;
  const questions = (content.match(/\?/g) || []).length;
  const hasList = /^[-•→▸\d]+\s/m.test(content);

  let opening_pattern = 'statement';
  if (firstLine.endsWith('?')) opening_pattern = 'question';
  else if (/^\d|%|users|customers/i.test(firstLine)) opening_pattern = 'stat';
  else if (/ago|when|story|remember/i.test(firstLine)) opening_pattern = 'story';
  else if (firstLine.length < 40 && (excl > 0 || hasEmoji)) opening_pattern = 'hook';

  const sentence_style = avgWords < 10 ? 'short' : avgWords < 18 ? 'medium' : avgWords < 25 ? 'long' : 'mixed';
  const paragraph_count = lines.length;
  const personal_level = personalWords > 5 ? 'high' : personalWords > 2 ? 'medium' : 'low';
  const energy = excl > 4 ? 'enthusiastic' : excl > 1 || hasEmoji ? 'conversational' : questions > 2 ? 'conversational' : 'calm';
  const structure = hasList ? 'list' : paragraph_count > 4 ? 'narrative' : paragraph_count <= 2 ? 'single-block' : questions > 2 ? 'question-answer' : 'narrative';

  let cta_style = 'none';
  const lastLine = (lines[lines.length - 1] || '').toLowerCase();
  if (lastLine.includes('?')) cta_style = 'question';
  else if (/check|try|grab|sign|download|get started/i.test(lastLine)) cta_style = 'direct';
  else if (/thoughts|think|would love|interested/i.test(lastLine)) cta_style = 'soft';

  const authenticity_markers = [];
  if (personalWords > 3) authenticity_markers.push('frequent personal pronouns');
  if (hasEmoji) authenticity_markers.push('natural emoji use');
  if (questions > 0) authenticity_markers.push('engages with questions');
  if (/honestly|not gonna lie|real talk|truth is/i.test(content)) authenticity_markers.push('vulnerable language');
  if (content.length < 300) authenticity_markers.push('concise and focused');

  const avoid_patterns = [];
  if (excl < 2) avoid_patterns.push('avoids excessive exclamation');
  if (!(content.match(/\b[A-Z]{4,}\b/g) || []).length) avoid_patterns.push('no ALL CAPS hype');
  if (!(/revolutionary|game.?chang|disrupt|synergy/i.test(content))) avoid_patterns.push('no buzzwords');

  return { opening_pattern, sentence_style, paragraph_count, personal_level, energy, structure, cta_style, authenticity_markers, avoid_patterns, source: 'heuristic' };
}

/**
 * Get all stored Style DNA entries.
 */
export function getStyleDNAStore() {
  return JSON.parse(localStorage.getItem('postforge_style_dna') || '{}');
}

/**
 * Save Style DNA for a specific post.
 */
export function saveStyleDNA(postId, community, dna) {
  const store = getStyleDNAStore();
  store[postId] = { ...dna, community, extractedAt: new Date().toISOString() };
  localStorage.setItem('postforge_style_dna', JSON.stringify(store));
}

/**
 * Auto-extract Style DNA for a post if it qualifies (high performer or score > 70).
 */
export async function maybeExtractStyleDNA(postId, content, community, normalizedScore) {
  if (normalizedScore < 70) return null;
  const store = getStyleDNAStore();
  if (store[postId]) return store[postId]; // Already extracted
  const dna = await extractStyleDNA(content);
  saveStyleDNA(postId, community, dna);
  return dna;
}

/**
 * Build a Community Style Profile by averaging Style DNA across high-performing posts.
 */
export function buildCommunityStyleProfile(communityName) {
  const store = getStyleDNAStore();
  const entries = Object.values(store).filter(d => d.community === communityName);
  if (entries.length === 0) return null;

  // Count frequencies for categorical fields
  const freq = (field) => {
    const counts = {};
    for (const e of entries) { const v = e[field]; if (v) counts[v] = (counts[v] || 0) + 1; }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  };

  // Collect array fields
  const collectArrays = (field) => {
    const counts = {};
    for (const e of entries) {
      for (const item of (e[field] || [])) { counts[item] = (counts[item] || 0) + 1; }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  };

  return {
    sampleSize: entries.length,
    bestOpening: freq('opening_pattern'),
    bestSentenceStyle: freq('sentence_style'),
    bestEnergy: freq('energy'),
    bestStructure: freq('structure'),
    bestPersonalLevel: freq('personal_level'),
    bestCtaStyle: freq('cta_style'),
    avgParagraphs: Math.round(entries.reduce((s, e) => s + (e.paragraph_count || 3), 0) / entries.length),
    topAuthenticityMarkers: collectArrays('authenticity_markers'),
    topAvoidPatterns: collectArrays('avoid_patterns'),
  };
}

/**
 * Build a prompt context string from a community's Style Profile.
 */
export function buildStyleProfileContext(communityName) {
  const profile = buildCommunityStyleProfile(communityName);
  if (!profile || profile.sampleSize < 2) return '';

  const parts = [
    `[Community Style Profile for "${communityName}" based on ${profile.sampleSize} high-performing posts:]`,
    `Based on what has performed best in this community, write with these characteristics:`,
    `- Opening: ${profile.bestOpening} style`,
    `- Sentences: ${profile.bestSentenceStyle}`,
    `- Energy: ${profile.bestEnergy}`,
    `- Structure: ${profile.bestStructure}`,
    `- Personal level: ${profile.bestPersonalLevel}`,
    `- CTA style: ${profile.bestCtaStyle}`,
    `- Aim for ~${profile.avgParagraphs} paragraphs`,
  ];

  if (profile.topAuthenticityMarkers.length > 0) {
    parts.push(`- Authenticity techniques that work: ${profile.topAuthenticityMarkers.join(', ')}`);
  }
  if (profile.topAvoidPatterns.length > 0) {
    parts.push(`- Patterns to maintain: ${profile.topAvoidPatterns.join(', ')}`);
  }

  parts.push(`Do not copy any previous posts - use these as style guidelines only.`);
  return '\n\n' + parts.join('\n');
}
