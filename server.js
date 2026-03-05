import express from "express";
import cors from "cors";
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

// 1. IMPROVED CORS CONFIGURATION
app.use(cors({
  // Add your Netlify URL here so the browser allows the connection
  origin: ['http://localhost:5173', 'https://scamradarke.netlify.app'], 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 2. The Fix for the PathError
app.options('/:any*', cors());

app.use(express.json());

// Initialize Gemini
let model;
try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Note: Ensure your API key has access to flash-lite or use "gemini-1.5-flash"
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); 
    console.log("✅ Gemini Model Loaded.");
} catch (e) {
    console.error("❌ Gemini Init Failed:", e.message);
}

app.post("/api/chat", async (req, res) => {
    try {
        const { message, image } = req.body;
        let parts = [];

        // Explicit OCR + Security prompt
        const instruction = image 
            ? `OCR INSTRUCTION: Read every piece of text visible in the attached image. 
               ANALYSIS: Check the image text and this message for scams: ${message}. 
               Respond in plain text without asterisks.`
            : message;
            
        parts.push({ text: instruction });

        if (image && image.inlineData) {
            parts.push({
                inlineData: {
                    data: image.inlineData.data,
                    mimeType: image.inlineData.mimeType
                }
            });
        }

        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        const response = await result.response;
        
        // Remove asterisks here as well to be safe
        const cleanText = response.text().replace(/\*/g, '');
        res.json({ reply: cleanText });

    } catch (err) {
        console.error("❌ API Error:", err.message);
        res.status(500).json({ error: "Analysis failed. Ensure the image is clear." });
    }
});

// 3. DYNAMIC PORT BINDING (Fixes Render Deployment)
// Render sets the PORT environment variable. Locally it defaults to 5001.
const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is active on port ${PORT}`);
});