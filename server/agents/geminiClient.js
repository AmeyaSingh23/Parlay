const https = require('https');
const { getGcpAccessToken } = require('../auth/gcpAuth');

/**
 * Calls Gemini via Google Cloud Vertex AI REST API with robust fallback chain.
 *
 * @param {object} params
 * @param {string} params.systemInstruction - Persona & negotiation context
 * @param {Array<object>} params.contents - Message history
 * @param {number} [params.temperature=0.3] - LLM temperature
 * @param {number} [params.maxOutputTokens=1024] - Max output tokens
 * @returns {Promise<string>} Raw model response text
 */
async function callGeminiRaw({ systemInstruction, contents, temperature = 0.3, maxOutputTokens = 1024 }) {
  const token = await getGcpAccessToken();
  const projectId = process.env.GCP_PROJECT_ID || 'parlay-buildathon';
  const location = process.env.GCP_LOCATION || 'global';
  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
  const fallbackModel = 'gemini-3.5-flash';
  const tertiaryModel = 'gemini-2.5-flash';

  const payload = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json'
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const data = JSON.stringify(payload);

  const attempt = (modelName) => {
    return new Promise((resolve) => {
      const hostname = location === 'global'
        ? 'aiplatform.googleapis.com'
        : `${location}-aiplatform.googleapis.com`;

      const req = https.request({
        hostname,
        port: 443,
        path: `/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:generateContent`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 20000
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

  // 1. Try primary model (gemini-3.7-flash)
  let result = await attempt(primaryModel);
  if (!result.ok) {
    console.warn(`[GeminiClient] ${primaryModel} failed (${result.status}: ${result.error || ''}). Trying ${fallbackModel}...`);
    // 2. Try fallback (gemini-3.5-flash)
    result = await attempt(fallbackModel);
    if (!result.ok) {
      console.warn(`[GeminiClient] ${fallbackModel} failed. Trying ${tertiaryModel}...`);
      // 3. Try tertiary fallback (gemini-2.5-flash)
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
  } catch (e) {
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

module.exports = { callGeminiRaw, parseJsonResponse };
