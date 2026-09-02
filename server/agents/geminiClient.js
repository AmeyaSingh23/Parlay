const https = require('https');
const { execSync } = require('child_process');

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Retrieves a valid GCP OAuth access token using gcloud CLI.
 * Cached for 45 minutes to minimize subshell overhead.
 */
function getGcpAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }
  try {
    const token = execSync('gcloud auth print-access-token', { timeout: 10000 }).toString().trim();
    cachedToken = token;
    tokenExpiresAt = now + (45 * 60 * 1000); // 45 minutes
    return token;
  } catch (err) {
    console.error('[GeminiClient] Error obtaining gcloud token:', err.message);
    if (cachedToken) return cachedToken;
    throw new Error('GCP authentication failed. Please ensure gcloud auth is configured.');
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
  const location = process.env.GCP_LOCATION || 'us-central1';
  const primaryModel = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const fallbackModel = 'gemini-2.5-pro';

  const token = getGcpAccessToken();

  // Convert conversation history to Gemini contents format
  const contents = [];
  if (history && history.length > 0) {
    for (const h of history) {
      contents.push({
        role: h.role === 'buyer' || h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      });
    }
  } else {
    contents.push({
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
      maxOutputTokens: 1000,
      responseMimeType: 'application/json'
    }
  };

  const attempt = (modelName) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const req = https.request({
        hostname: `${location}-aiplatform.googleapis.com`,
        path: `/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:generateContent`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 30000
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

      req.on('error', (e) => reject(e));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out calling model ${modelName}`));
      });

      req.write(data);
      req.end();
    });
  };

  // Try primary model
  let result = await attempt(primaryModel);
  if (!result.ok) {
    console.warn(`[GeminiClient] Primary model ${primaryModel} failed (${result.status}). Trying fallback ${fallbackModel}...`);
    result = await attempt(fallbackModel);
    if (!result.ok) {
      throw new Error(`Gemini generation failed: ${result.body || result.error || result.status}`);
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
  // Strip Markdown code fences if returned
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(clean);
  } catch (err) {
    // Attempt regex extraction of outermost JSON object
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
