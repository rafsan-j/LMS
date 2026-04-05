import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, targetDeadline, userProfile } = body;

    const prompt = `You are the core intelligence of a Learning Operating System. Your job is to assign Urgency, Importance, and Difficulty scores to a curriculum.

    USER CONTEXT (The Learner):
    - Primary Goals: ${userProfile?.primary_goals || 'Not provided'}
    - Learning Style: ${userProfile?.learning_style || 'Not provided'}
    - Weekly Capacity: ${userProfile?.weekly_capacity_hours || 10} hours

    TARGET CURRICULUM:
    - Title: ${title}
    - Description: ${description || 'No description provided'}
    - Target Deadline: ${targetDeadline || 'No strict deadline'}

    INSTRUCTIONS:
    Evaluate the following on a scale of 1 to 10 (integers only):
    1. Urgency (1-10): How imminent is the deadline compared to their weekly capacity? If there is no deadline, default to 5.
    2. Importance (1-10): How strongly does this specific topic align with their "Primary Goals"?
    3. Difficulty (1-10): Based on the topic complexity and their specific "Learning Style", how challenging will this be?

    You MUST respond strictly with a valid JSON object matching this exact structure:
    {
      "urgency": 8,
      "importance": 9,
      "difficulty": 6,
      "reasoning": "A concise 1-2 sentence explanation of why you calculated these specific scores based on the user's profile."
    }`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // FIXED: Updated to the currently supported Groq model
        messages: [{ role: "system", content: prompt }],
        response_format: { type: "json_object" }, 
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to fetch from Groq API");
    }

    const parsedData = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(parsedData);
    
  } catch (error: any) {
    console.error("Priority Engine Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}