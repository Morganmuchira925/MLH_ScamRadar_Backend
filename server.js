import express from "express";
import cors from "cors";
import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(express.json());

// --- KEEP-ALIVE HACK ---
// This prevents Node from exiting if the event loop feels "empty"
setInterval(() => {}, 1000); 

// 1. Better Error Catching
process.on('uncaughtException', (err) => {
    console.error('❌ CRITICAL ERROR:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
});

// 2. Initialize Gemini
let model;
try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    console.log("✅ Gemini Model Loaded.");
} catch (e) {
    console.error("❌ Gemini Init Failed:", e.message);
}

// 3. API Endpoint
app.post("/api/chat", async (req, res) => {
    try {
        const { message, image } = req.body;

        // Construct the parts array correctly for Multimodal input
        let parts = [];

        // 1. Add the text instruction
        // We add a specific command to read image text if an image exists
        const instruction = image 
            ? `OCR INSTRUCTION: Read every piece of text visible in the attached image. 
               ANALYSIS: Compare that text and the following user message for scams: ${message}`
            : message;
            
        parts.push({ text: instruction });

        // 2. Add the image part explicitly
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
        res.json({ reply: response.text() });
    } catch (err) {
        console.error("❌ API Error:", err.message);
        res.status(500).json({ error: "Analysis failed. Ensure the image is a clear JPG/PNG." });
    }
});

// 4. Start Server with explicit Error Handling
const PORT = 5001;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server is active on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already being used by another program!`);
    } else {
        console.error('❌ Server failed to start:', err);
    }
});