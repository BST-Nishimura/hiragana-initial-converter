// api/convert.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function writeJson(res, status, obj) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).end(JSON.stringify(obj));
}

async function readJsonBody(req) {
  // Vercel環境では req.body が undefined のことがあるためストリームから読む
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function isValidName(name) {
  if (typeof name !== "string") return false;
  const s = name.trim();
  return s && s.length <= 50 && /^[A-Za-z \-']+$/.test(s);
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(200).end();
    }
    if (req.method !== "POST") {
      return writeJson(res, 405, { error: "Method not allowed. Use POST." });
    }
    if (!process.env.OPENAI_API_KEY) {
      return writeJson(res, 500, { error: "API key not configured" });
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return writeJson(res, 400, { error: "Invalid JSON body" });
    }

    const name = (body?.name || "").trim();
    if (!isValidName(name)) {
      return writeJson(res, 400, {
        error:
          "Send 'name' with only letters, spaces, hyphen, apostrophe (max 50).",
      });
    }

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      instructions:
        "You are a Japanese transliteration assistant. Return ONLY the most common Japanese reading of the given Latin-alphabet personal name in HIRAGANA. No kanji, no katakana, no romaji, no quotes, no extra text.",
      input: `Name: ${name}\nOutput:`,
      temperature: 0.2,
      max_output_tokens: 50,
    });

    const rawOut = (resp.output_text || "").trim();
    const hira = (rawOut.match(/[ぁ-んー]+/g) || [""]).join("");
    if (!hira) return writeJson(res, 500, { error: "Failed to convert to hiragana." });

    return writeJson(res, 200, { hiragana: hira });
  } catch (e) {
    console.error("convert error:", e);
    return writeJson(res, 500, { error: e.message || "Server error" });
  }
}