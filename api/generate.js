import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro-latest" });
    const result = await model.generateContent("Say: Gemini API integration test");
    const response = await result.response;
    const text = response.text();
    res.status(200).json({ text });
  } catch (error) {
    console.error("Generation error:", error); 
    res.status(500).json({ error: error.message || "Failed to generate" });
  }
}

