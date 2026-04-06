import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { messages, contextSnippet } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided." }), { status: 400 });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: `You are an expert, minimalist AI tutor embedded in a student's curriculum platform.
      
      CURRENT MODULE CONTEXT: The student is currently viewing a roadmap containing this text: "${contextSnippet}". Use this to understand what they are studying if they ask vague questions.
      
      CRITICAL INSTRUCTIONS FOR FORMATTING:
      1. Maintain context of the previous messages in this chat.
      2. NEVER write a "wall of text". Break your answers down using bullet points, numbered lists, and short paragraphs.
      3. MATH FORMATTING (CRITICAL): 
         - Use single $ for simple inline variables only.
         - You MUST use double $$ for ALL equations, formulas, and step-by-step derivations so they render on their own line as block math. 
      4. If providing a problem set, put the problem on one line, and the step-by-step solution below it using block math for every major step.`
    });

    const previousMessages = messages.slice(0, -1);
    const latestMessage = messages[messages.length - 1].content;

    const formattedHistory = previousMessages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: formattedHistory });

    // Stream the response from Gemini
    const result = await chat.sendMessageStream(latestMessage);

    // Create a native readable stream to send to the frontend
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            controller.enqueue(encoder.encode(chunkText));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
    
  } catch (error: any) {
    console.error("Tutor AI Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}