const https = require('https');
const { execSync } = require('child_process');
const { GoogleAuth } = require('google-auth-library');

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Retrieves a valid GCP OAuth access token.
 * Uses GoogleAuth (Cloud Run service account or ADC) first,
 * falling back to local gcloud CLI if running on developer workstation.
 */
async function getGcpAccessToken(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  // 1. Try GoogleAuth (works natively inside Google Cloud Run)
  try {
    const token = await auth.getAccessToken();
    const tokenVal = typeof token === 'string' ? token : token?.token;
    if (tokenVal) {
      cachedToken = tokenVal;
      tokenExpiresAt = now + (15 * 60 * 1000); // 15 minutes max
      return tokenVal;
    }
  } catch (authErr) {
    // Fall back to gcloud CLI for local environment
  }

  // 2. Fallback to gcloud CLI
  try {
    const token = execSync('gcloud auth print-access-token', { timeout: 20000 }).toString().trim();
    cachedToken = token;
    tokenExpiresAt = now + (15 * 60 * 1000);
    return token;
  } catch (err) {
    console.error('[GeminiClient] Error obtaining token:', err.message);
    if (cachedToken) return cachedToken;
    throw new Error('GCP authentication failed. Please ensure gcloud or service account credentials exist.');
  }
}

/**
 * Sends a structured generation request to Gemini on Vertex AI.
 *
 * @param {string} systemPrompt - Instructions for the agent role
 * @param {Array<{role: 'user' | 'model', text: string}>} history - Conversation turns
 * @param {object} [options] - Temperature, model override
 * @returns {Promise<string>} Raw model response text
 */
async function callGeminiRaw(systemPrompt, history, options = {}) {
  const projectId = process.env.GCP_PROJECT_ID || 'parlay-buildathon';
  const location = process.env.GCP_LOCATION || 'global';
  const primaryModel = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const fallbackModel = 'gemini-2.0-flash';
  const tertiaryModel = 'gemini-1.5-flash';

  let token = await getGcpAccessToken();

  const hostname = location === 'global'
    ? 'aiplatform.googleapis.com'
    : `${location}-aiplatform.googleapis.com`;

  // Convert conversation history to Gemini contents format with strict alternation
  const contents = [];
  if (history && history.length > 0) {
    for (const h of history) {
      const targetRole = (h.role === 'buyer' || h.role === 'user') ? 'user' : 'model';
      // Merge consecutive turns of the same role to strictly alternate
      if (contents.length > 0 && contents[contents.length - 1].role === targetRole) {
        contents[contents.length - 1].parts[0].text += `\n${h.text}`;
      } else {
        contents.push({
          role: targetRole,
          parts: [{ text: h.text }]
        });
      }
    }
  }

  // Gemini API requires contents to start with role 'user'
  if (contents.length === 0 || contents[0].role !== 'user') {
    contents.unshift({
      role: 'user',
      parts: [{ text: 'Please begin the negotiation.' }]
    });
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: contents,
    generationConfig: {
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json'
    }
  };

  const attempt = (modelName) => {
    return new Promise((resolve) => {
      const data = JSON.stringify(payload);
      const req = https.request({
        hostname: hostname,
        path: `/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:generateContent`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 25000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              resolve({ ok: true, text });
            } catch (e) {
              resolve({ ok: false, status: 500, error: 'JSON parse error on candidate text' });
            }
          } else {
            resolve({ ok: false, status: res.statusCode, body });
          }
        });
      });

      req.on('error', (e) => resolve({ ok: false, status: 500, error: e.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 408, error: `Timeout on ${modelName}` });
      });

      req.write(data);
      req.end();
    });
  };

  // 1. Try primary model (gemini-2.5-flash)
  let result = await attempt(primaryModel);
  if (!result.ok && result.status === 401) {
    console.warn(`[GeminiClient] Received 401 from ${primaryModel}. Refreshing token and retrying...`);
    token = await getGcpAccessToken(true);
    result = await attempt(primaryModel);
  }

  if (!result.ok) {
    console.warn(`[GeminiClient] ${primaryModel} returned status ${result.status}. Attempting fallback ${fallbackModel}...`);
    // 2. Try fallback (gemini-2.0-flash)
    result = await attempt(fallbackModel);
    if (!result.ok && result.status === 401) {
      token = await getGcpAccessToken(true);
      result = await attempt(fallbackModel);
    }
    if (!result.ok) {
      console.warn(`[GeminiClient] Fallback ${fallbackModel} failed. Attempting ${tertiaryModel}...`);
      // 3. Try tertiary fallback (gemini-1.5-flash)
      result = await attempt(tertiaryModel);
      if (!result.ok) {
        console.error(`[GeminiClient] All cloud models failed. Using deterministic fallback.`);
        return JSON.stringify({
          message: "We are reviewing your pricing structure against our volume requirements and current market supply.",
          action: "continue"
        });
      }
    }
  }

  return result.text;
}

/**
 * Parses JSON response safely from LLM output.
 */
function parseJsonResponse(rawText) {
  if (!rawText) return null;
  let clean = rawText.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(clean);
  } catch (err) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {}
    }
    console.error('[GeminiClient] Failed to parse JSON from output:', rawText);
    return null;
  }
}

module.exports = { callGeminiRaw, parseJsonResponse };
