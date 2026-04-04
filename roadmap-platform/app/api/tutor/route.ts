import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // We now accept the full conversation history and the page context
    const { messages, contextSnippet } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: `You are an expert, minimalist AI tutor embedded in a student's curriculum platform.
      
      CURRENT MODULE CONTEXT: The student is currently viewing a roadmap containing this text: "${contextSnippet}". Use this to understand what they are studying if they ask vague questions.
      
      CRITICAL INSTRUCTIONS FOR FORMATTING:
      1. Maintain context of the previous messages in this chat.
      2. NEVER write a "wall of text". Break your answers down using bullet points, numbered lists, and short paragraphs.
      3. **MATH FORMATTING (CRITICAL)**: 
         - Use single $ for simple inline variables only (e.g., let $x = 5$).
         - You MUST use double $$ for ALL equations, formulas, and step-by-step derivations so they render on their own line as block math. 
         - Example of bad formatting: The derivative is $\frac{dy}{dx} = 2x$.
         - Example of good formatting: The derivative is: $$\\frac{dy}{dx} = 2x$$
      4. If providing a problem set, put the problem on one line, and the step-by-step solution below it using block math for every major step.`
    });

    // 1. Separate the history from the latest message
    const previousMessages = messages.slice(0, -1);
    const latestMessage = messages[messages.length - 1].content;

    // 2. Map frontend roles ('user'/'ai') to Gemini roles ('user'/'model')
    const formattedHistory = previousMessages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // 3. Start a stateful chat session
    const chat = model.startChat({
      history: formattedHistory,
    });

    // 4. Send the new message
    const result = await chat.sendMessage(latestMessage);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });
    
  } catch (error: any) {
    console.error("Tutor AI Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}