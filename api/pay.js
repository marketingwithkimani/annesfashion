export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { phone, amount } = req.body || {};
  if (!phone || !amount) {
    return res.status(400).json({ error: "Phone and amount are required" });
  }
  // Clean phone number
  let cleanPhone = String(phone).replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = "254" + cleanPhone.slice(1);
  try {
    const response = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
      method: "POST",
      headers: {
        "Authorization": "Basic a0tXcTZOanFqUjdPTGJGZVdESzI6dERrWkVxMkcwaHNCekVtZm5ZTmd4Sjc1Wjk4bG9PRE1lakxMdFMyQQ==",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: parseInt(amount, 10),
        phone_number: cleanPhone,
        channel_id: 13627,
        provider: "m-pesa",
        external_reference: `ORD-${Date.now()}`
      })
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
