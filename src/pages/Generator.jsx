import { useState, useEffect } from 'react';
import { Sparkles, Copy, Save, RefreshCw } from 'lucide-react';

const TONES = ['Professional', 'Casual', 'Hype', 'Story-driven', 'Educational', 'Funny'];
const POST_TYPES = ['Launch Announcement', 'Feature Update', 'Ask for Feedback', 'Show & Tell', 'Milestone', 'Tips & Value'];

function generatePost(product, community, tone, postType) {
  const name = product.name || 'My Product';
  const tagline = product.tagline || 'an awesome tool';
  const desc = product.description || 'a product built for makers';
  const price = product.price || '';
  const link = product.gumroadLink || '';
  const communityName = community?.name || 'the community';
  const platform = community?.platform || 'Discord';

  const priceStr = price ? ` Available for ${price}.` : '';
  const linkStr = link ? `\n\n${link}` : '';

  const templates = {
    'Launch Announcement': {
      Professional: `Excited to announce that ${name} is now live.\n\n${tagline} — ${desc}\n\nAfter weeks of building, I'm thrilled to share this with ${communityName}.${priceStr}\n\nWould love to hear your thoughts and feedback.${linkStr}`,
      Casual: `Hey ${communityName}! 👋\n\nJust launched ${name} — ${tagline}.\n\n${desc}\n\nBeen working on this for a while and finally hit publish. Would love for you all to check it out!${priceStr}${linkStr}`,
      Hype: `🚀 IT'S LIVE! 🚀\n\n${name} just dropped and I'm pumped!\n\n${tagline}\n\n${desc}\n\nThis is the tool I wish I had when I started. Go check it out!${priceStr}${linkStr}`,
      'Story-driven': `6 months ago, I had a problem. I couldn't find a good solution, so I built one.\n\nToday, I'm launching ${name} — ${tagline}.\n\n${desc}\n\nIt started as a side project and turned into something I'm genuinely proud of. Sharing it with ${communityName} first.${priceStr}${linkStr}`,
      Educational: `I built ${name} to solve a common problem many of us face.\n\nHere's what it does:\n→ ${tagline}\n→ ${desc}\n\nKey insight: the best tools are the ones that get out of your way. That's what I optimized for.${priceStr}\n\nHappy to answer any questions!${linkStr}`,
      Funny: `Me: "I should stop building side projects"\nAlso me: *launches ${name}*\n\n${tagline}\n\n${desc}\n\nMy therapist says I have a shipping addiction. I say it's a feature, not a bug. 😅${priceStr}${linkStr}`,
    },
    'Feature Update': {
      Professional: `${name} just got a major update.\n\nWhat's new:\n• Improved performance\n• New UI refinements\n• Better ${desc.split(' ').slice(0, 4).join(' ')} workflow\n\nThese changes came directly from user feedback in ${communityName}. Keep it coming!${linkStr}`,
      Casual: `Quick update on ${name}! 🎉\n\nJust shipped some cool new features based on your feedback. The ${tagline.toLowerCase()} experience just got way better.\n\nWould love to know what you think!${linkStr}`,
      Hype: `🔥 MASSIVE UPDATE ALERT 🔥\n\n${name} just leveled up! New features, better performance, smoother UX.\n\n${tagline} — and now it's even better.\n\nDrop a comment if you want early access!${linkStr}`,
      'Story-driven': `Last week, someone in ${communityName} asked for a feature that completely changed how I think about ${name}.\n\nI built it over the weekend, and today it's live.\n\nSometimes the best product decisions come from listening to your users.${linkStr}`,
      Educational: `Shipping updates the right way:\n\n1. Listen to users (${communityName} has been amazing)\n2. Prioritize ruthlessly\n3. Ship fast, iterate faster\n\nThat's exactly what we did with the latest ${name} update. Here's what changed and why...${linkStr}`,
      Funny: `My ${name} users: "Can you add X?"\nMe: "Sure, this weekend"\n*3 all-nighters later*\nMe: "Done! Also I added Y and Z because I have no self-control"\n\nUpdate is live! 😅${linkStr}`,
    },
    'Ask for Feedback': {
      Professional: `I'd love to get ${communityName}'s perspective on ${name}.\n\n${tagline} — ${desc}\n\nSpecifically looking for feedback on:\n• User experience\n• Feature priorities\n• Pricing (currently ${price || 'TBD'})\n\nAll feedback is appreciated.${linkStr}`,
      Casual: `Hey ${communityName}! Building ${name} and would love your honest thoughts.\n\n${desc}\n\nWhat works? What doesn't? What would make you actually use this?\n\nNo ego here — roast me if needed 🙏${linkStr}`,
      Hype: `🎯 I need YOUR help!\n\n${name} is almost ready and I want to make it PERFECT before launch.\n\n${tagline}\n\nTell me what you think — the good, the bad, the ugly. Let's make this amazing together!${linkStr}`,
      'Story-driven': `I've been building ${name} in public for the past few weeks. ${tagline}.\n\nBut here's the thing — I'm too close to it now. I need fresh eyes.\n\n${communityName}, would you mind taking a look and sharing your honest feedback?${linkStr}`,
      Educational: `The best products are built with user feedback, not assumptions.\n\nThat's why I'm sharing ${name} early with ${communityName}.\n\n${desc}\n\nWhat would YOU want from a tool like this?${linkStr}`,
      Funny: `Rating my own product ${name}: 11/10\nMy mom's rating: 11/10\n\nBut I might be biased. And my mom thinks the internet is a person.\n\nSo ${communityName}, what do YOU think? 😂${linkStr}`,
    },
    'Show & Tell': {
      Professional: `Wanted to share what I've been working on: ${name}.\n\n${tagline}\n\n${desc}\n\nIt's been an incredible learning experience building this, and I'm excited to show it to ${communityName}.${priceStr}${linkStr}`,
      Casual: `Check out what I built! 🛠️\n\n${name} — ${tagline}\n\n${desc}\n\nIt's not perfect, but I'm proud of it. What do you think, ${communityName}?${linkStr}`,
      Hype: `WHO WANTS TO SEE SOMETHING COOL? 🎉\n\n${name} — ${tagline}!\n\nI've been heads down building and I'm finally ready to show it off.\n\n${desc}${priceStr}${linkStr}`,
      'Story-driven': `Three months, 847 commits, and way too much coffee later...\n\nI want to show ${communityName} what I've built: ${name}.\n\n${tagline}\n\n${desc}\n\nEvery feature has a story behind it.${linkStr}`,
      Educational: `Built ${name} and learned a ton along the way.\n\n${tagline}\n\nKey lessons:\n• Start with the problem, not the solution\n• Ship early, iterate often\n• Your first version will be embarrassing — ship it anyway\n\n${desc}${linkStr}`,
      Funny: `Me explaining ${name} to my friends:\n"It's like... ${tagline.toLowerCase()}"\n\nThem: "So it's an app?"\n\nMe: "It's a LIFESTYLE" 💀\n\nAnyway here's what I built for ${communityName}...${linkStr}`,
    },
    'Milestone': {
      Professional: `Proud to share a milestone: ${name} has been growing steadily.\n\n${tagline}\n\nThank you to everyone in ${communityName} who supported this journey. Your feedback shaped this product.${linkStr}`,
      Casual: `Small win worth sharing with ${communityName} 🎉\n\n${name} is hitting milestones I never expected when I started. ${tagline}\n\nGrateful for all the support!${linkStr}`,
      Hype: `🏆 MILESTONE UNLOCKED! 🏆\n\n${name} is GROWING and I can't believe it!\n\n${tagline}\n\nNone of this would be possible without ${communityName}. You all are the best! 🙌${linkStr}`,
      'Story-driven': `When I launched ${name}, I set a small goal. Just get 10 people to try it.\n\nToday, I'm blown away. ${tagline}\n\nThis community believed in the idea before anyone else. Thank you, ${communityName}.${linkStr}`,
      Educational: `Milestone reflections on building ${name}:\n\n• Product-market fit isn't a moment, it's a gradient\n• Community (like ${communityName}) > marketing\n• Consistency beats intensity\n\n${tagline}\n\nThe journey continues.${linkStr}`,
      Funny: `${name} milestone update:\n\n✅ Launched\n✅ Got users\n✅ Didn't break anything (today)\n❌ Got a good night's sleep\n\n${tagline}\n\nCelebrating by... going back to building 😅${linkStr}`,
    },
    'Tips & Value': {
      Professional: `As a builder, here's what I've learned creating ${name}:\n\n1. Solve your own problem first\n2. Talk to users before writing code\n3. Distribution matters as much as product\n\n${tagline}\n\nHope this helps others in ${communityName}.${linkStr}`,
      Casual: `Quick tips from building ${name} that I wish I knew earlier:\n\n→ Don't over-plan. Just start.\n→ Ship ugly v1s. Polish later.\n→ Your first 10 users matter most.\n\n${tagline}\n\nWhat tips would you add, ${communityName}?${linkStr}`,
      Hype: `🧠 KNOWLEDGE DROP for ${communityName}!\n\nThings I learned building ${name} that CHANGED everything:\n\n🔥 Speed > perfection\n🔥 Users don't care about your tech stack\n🔥 ${tagline}\n\nSave this. You'll thank me later.${linkStr}`,
      'Story-driven': `I almost quit building ${name} three times.\n\nEach time, I went back to the basics: ${tagline}\n\nHere's what kept me going and what I'd tell anyone in ${communityName} who's feeling stuck...${linkStr}`,
      Educational: `Framework for indie builders (learned building ${name}):\n\n• Week 1-2: Validate the problem\n• Week 3-4: Build MVP\n• Week 5+: Iterate based on feedback\n\n${tagline}\n\nThe most important skill? Knowing when NOT to add features.${linkStr}`,
      Funny: `Things I Googled while building ${name}:\n\n• "how to center a div" (day 1)\n• "is my startup idea good" (day 7)\n• "how to handle success" (day 30)\n• "how to handle 3 users" (day 31)\n\n${tagline}\n\nLessons from the trenches 😂${linkStr}`,
    },
  };

  return templates[postType]?.[tone] || `Check out ${name} — ${tagline}\n\n${desc}${priceStr}${linkStr}`;
}

export default function Generator() {
  const [communities, setCommunities] = useState([]);
  const [product, setProduct] = useState({});
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [tone, setTone] = useState('Casual');
  const [postType, setPostType] = useState('Launch Announcement');
  const [output, setOutput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cData = localStorage.getItem('postforge_communities');
    if (cData) setCommunities(JSON.parse(cData));
    const pData = localStorage.getItem('postforge_product');
    if (pData) setProduct(JSON.parse(pData));
  }, []);

  const handleGenerate = () => {
    const community = communities.find(c => String(c.id) === String(selectedCommunity));
    setGenerating(true);
    setOutput('');
    setTimeout(() => {
      const post = generatePost(product, community, tone, postType);
      setOutput(post);
      setGenerating(false);
    }, 800);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToHistory = () => {
    const community = communities.find(c => String(c.id) === String(selectedCommunity));
    const entry = {
      id: Date.now(),
      content: output,
      tone,
      postType,
      community: community?.name || 'General',
      platform: community?.platform || '',
      date: new Date().toISOString(),
    };
    const history = JSON.parse(localStorage.getItem('postforge_history') || '[]');
    localStorage.setItem('postforge_history', JSON.stringify([entry, ...history]));
  };

  return (
    <div>
      <h1 className="page-title">Generator</h1>
      <p className="page-subtitle">Create engaging posts tailored to your communities.</p>

      <div className="card">
        <div className="card-title">Post Settings</div>
        <div className="generator-controls">
          <div className="form-group">
            <label className="form-label">Community</label>
            <select
              className="form-select"
              value={selectedCommunity}
              onChange={e => setSelectedCommunity(e.target.value)}
            >
              <option value="">General</option>
              {communities.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Post Type</label>
            <select
              className="form-select"
              value={postType}
              onChange={e => setPostType(e.target.value)}
            >
              {POST_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Tone</label>
          <div className="tone-chips">
            {TONES.map(t => (
              <button
                key={t}
                className={`tone-chip ${tone === t ? 'active' : ''}`}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? <span className="spinner" /> : <Sparkles size={16} />}
            {generating ? 'Generating...' : 'Generate Post'}
          </button>
        </div>
      </div>

      {output && (
        <div className="card">
          <div className="card-title">Generated Post</div>
          <div className="generated-output">{output}</div>
          <div className="output-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSaveToHistory}>
              <Save size={14} />
              Save to History
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>
              <RefreshCw size={14} />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
