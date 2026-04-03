/**
 * Freshness Guard — prevents repetitive content before posting.
 */

function getHistory() { return JSON.parse(localStorage.getItem('postforge_history') || '[]'); }
function getPostLog() { return JSON.parse(localStorage.getItem('postforge_post_log') || '[]'); }
function getFreshnessLog() { return JSON.parse(localStorage.getItem('postforge_freshness_log') || '[]'); }
function saveFreshnessLog(log) { localStorage.setItem('postforge_freshness_log', JSON.stringify(log.slice(0, 100))); }

function addFreshnessEntry(entry) {
  const log = getFreshnessLog();
  log.unshift({ ...entry, id: Date.now() + Math.random(), date: new Date().toISOString() });
  saveFreshnessLog(log);
}

export { getFreshnessLog };

/**
 * Get all posts sent to a community in the last N days.
 */
function getRecentCommunityPosts(communityName, days = 90) {
  const cutoff = Date.now() - days * 86400000;
  const all = [...getHistory(), ...getPostLog()];
  return all.filter(p => p.community === communityName && new Date(p.date).getTime() > cutoff && p.content);
}

/**
 * 1. Duplicate Detection — check similarity against recent posts.
 * Uses Claude API if available, otherwise heuristic comparison.
 */
async function checkDuplicate(content, communityName) {
  const recent = getRecentCommunityPosts(communityName, 90);
  if (recent.length === 0) return null;

  // Quick heuristic first: check first 100 chars overlap
  const contentStart = content.slice(0, 100).toLowerCase();
  for (const post of recent.slice(0, 20)) {
    const postStart = (post.content || '').slice(0, 100).toLowerCase();
    // Simple overlap ratio
    const words1 = new Set(contentStart.split(/\s+/));
    const words2 = new Set(postStart.split(/\s+/));
    const overlap = [...words1].filter(w => words2.has(w)).length;
    const ratio = (overlap / Math.max(1, Math.max(words1.size, words2.size))) * 100;
    if (ratio > 70) {
      return { similar: true, score: Math.round(ratio), date: post.date, preview: (post.content || '').slice(0, 80) };
    }
  }

  // Claude API similarity check for top 5 most recent
  const settings = JSON.parse(localStorage.getItem('postforge_settings') || '{}');
  if (settings.apiKey && settings.apiKey.length > 10) {
    for (const post of recent.slice(0, 5)) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, system: 'On a scale of 0-100 how similar are these two posts in message, structure, and key phrases? Return only a number.', messages: [{ role: 'user', content: `Post A:\n${content.slice(0, 500)}\n\nPost B:\n${(post.content || '').slice(0, 500)}` }] }),
        });
        if (res.ok) {
          const data = await res.json();
          const score = parseInt((data.content?.[0]?.text || '0').match(/\d+/)?.[0] || '0');
          if (score > 70) {
            return { similar: true, score, date: post.date, preview: (post.content || '').slice(0, 80) };
          }
        }
      } catch { /* continue */ }
    }
  }

  return null;
}

/**
 * 2. Opening Line Freshness — check if opening word repeats.
 */
function checkOpeningFreshness(content, communityName) {
  const recent = getRecentCommunityPosts(communityName, 30).slice(0, 3);
  if (recent.length < 3) return null;

  const newFirst = (content.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!newFirst) return null;

  const recentFirstWords = recent.map(p => ((p.content || '').split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, ''));
  const allSame = recentFirstWords.every(w => w === newFirst);

  if (allSame) {
    return { repeated: true, word: newFirst, count: 3 };
  }
  return null;
}

/**
 * 3. Phrase Fatigue — track overused phrases.
 */
function getFatiguedPhrases(communityName) {
  const recent = getRecentCommunityPosts(communityName, 30);
  const phraseCount = {};

  for (const post of recent) {
    const text = (post.content || '').toLowerCase();
    // Extract 2-3 word phrases
    const words = text.split(/\s+/).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + ' ' + words[i + 1];
      if (bigram.length > 6) phraseCount[bigram] = (phraseCount[bigram] || 0) + 1;
      if (i < words.length - 2) {
        const trigram = bigram + ' ' + words[i + 2];
        if (trigram.length > 10) phraseCount[trigram] = (phraseCount[trigram] || 0) + 1;
      }
    }
  }

  return Object.entries(phraseCount)
    .filter(([, count]) => count > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }));
}

/**
 * Auto-add fatigued phrases to community's forbidden words.
 */
function autoAddFatiguedToForbidden(communityName, fatiguedPhrases) {
  if (fatiguedPhrases.length === 0) return;
  const communities = JSON.parse(localStorage.getItem('postforge_communities') || '[]');
  const updated = communities.map(c => {
    if (c.name !== communityName) return c;
    const posting = c.postingSettings || {};
    const existing = posting.forbiddenWords || [];
    const newWords = fatiguedPhrases.filter(f => !existing.includes(f.phrase)).map(f => f.phrase);
    if (newWords.length === 0) return c;
    return { ...c, postingSettings: { ...posting, forbiddenWords: [...existing, ...newWords.slice(0, 3)] } };
  });
  localStorage.setItem('postforge_communities', JSON.stringify(updated));
}

/**
 * 4. Topic Rotation — track topic distribution.
 */
const TOPIC_MAP = {
  'Launch Announcement': 'Product Launch',
  'Feature Update': 'Updates',
  'Ask for Feedback': 'Engagement',
  'Show & Tell': 'Showcase',
  'Milestone': 'Social Proof',
  'Tips & Value': 'Value/Tips',
};

function getTopicDistribution(communityName) {
  const recent = getRecentCommunityPosts(communityName, 14);
  const counts = {};
  for (const post of recent) {
    const topic = TOPIC_MAP[post.postType] || post.postType || 'Other';
    counts[topic] = (counts[topic] || 0) + 1;
  }
  return Object.entries(counts).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
}

function getTopicSuggestion(communityName) {
  const dist = getTopicDistribution(communityName);
  if (dist.length === 0) return null;
  const top = dist[0];
  if (top.count < 3) return null;
  const allTopics = Object.values(TOPIC_MAP);
  const used = new Set(dist.map(d => d.topic));
  const unused = allTopics.filter(t => !used.has(t));
  const suggestion = unused[0] || dist[dist.length - 1]?.topic || 'a different topic';
  return { overused: top.topic, count: top.count, suggestion };
}

export { getFatiguedPhrases, getTopicDistribution, getTopicSuggestion };

/**
 * Run all Freshness Guard checks. Returns actions taken.
 */
export async function runFreshnessGuard(content, communityName, platform) {
  const actions = [];

  // 1. Duplicate detection
  const dup = await checkDuplicate(content, communityName);
  if (dup) {
    actions.push({
      type: 'duplicate_blocked',
      message: `Too similar to a post sent on ${new Date(dup.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${dup.score}% similar) — rewriting`,
      severity: 'blocked',
    });
    addFreshnessEntry({ type: 'duplicate', community: communityName, platform, message: `Blocked: ${dup.score}% similar to post from ${new Date(dup.date).toLocaleDateString()}` });
  }

  // 2. Opening line freshness
  const opening = checkOpeningFreshness(content, communityName);
  if (opening) {
    actions.push({
      type: 'opening_adjusted',
      message: `Last 3 posts to ${communityName} all started with "${opening.word}" — adjusted opening`,
      severity: 'adjusted',
    });
    addFreshnessEntry({ type: 'opening', community: communityName, platform, message: `Adjusted: repeated opening word "${opening.word}"` });
  }

  // 3. Phrase fatigue
  const fatigued = getFatiguedPhrases(communityName);
  if (fatigued.length > 0) {
    autoAddFatiguedToForbidden(communityName, fatigued);
    const found = fatigued.filter(f => content.toLowerCase().includes(f.phrase));
    if (found.length > 0) {
      actions.push({
        type: 'phrases_flagged',
        message: `Fatigued phrases detected: ${found.map(f => `"${f.phrase}"`).join(', ')} — added to forbidden list`,
        severity: 'adjusted',
        phrases: found,
      });
      addFreshnessEntry({ type: 'phrase_fatigue', community: communityName, platform, message: `Flagged ${found.length} fatigued phrase(s)` });
    }
  }

  // 4. Topic rotation suggestion
  const topicSugg = getTopicSuggestion(communityName);
  if (topicSugg) {
    actions.push({
      type: 'topic_suggestion',
      message: `You've posted about "${topicSugg.overused}" ${topicSugg.count} times in 2 weeks — consider "${topicSugg.suggestion}" next`,
      severity: 'suggestion',
    });
  }

  return actions;
}
