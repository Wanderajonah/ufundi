const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function isConfigured() {
  return !!(process.env.GROQ_API_KEY && process.env.GROQ_MODEL);
}

async function generateSms(event, data, recipient) {
  if (!isConfigured()) return null;

  const brand = process.env.AI_BRAND_NAME || "Ufundi";
  const model = process.env.GROQ_MODEL;

  const systemPrompt = `You are an SMS copywriter for ${brand}, a platform connecting clients with local fundis (artisans). 
Generate a concise (max 160 chars) SMS message for the given event and recipient. 
Use a professional but warm tone. Include key details naturally. Do NOT use emojis.`;

  const contextMap = {
    booking_request: {
      fundi: `A new job request is available for a ${data.category} job. Client contact: ${data.clientName}, ${data.clientPhone}. Address: ${data.address}. Description: ${data.description}. They have 5 minutes to respond. Write an SMS alerting the fundi.`,
      client: ""
    },
    booking_accepted: {
      client: `A fundi has accepted the booking. Fundi name: ${data.fundiName}, Phone: ${data.fundiPhone}. The fundi is on their way. Write an SMS for the client.`,
      fundi: ""
    },
    booking_cancelled: {
      client: `The fundi cancelled the booking. Reason: ${data.reason || "Not specified"}. Write an SMS for the client.`,
      fundi: `The client cancelled the booking. Reason: ${data.reason || "Not specified"}. Write an SMS for the fundi.`
    },
    status_on_the_way: {
      client: `The fundi is on the way to the client's location. Write an SMS for the client.`,
      fundi: ""
    },
    status_completed: {
      fundi: `The client confirmed the job is complete. Write a thank-you SMS for the fundi.`,
      client: ""
    },
    no_fundi_available: {
      client: `No available fundis were found for the job request. Write an SMS apologizing to the client.`,
      fundi: ""
    }
  };

  const context = contextMap[event]?.[recipient];
  if (!context) return null;

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate a concise SMS (max 160 characters) for this scenario: ${context}` }
    ],
    max_tokens: 80,
    temperature: 0.7
  };

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      console.error(`Groq API error (${res.status}): ${errText}`);
      return null;
    }

    const json = await res.json();
    let message = json?.choices?.[0]?.message?.content?.trim();
    if (!message) {
      console.error("Groq returned empty response");
      return null;
    }

    message = message.replace(/^["']+|["']+$/g, "");
    return message;
  } catch (error) {
    console.error("Groq request failed:", error.message);
    return null;
  }
}

module.exports = { generateSms, isConfigured };
