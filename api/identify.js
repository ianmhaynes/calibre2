const Anthropic = require("@anthropic-ai/sdk");
const Stripe = require("stripe");

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY);

const SYSTEM_PROMPT = `You are a master horologist and watch movement expert with encyclopedic knowledge of mechanical, automatic, quartz, and electronic watch movements from all eras and manufacturers.

When given an image of a watch movement, respond with ONLY a JSON object, no other text. Use this structure:
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
  "found_in": "Notable watches using this calibre",
  "value_insight": "2-3 sentences on the collectibility, desirability and approximate market value of watches containing this movement",
  "similar_watches": [
    {"name": "Watch name", "reason": "Why it is similar", "approx_price": "Price range"},
    {"name": "Watch name", "reason": "Why it is similar", "approx_price": "Price range"},
    {"name": "Watch name", "reason": "Why it is similar", "approx_price": "Price range"}
  ]
}`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageBase64, imageMediaType, paymentIntentId, isFree } = req.body;

    if (!imageBase64) return res.status(400).json({ error: "No image provided." });

    if (!isFree) {
      if (!paymentIntentId) return res.status(402).json({ error: "Payment required." });
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== "succeeded") return res.status(402).json({ error: "Payment not completed." });
      if (intent.metadata?.used === "true") return res.status(402).json({ error: "Payment already used." });
      await stripe.paymentIntents.update(paymentIntentId, { metadata: { used: "true" } });
    }

    const message = await anthropic.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imageMediaType || "image/jpeg", data: imageBase64 } },
          { type: "text", text: "Please identify this watch movement and include value insights and similar watches." }
        ]
      }]
    });

    const text = message.content.filter(b => b.type === "text").map(b => b.text).join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
