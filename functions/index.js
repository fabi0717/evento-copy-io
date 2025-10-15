const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp();
}

const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.callGemini = onRequest(
  { secrets: [geminiApiKey], cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    try {
      const { prompt, isJson } = req.body;
      if (!prompt) {
        return res.status(400).send("Bad Request: 'prompt' is required.");
      }
      const apiKey = geminiApiKey.value();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
      const payload = { contents: [{ parts: [{ text: prompt }] }] };
      if (isJson) {
         payload.generationConfig = {
             responseMimeType: "application/json",
             responseSchema: {
                type: "OBJECT",
                properties: {
                  eventName: { type: "STRING" },
                  targetAudience: { type: "STRING" },
                  objective: { type: "STRING" },
                  kpis: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, value: { type: "STRING" } } } },
                  sections: { type: "OBJECT" }
                }
             }
         };
      }
      const geminiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        logger.error("Gemini API call failed:", errorBody);
        return res.status(geminiResponse.status).send(errorBody);
      }
      const result = await geminiResponse.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        logger.error("No content received from Gemini API.");
        return res.status(500).send("No content received from API.");
      }
      res.status(200).send({ text });
    } catch (error) {
      logger.error("Error in Cloud Function:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);