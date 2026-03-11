const Stripe = require("stripe");
const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { sessionId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"]
    });

    if (session.payment_status === "paid") {
      return res.status(200).json({
        paid: true,
        paymentIntentId: session.payment_intent.id
      });
    } else {
      return res.status(200).json({ paid: false });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
