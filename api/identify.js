const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a master horologist and watch movement expert with encyclopedic knowledge of mechanical, automatic, quartz, and electronic watch movements from all eras and manufacturers.

When given an image or description of a watch movement, respond with ONLY a JSON object, no other text. Use this structure:
{
  "movement_name": "Full movement name",
  "manufacturer": "Manufacturer name",
  "type": "Automatic / Manual Wind / Quartz / etc.",
  "confidence": "High / Medium / Low",
  "confidence_reason": "Brief reason",
  "specs": [
    {"label": "Jewels", "value": "..."},
    {"label": "Frequency", "value": "..."},
    {"label": "Power Reserve", "value": "..."},
    {"label": "Diameter", "value": "..."},
    {"label": "Height", "value": "..."},
    {"label": "Year Introduced", "value": "..."}
  ],
  "key_identification": "Most distinctive visual features",
  "detailed_analysis": "3-4 sentences of expert analysis",
  "found_in": "Notable watches using this calibre"
}`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { description, imageBase64, imageMediaType } = req.body;

    if (!description && !imageBase64) {
      return res.status(400).json({ error: "Provide an image or description." });
    }

    let content;
    if (imageBase64) {
      content = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: imageMediaType || "image/jpeg",
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: description?.trim() ? `Additional description: ${description}` : "Please identify this watch movement.",
        },
      ];
    } else {
      content = `Please identify this watch movement: ${description}`;
    }

    const message = await client.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
