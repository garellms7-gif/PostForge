/**
 * Post to Discord via webhook URL.
 */
export async function postToDiscord(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord webhook failed (${res.status}): ${text}`);
  }
  return { success: true, platform: 'Discord' };
}

/**
 * Post to LinkedIn via Share API using an access token.
 */
export async function postToLinkedIn(token, content) {
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!profileRes.ok) {
    throw new Error(`LinkedIn profile fetch failed (${profileRes.status})`);
  }
  const profile = await profileRes.json();
  const personUrn = `urn:li:person:${profile.sub}`;

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LinkedIn post failed (${res.status}): ${text}`);
  }
  return { success: true, platform: 'LinkedIn' };
}

/**
 * Post to Reddit using username/password OAuth and the submit API.
 */
export async function postToReddit(credentials, subreddit, content) {
  const { username, password, appId, appSecret } = credentials;

  // Get access token via password grant
  const authRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${appId}:${appSecret}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    }),
  });
  if (!authRes.ok) {
    throw new Error(`Reddit auth failed (${authRes.status})`);
  }
  const authData = await authRes.json();
  const token = authData.access_token;

  // Extract title from content (first line) and body (rest)
  const lines = content.split('\n');
  const title = lines[0].replace(/[^\w\s!?.,'"-]/g, '').trim().slice(0, 300) || 'New Post';
  const body = lines.slice(1).join('\n').trim();

  const res = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PostForge/1.0',
    },
    body: new URLSearchParams({
      api_type: 'json',
      kind: 'self',
      sr: subreddit,
      title,
      text: body,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Reddit submit failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  if (data.json?.errors?.length) {
    throw new Error(`Reddit submit error: ${JSON.stringify(data.json.errors)}`);
  }
  return { success: true, platform: 'Reddit' };
}

/**
 * Post to Twitter/X using OAuth 1.0a (v2 tweet endpoint).
 */
export async function postToTwitter(credentials, content) {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = credentials;

  // OAuth 1.0a signature generation
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const method = 'POST';
  const url = 'https://api.twitter.com/2/tweets';

  const sigBaseParams = { ...oauthParams };
  const paramString = Object.keys(sigBaseParams)
    .sort()
    .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(sigBaseParams[k])}`)
    .join('&');

  const sigBase = `${method}&${encodeRFC3986(url)}&${encodeRFC3986(paramString)}`;
  const sigKey = `${encodeRFC3986(apiSecret)}&${encodeRFC3986(accessTokenSecret)}`;

  const signature = await hmacSha1(sigKey, sigBase);
  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
    .join(', ');

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: content.slice(0, 280) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Twitter post failed (${res.status}): ${text}`);
  }
  return { success: true, platform: 'Twitter/X' };
}

function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1(key, data) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Route a post to the correct platform API.
 */
export async function postToPlatform(community, content) {
  const platform = community.platform;
  const creds = community.credentials || {};

  switch (platform) {
    case 'Discord':
      return postToDiscord(creds.webhookUrl, content);
    case 'LinkedIn':
      return postToLinkedIn(creds.accessToken, content);
    case 'Reddit':
      return postToReddit(
        { username: creds.username, password: creds.password, appId: creds.appId, appSecret: creds.appSecret },
        creds.subreddit,
        content
      );
    case 'X':
      return postToTwitter(
        { apiKey: creds.apiKey, apiSecret: creds.apiSecret, accessToken: creds.accessToken, accessTokenSecret: creds.accessTokenSecret },
        content
      );
    default:
      throw new Error(`Posting to ${platform} is not supported yet.`);
  }
}
