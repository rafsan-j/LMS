import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { htmlContent, url } = await req.json();
    let contextText = "";

    // SCENARIO 1: User uploaded an HTML file
    if (htmlContent) {
      // 1. Remove all Script and Style blocks entirely
      let cleanHtml = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      cleanHtml = cleanHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
      
      // 2. Strip remaining HTML tags and extra spaces
      let plainText = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // 3. Give the AI a solid 4000 character chunk of pure text
      contextText = `HTML Content:\n${plainText.substring(0, 4000)}`;
    } 
    // SCENARIO 2: User pasted a URL
    else if (url) {
      try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        const html = await response.text();
        
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        let title = titleMatch ? titleMatch[1] : url;
        title = title.replace(/\s*[-|]\s*(YouTube|Udemy|Coursera)/i, '');

        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["'][^>]*>/i) || 
                          html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["'][^>]*>/i);
        const description = descMatch ? descMatch[1] : "An online course or playlist.";

        contextText = `URL: ${url}\nTitle: ${title}\nDescription: ${description}`;
      } catch (fetchError) {
        console.error("Failed to fetch URL:", fetchError);
        contextText = `URL: ${url}\nPlease infer the title and description from the URL structure.`;
      }
    } 
    else { return NextResponse.json({ error: "No content provided" }, { status: 400 }); }

    // Call Groq API natively
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are an AI that extracts curriculum metadata. 
            Based on the provided text, return a JSON object with:
            - "title": A clean, concise title of the actual course. Ignore generic titles like "Lecture".
            - "description": A detailed 2-3 sentence summary of what specific topics are taught. Ignore generic boilerplate text.
            - "category": A broad academic or skill category (e.g., Mathematics, Computer Science, Marketing, Cybersecurity).
            ONLY return valid JSON. Do not return markdown formatting.`
          },
          { role: "user", content: `Context:\n${contextText}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      })
    });

    if (!groqResponse.ok) throw new Error("Failed to fetch from Groq API");

    const data = await groqResponse.json();
    const result = JSON.parse(data.choices[0]?.message?.content || "{}");
    
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Metadata extraction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}