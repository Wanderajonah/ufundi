const fs = require("fs");
const path = require("path");
const { guessTradeFromText } = require("../utils/trades");
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_VISION_MODEL = "qwen/qwen3.6-27b";

// Models that only accept text inputs. If GROQ_VISION_MODEL is accidentally
// pointed at the platform's text-only chat model (e.g. llama-3.1-8b-instant),
// image requests would fail with a 400. Fall back to a vision-capable model so
// photo analysis keeps working.
const TEXT_ONLY_MODELS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "llama-3.3-70b-versatile",
  "llama-3.2-1b-preview",
  "llama-3.2-3b-preview",
  "gemma2-9b-it",
  "gemma-7b-it",
  "mixtral-8x7b-32768",
]);

function resolveVisionModel() {
  const configured = (process.env.GROQ_VISION_MODEL || "").trim();
  // Only trust the configured model if it isn't a known text-only model.
  if (configured && !TEXT_ONLY_MODELS.has(configured)) return configured;
  if (configured) {
    console.warn(
      `[supportBot] GROQ_VISION_MODEL="${configured}" is text-only; using ${DEFAULT_VISION_MODEL} for image analysis. Set GROQ_VISION_MODEL to a vision-capable model.`
    );
  }
  return DEFAULT_VISION_MODEL;
}

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

// Trade categories the platform supports (matches mobile browse categories)
const TRADE_CATEGORIES = ["plumber", "electrician", "carpenter", "painter"];

function isConfigured() {
  return !!(process.env.GROQ_API_KEY && process.env.GROQ_MODEL);
}

const SYSTEM_PROMPT = `You are a helpful customer support assistant for FundiLink, a platform that connects clients with local fundis (artisans/skilled workers) in Uganda.

Your role:
- Help users understand how the platform works
- Answer questions about booking, pricing, payments, and safety
- Guide users through common tasks (creating a booking, accepting jobs, etc.)
- Be friendly, professional, and concise in your responses
- If you don't know something, say so honestly
- Keep responses brief (2-3 sentences max when possible)

Key platform features:
- Clients can browse fundis by category (plumbers, electricians, carpenters, painters, etc.)
- Bookings have a 5-minute response window for fundis
- Price negotiation happens after booking acceptance
- Fundis are matched by proximity and availability
- Communication happens through the app's chat and socket system
- SMS notifications are sent for key events
- Payments and ratings come after job completion

Common issues:
- If a fundi doesn't respond within 5 minutes, the booking moves to the next available fundi
- Prices can be negotiated between client and fundi after acceptance
- Cancellations can be made by either party before the job starts`;

const VISION_SYSTEM_PROMPT = `You are the FundiLink problem-detection assistant. A customer uploads a photo of a home or property problem (e.g. a leaking pipe, broken socket, cracked wall, damaged furniture).

Look at the image carefully and:
1. Identify what is wrong in plain, friendly language.
2. Detect which skilled fundi (artisan) category can fix it. Use exactly one of: plumbing, electrical, carpentry, painting, or general if unsure.

Respond with ONLY a JSON object in this exact shape (no markdown, no commentary):
{
  "category": "plumbing",
  "summary": "A short, friendly explanation of the problem and which kind of fundi can help."
}`;

async function groqChat(body, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      // transient network failure
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      console.error(`Groq network error: ${err.message}`);
      return null;
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      console.error(`Groq API error (${res.status}): ${errText}`);
      return null;
    }

    const json = await res.json();
    let reply = json?.choices?.[0]?.message?.content?.trim();
    if (!reply) return null;
    return reply.replace(/^["']+|["']+$/g, "");
  }
  return null;
}

/**
 * Read an uploaded chat image and return a base64 data URL. Supports legacy
 * disk files, data URLs, and remote http(s) URLs (incl. Supabase Storage).
 */
async function readUploadAsDataUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:")) return imageUrl;

  if (imageUrl.startsWith("http")) {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") || "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch (e) {
      return null;
    }
  }

  const rel = imageUrl.replace(/^\/uploads\//, "").split("?")[0];

  // legacy files on local disk
  const uploadRoot = path.join(__dirname, "../../uploads");
  const filePath = path.join(uploadRoot, rel);
  if (fs.existsSync(filePath)) {
    const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] || "image/jpeg";
    return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
  }

  return null;
}

function parseCategory(raw) {
  if (!raw) return null;
  const value = String(raw).toLowerCase().replace(/[^a-z]/g, "");
  // Direct match
  if (TRADE_CATEGORIES.includes(value)) return value;
  // Map gerund/variant forms returned by vision models
  const GERUND_MAP = {
    plumbing: "plumber",
    electricalelectrics: "electrician",
    electrical: "electrician",
    carpentry: "carpenter",
    painting: "painter",
    masonry: "carpenter",
  };
  return GERUND_MAP[value] || null;
}

/** Extract a JSON object from a model response (handles <think> blocks, code fences, stray text). */
function extractJson(raw) {
  if (!raw) return null;
  let cleaned = raw;
  // pull out fenced json blocks
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) cleaned = fence[1];
  // strip closed think/reasoning blocks (their braces can pollute parsing)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, " ").replace(/<thought>[\s\S]*?<\/thought>/gi, " ");
  // scan every brace-balanced span and keep the last one that parses
  let last = null;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < cleaned.length; j++) {
      if (cleaned[j] === "{") depth++;
      else if (cleaned[j] === "}") {
        depth--;
        if (depth === 0) {
          try {
            last = JSON.parse(cleaned.slice(i, j + 1));
          } catch (e) {
            // not valid JSON; keep scanning
          }
          break;
        }
      }
    }
  }
  if (last) return last;
  // last resort: regex keys
  const cat = cleaned.match(/"category"\s*:\s*"([^"]+)"/);
  const sum = cleaned.match(/"summary"\s*:\s*"([^"]*)"/);
  if (cat || sum) return { category: cat && cat[1], summary: sum && sum[1] };
  return null;
}

/** Analyze an uploaded problem photo with the Groq vision model. */
async function analyzeProblemImage(imageUrl, userText) {
  const imageData = await readUploadAsDataUrl(imageUrl);
  if (!imageData) return { reply: null, category: null };

  const content = [
    {
      type: "text",
      text:
        "Look at this photo of a home or property problem. " +
        (userText ? `The customer added: "${userText}". ` : "") +
        "Describe what is wrong and identify which fundi can fix it. " +
        'Think briefly, then respond with a JSON object only: {"category": "plumbing|electrical|carpentry|painting|general", "summary": "short friendly description of the problem and which fundi can help"}.'
    },
    { type: "image_url", image_url: { url: imageData } }
  ];

  const body = {
    model: resolveVisionModel(),
    messages: [
      { role: "system", content: VISION_SYSTEM_PROMPT },
      { role: "user", content }
    ],
    max_tokens: 1200,
    temperature: 0.2
  };

  const raw = await groqChat(body);
  if (!raw) return { reply: null, category: null };

  const parsed = extractJson(raw);
  if (!parsed) {
    console.error("Could not parse vision response:", raw.slice(0, 300));
    return { reply: null, category: null };
  }

  const summary = String(parsed.summary || "").trim();
  const category = parseCategory(parsed.category);
  if (!summary) return { reply: null, category };
  return { reply: summary, category };
}

async function getBotResponse({ messages, imageUrl, userText } = {}) {
  const lastUser = [...(messages || [])]
    .reverse()
    .find((m) => m?.role === "user")?.content;

  // Image analysis path
  if (imageUrl) {
    if (isConfigured()) {
      const vision = await analyzeProblemImage(imageUrl, userText || lastUser);
      if (vision.reply) {
        return { reply: vision.reply, category: vision.category };
      }
    } else {
      console.warn(
        "[supportBot] GROQ not configured (set GROQ_API_KEY and GROQ_MODEL) — image analysis skipped"
      );
    }
    // Fallback: no AI or analysis failed
    const fallbackCategory = guessTradeFromText(lastUser);
    if (fallbackCategory) {
      return {
        reply:
          "I wasn't able to fully analyze that photo right now, but based on your message it looks like a job for a " +
          `${fallbackCategory}. Here are nearby fundis who can help.`,
        category: fallbackCategory,
      };
    }
    return {
      reply:
        "I got your photo, but I couldn't analyze it automatically right now. Tell me what the problem is (e.g. leaking pipe, broken socket) and I'll find a nearby fundi for you.",
      category: null,
    };
  }

  // Text-only path
  if (!isConfigured()) {
    return { reply: fallbackResponse(messages), category: null };
  }

  const model = process.env.GROQ_MODEL;

  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...(messages || []).slice(-10)
    ],
    max_tokens: 300,
    temperature: 0.7
  };

  const reply = await groqChat(body);
  if (!reply) return { reply: fallbackResponse(messages), category: null };
  return { reply, category: null };
}

function fallbackResponse(messages) {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const m = lastMsg;

  const rules = [
    {
      keys: ["human agent", "real person", "talk to someone", "customer care", "contact support", "reach support", "support team"],
      reply: "For direct help, open Help & Support from your profile and describe your issue — our team will get back to you. I can also point you in the right direction now if you tell me what's wrong.",
    },
    {
      keys: ["how do i book", "how to book", "book a fundi", "book fundi", "make a booking", "create a booking", "hire a fundi", "find a fundi", "request a fundi"],
      reply: "To book a fundi: go to Browse, choose a category (plumbing, electrical, carpentry, painting...), pick a fundi near you, describe your job, and send the request. They'll respond within 5 minutes.",
    },
    {
      keys: ["become a fundi", "join as fundi", "sign up as fundi", "register as fundi", "work with fundilink", "earn money", "how do i earn"],
      reply: "You can register as a fundi during sign up or switch roles in the app. Complete your profile, add your skills and portfolio, then go online to start receiving booking requests from clients nearby.",
    },
    {
      keys: ["cancel"],
      reply: "To cancel a booking, open the booking details and tap Cancel. Both clients and fundis can cancel before the job starts.",
    },
    {
      keys: ["price", "cost", "fee", "how much", "negotiate", "negotiation", "charge"],
      reply: "Prices are negotiated between you and the fundi after a booking is accepted. Discuss the work and agree on a fair price in the app before the job starts.",
    },
    {
      keys: ["payment", "pay", "mobile money", "mpesa", "mtn", "airtel", "refund"],
      reply: "Payments are arranged between you and the fundi directly. Agree on the amount and method before work begins, and confirm the job is complete before paying.",
    },
    {
      keys: ["plumber", "plumbing", "electrician", "electrical", "carpenter", "carpentry", "painter", "painting", "mechanic", "welder", "tiles", "masonry"],
      reply: "FundiLink has skilled fundis across categories like plumbing, electrical, carpentry, and painting. Go to Browse, pick the category you need, and choose a verified fundi near you.",
    },
    {
      keys: ["fundi", "artisan", "worker", "skilled"],
      reply: "Fundis are vetted skilled workers on FundiLink. Browse them by category, compare ratings and reviews, and pick the best fit near you.",
    },
    {
      keys: ["how long", "how fast", "response time", "minute", "wait", "quickly", "respond"],
      reply: "Fundis have 5 minutes to respond to a booking request. If there's no response, the request automatically moves to the next available fundi.",
    },
    {
      keys: ["location", "near", "distance", "far", "nearby"],
      reply: "FundiLink matches you with fundis near your location. You'll see each fundi's distance before you choose, so you can pick the closest one.",
    },
    {
      keys: ["forgot password", "reset password", "can't log in", "cannot log in", "login", "otp", "verification code", "code not working"],
      reply: "If you're having trouble logging in, use the phone number you registered with to request a new OTP. The 4-digit code arrives by SMS and expires after a short time.",
    },
    {
      keys: ["safe", "secure", "trust", "scam", "verified", "verification"],
      reply: "FundiLink profiles show ratings, reviews, completed jobs, and verification status so you can choose trusted fundis. Always communicate and agree terms inside the app.",
    },
    {
      keys: ["rating", "review", "rate", "stars"],
      reply: "After a job is completed, you can rate and review your fundi. This helps other clients choose trusted fundis and helps fundis build a strong reputation.",
    },
    {
      keys: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "how are you"],
      reply: "Hello! Welcome to FundiLink. I'm here to help with bookings, pricing, payments, and anything else about the platform. What can I do for you?",
    },
    {
      keys: ["help", "menu", "options", "what can you do", "what do you do", "how does it work", "how it works"],
      reply: "I can help with: booking a fundi, how prices and payments work, fundi response times, safety and verification, and becoming a fundi. Just ask!",
    },
    {
      keys: ["thank", "thanks", "appreciate"],
      reply: "You're welcome! If you need anything else, just ask. Enjoy using FundiLink!",
    },
  ];

  for (const rule of rules) {
    if (rule.keys.some((k) => m.includes(k))) return rule.reply;
  }

  return "I'm not sure I understand. You can ask me about booking a fundi, pricing and payments, response times, safety, or how to become a fundi.";
}

module.exports = { getBotResponse, isConfigured };
