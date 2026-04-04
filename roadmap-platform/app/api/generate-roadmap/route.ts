import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, level } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }

    // We use gemini-2.5-flash for its massive context window and speed
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are an expert curriculum architect. Your job is to generate a comprehensive, highly-structured HTML learning roadmap.

You MUST use EXACTLY the following HTML structure, classes, and CSS. Only change the text content, titles, descriptions, YouTube/Khan Academy links (make up highly relevant search queries or real links if you know them), and practice problems to match the requested topic.

CRITICAL RULES:
1. ALWAYS include the 6 phases: Bridge, Deep Dive, Active Recall, CS/AI Connections, Boss Level, and Study Plan.
2. ALWAYS include the 'Ask AI' buttons with the class 'ask-btn' and an appropriate 'onclick="sendPrompt('...')" event.
3. DO NOT wrap the final output in markdown code blocks (e.g., \`\`\`html). Output ONLY raw HTML.

=== TEMPLATE TO FOLLOW ===
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font-sans); }
  .wrap { padding: 1.5rem 0; max-width: 860px; }
  .topic-header { display: flex; align-items: center; gap: 12px; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 0.5px solid var(--color-border-tertiary); }
  .topic-badge { background: #E6F1FB; color: #0C447C; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 999px; }
  .topic-title { font-size: 22px; font-weight: 500; color: var(--color-text-primary); }
  .topic-sub { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
  .phase-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 1.5rem; }
  .tab-btn { font-size: 13px; padding: 6px 14px; border-radius: 999px; border: 0.5px solid var(--color-border-secondary); background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; }
  .tab-btn:hover { background: var(--color-background-secondary); }
  .tab-btn.active { background: #0C447C; color: #E6F1FB; border-color: #0C447C; }
  .phase { display: none; }
  .phase.visible { display: block; }
  .phase-label { font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-tertiary); margin-bottom: 1rem; }
  .subtopic-card { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1rem 1.25rem; margin-bottom: 12px; }
  .subtopic-card:hover { border-color: var(--color-border-secondary); }
  .subtopic-title { font-size: 15px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 6px; }
  .subtopic-why { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 10px; line-height: 1.6; }
  .res-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .res-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 5px 10px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-tertiary); color: var(--color-text-secondary); text-decoration: none; }
  .res-chip.video { background: #FCEBEB; border-color: #F7C1C1; color: #791F1F; }
  .res-chip.practice { background: #EAF3DE; border-color: #C0DD97; color: #27500A; }
  .res-chip.visual { background: #EEEDFE; border-color: #CECBF6; color: #3C3489; }
  .res-chip.search { background: #FAEEDA; border-color: #FAC775; color: #633806; }
  .warning-box { background: #FAEEDA; border: 0.5px solid #FAC775; border-radius: var(--border-radius-md); padding: 10px 14px; margin-bottom: 10px; font-size: 13px; color: #633806; }
  .warning-title { font-weight: 500; margin-bottom: 4px; }
  .model-box { background: #EEEDFE; border: 0.5px solid #CECBF6; border-radius: var(--border-radius-md); padding: 10px 14px; margin-bottom: 10px; font-size: 13px; color: #3C3489; }
  .boss-card { background: var(--color-background-primary); border: 2px solid #185FA5; border-radius: var(--border-radius-lg); padding: 1rem 1.25rem; margin-bottom: 12px; }
  .boss-num { font-size: 12px; font-weight: 500; color: #185FA5; margin-bottom: 4px; }
  .boss-problem { font-size: 14px; color: var(--color-text-primary); line-height: 1.7; }
  .week-card { background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 1rem 1.25rem; margin-bottom: 10px; }
  .week-title { font-size: 13px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 6px; }
  .week-items { font-size: 13px; color: var(--color-text-secondary); line-height: 1.8; }
  .cs-block { background: #E1F5EE; border: 0.5px solid #9FE1CB; border-radius: var(--border-radius-lg); padding: 1rem 1.25rem; margin-bottom: 12px; }
  .cs-title { font-size: 14px; font-weight: 500; color: #085041; margin-bottom: 6px; }
  .cs-body { font-size: 13px; color: #085041; line-height: 1.7; }
  .ask-btn { display: inline-flex; align-items: center; gap: 6px; margin-top: 1rem; font-size: 13px; padding: 7px 14px; border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-secondary); background: transparent; color: var(--color-text-secondary); cursor: pointer; }
  .ask-btn:hover { background: var(--color-background-secondary); }
</style>

<div class="wrap">
  </div>
<script>
function showPhase(id, btn) {
  document.querySelectorAll('.phase').forEach(p => p.classList.remove('visible'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('phase-' + id).classList.add('visible');
  btn.classList.add('active');
}
</script>
=== END TEMPLATE ===`
    });

    const prompt = `Generate a full, highly detailed 6-phase learning roadmap for the following topic: "${topic}". The target skill level/audience is: "${level || 'Intermediate'}". Follow the HTML template structure exactly.`;

    const result = await model.generateContent(prompt);
    let generatedHtml = result.response.text();

    // Clean up potential markdown formatting from the AI response
    generatedHtml = generatedHtml.replace(/^```html\n?/i, '').replace(/```$/i, '').trim();

    return NextResponse.json({ html: generatedHtml });
    
  } catch (error: any) {
    console.error("Roadmap Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}