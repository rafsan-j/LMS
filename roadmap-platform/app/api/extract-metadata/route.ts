import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize the AI with your secure server-side key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { htmlContent } = await req.json();

    // We use Gemini 1.5 Flash because it is insanely fast and cheap (free tier)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      // We explicitly tell the AI to always return pure JSON
      generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
      You are an expert curriculum parser. Analyze the following HTML roadmap.
      Extract the core topic and generate a JSON object with EXACTLY these keys:
      - "title": A concise, professional title (e.g., "Advanced Calculus Mastery").
      - "category": A single-word broad category (e.g., "Mathematics", "Computer Science").
      - "description": A 2-sentence professional summary of what the student will learn.

      HTML Content:
      ${htmlContent}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json(JSON.parse(responseText));
  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}