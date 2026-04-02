export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the API key from environment variable (set in Vercel dashboard, never exposed to browser)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const prompt = `You are analyzing a Cyberpunk 2077 Breach Protocol screenshot. Extract ALL of the following carefully:

1. CODE MATRIX: The grid of 2-character hex codes on the LEFT side under "CODE MATRIX". Read every row left-to-right, top-to-bottom. Count rows and columns carefully — do not skip any.

2. SEQUENCES: Listed on the RIGHT side under "SEQUENCE REQUIRED TO UPLOAD DAEMON". Each sequence has a name (like BASIC DATAMINE, ADVANCED DATAMINE, EXPERT DATAMINE) and a short list of 2-4 codes. Extract ALL sequences visible, in the order they appear.

3. BUFFER SIZE: Count the number of empty buffer slot boxes shown at the top center of the screen. This is typically between 4 and 8.

Respond ONLY with a raw JSON object. No markdown, no code fences, no explanation — just the JSON:
{"bufferSize":6,"gridSize":6,"matrix":[["BD","55","E9","55","1C","55"],["7A","7A","1C","55","7A","BD"],["55","7A","1C","7A","BD","1C"],["1C","1C","55","55","BD","1C"],["BD","55","55","7A","55","BD"],["55","7A","7A","55","1C","E9"]],"sequences":[{"name":"BASIC DATAMINE","codes":["E9","1C"]},{"name":"ADVANCED DATAMINE","codes":["1C","BD"]},{"name":"EXPERT DATAMINE","codes":["1C","7A","E9"]}]}

Important rules: all codes must be exactly 2 uppercase hex characters (1C 7A 55 BD E9 FF only); all matrix rows must have equal length matching gridSize; include every sequence visible; if buffer count is unclear default to 6.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/png',
                data: imageBase64
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    const text = data.content?.map(b => b.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
