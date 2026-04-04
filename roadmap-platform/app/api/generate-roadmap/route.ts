import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, level, playlistUrl } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are an expert university curriculum architect. Your job is to generate a comprehensive, actionable, day-by-day HTML learning roadmap.

You MUST use EXACTLY the following HTML structure, classes, and CSS. You will build a syllabus anchored by a "Primary Spine" (a main video lecture series) and supplemented by "Visual Intuition" (e.g., 3Blue1Brown) and "Practice" (e.g., Khan Academy/MIT OCW).

CRITICAL RULES:
1. ALWAYS include these exact 4 phase tabs: Lecture Spine (ph-spine), CS/AI/Real-World (ph-cs), Boss Level (ph-boss), and Daily Plan (ph-plan).
2. For the 'Lecture Spine', break the topic down into 5 to 10 logical 'lec-block' sections. Invent realistic video durations and parts.
3. For the 'Daily Plan', create a realistic week-by-week <table> schedule that references the lectures.
4. **MATH FORMATTING:** Use double $$ for block math equations and single $ for inline math.
5. DO NOT wrap the final output in markdown code blocks (\`\`\`html). Output ONLY raw HTML.

=== EXACT TEMPLATE TO FOLLOW ===
<style>
*{box-sizing:border-box;margin:0;padding:0}
.w{padding:1.5rem 0;max-width:900px}
.hdr{margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:0.5px solid var(--color-border-tertiary)}
.hdr-title{font-size:22px;font-weight:500;color:var(--color-text-primary);margin-bottom:4px}
.hdr-sub{font-size:13px;color:var(--color-text-secondary)}
.legend{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1.5rem;padding:10px 14px;background:var(--color-background-secondary);border-radius:var(--border-radius-md)}
.leg-t{font-size:12px;font-weight:500;color:var(--color-text-secondary);margin-right:4px;align-self:center}
.badge{font-size:11px;padding:3px 10px;border-radius:999px;font-weight:500}
.b-pl{background:#FCEBEB;color:#791F1F} .b-3b{background:#EEEDFE;color:#3C3489} .b-kh{background:#EAF3DE;color:#27500A} .b-mit{background:#E6F1FB;color:#0C447C} .b-cs{background:#E1F5EE;color:#085041}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1.5rem}
.tab{font-size:13px;padding:6px 14px;border-radius:999px;border:0.5px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer}
.tab.on{background:#0C447C;color:#E6F1FB;border-color:#0C447C}
.ph{display:none}.ph.show{display:block}
.ph-lbl{font-size:11px;font-weight:500;letter-spacing:0.07em;text-transform:uppercase;color:var(--color-text-tertiary);margin-bottom:1rem}
.intro-box{background:var(--color-background-secondary);border-radius:var(--border-radius-lg);padding:1rem 1.25rem;margin-bottom:1.5rem;font-size:13px;color:var(--color-text-secondary);line-height:1.75}
.lec-block{border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);margin-bottom:12px;overflow:hidden}
.lec-head{display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;background:var(--color-background-primary)}
.lec-num{font-size:11px;font-weight:500;padding:3px 9px;border-radius:999px;background:#FCEBEB;color:#791F1F;white-space:nowrap}
.lec-title{font-size:14px;font-weight:500;color:var(--color-text-primary);flex:1}
.lec-parts{font-size:11px;color:var(--color-text-tertiary);white-space:nowrap}
.lec-body{display:none;padding:12px 14px 14px;border-top:0.5px solid var(--color-border-tertiary);background:var(--color-background-primary)}
.lec-block.open .lec-body{display:block}
.section-lbl{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-text-tertiary);margin:10px 0 5px}
.res-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:4px 10px;border-radius:var(--border-radius-md);text-decoration:none;cursor:pointer;line-height:1.4}
.c-pl{background:#FCEBEB;border:0.5px solid #F7C1C1;color:#791F1F} .c-3b{background:#EEEDFE;border:0.5px solid #CECBF6;color:#3C3489} .c-kh{background:#EAF3DE;border:0.5px solid #C0DD97;color:#27500A}
.meta{font-size:11px;color:var(--color-text-tertiary);margin-bottom:6px}
.warn{background:#FAEEDA;border:0.5px solid #FAC775;border-radius:var(--border-radius-md);padding:7px 10px;font-size:12px;color:#633806;margin:8px 0}
.model-b{background:#EEEDFE;border:0.5px solid #CECBF6;border-radius:var(--border-radius-md);padding:7px 10px;font-size:12px;color:#3C3489;margin:8px 0}
.day-plan{background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:7px 10px;font-size:12px;color:var(--color-text-secondary);margin-top:8px;line-height:1.7}
.cs-card{border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:1rem 1.25rem;margin-bottom:12px}
.cs-t{font-size:14px;font-weight:500;color:var(--color-text-primary);margin-bottom:5px}
.cs-b{font-size:13px;color:var(--color-text-secondary);margin-bottom:10px;line-height:1.65}
.boss{border:2px solid #185FA5;border-radius:var(--border-radius-lg);padding:1rem 1.25rem;margin-bottom:12px}
.boss-n{font-size:12px;font-weight:500;color:#185FA5;margin-bottom:4px}
.boss-p{font-size:13px;color:var(--color-text-primary);line-height:1.75}
.day-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px}
.day-table th{text-align:left;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-text-tertiary);padding:6px 10px;border-bottom:0.5px solid var(--color-border-tertiary)}
.day-table td{padding:8px 10px;border-bottom:0.5px solid var(--color-border-tertiary);vertical-align:top;color:var(--color-text-secondary)}
.day-table td:first-child{font-weight:500;color:var(--color-text-primary);white-space:nowrap;width:90px}
.day-table td .lec-tag{font-size:11px;background:#FCEBEB;color:#791F1F;padding:2px 7px;border-radius:999px;margin-right:4px}
.week-hdr{font-size:13px;font-weight:500;color:var(--color-text-primary);margin:1.25rem 0 8px;padding-bottom:6px;border-bottom:0.5px solid var(--color-border-tertiary)}
.ask-btn{display:inline-flex;align-items:center;gap:6px;margin-top:1rem;font-size:13px;padding:7px 14px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer}
</style>

<div class="w">
<div class="hdr">
  <div class="hdr-title">[TOPIC] — Complete Micro Roadmap</div>
  <div class="hdr-sub">[AUTHOR/SERIES] as the unbroken spine · every lecture · lecture-by-lecture daily plan</div>
</div>

<div class="legend">
  <span class="leg-t">Key:</span>
  <span class="badge b-pl">SPINE = Core Lecture</span>
  <span class="badge b-3b">VIS = Visual Intuition</span>
  <span class="badge b-kh">PRAC = Practice Exercises</span>
</div>

<div class="tabs">
  <button class="tab on" onclick="go('spine',this)">Lecture Spine</button>
  <button class="tab" onclick="go('cs',this)">Phase 4 · Deep Appl.</button>
  <button class="tab" onclick="go('boss',this)">Phase 5 · Boss Level</button>
  <button class="tab" onclick="go('plan',this)">Phase 6 · Daily Plan</button>
</div>

<div id="ph-spine" class="ph show">
  <div class="ph-lbl">Full lecture spine</div>
  </div>

<div id="ph-cs" class="ph">
  <div class="ph-lbl">Phase 4 · Deep Applications</div>
  </div>

<div id="ph-boss" class="ph">
  <div class="ph-lbl">Phase 5 · Boss Level — 5 hard problems</div>
  </div>

<div id="ph-plan" class="ph">
  <div class="ph-lbl">Phase 6 · Micro Daily Plan</div>
  </div>
</div>

<script>
function go(id,btn){
  document.querySelectorAll('.ph').forEach(p=>p.classList.remove('show'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  document.getElementById('ph-'+id).classList.add('show');
  btn.classList.add('on');
}
function tog(id){
  const b=document.getElementById(id);
  b.classList.toggle('open');
}
</script>
=== END TEMPLATE ===`
    });

    let prompt = `Generate a full, highly detailed V3 learning roadmap for the topic: "${topic}". Target skill level: "${level || 'Intermediate'}". `;
    
    if (playlistUrl) {
      prompt += `The user has requested to use this specific playlist URL as the primary spine: "${playlistUrl}". Please adapt your knowledge of this course or similar courses to fit the requested V3 syllabus format exactly.`;
    } else {
      prompt += `Please assume a highly-regarded, standard top-tier university playlist (like MIT, Harvard, or Prof Leonard) as the primary spine and build the curriculum around it.`;
    }

    const result = await model.generateContent(prompt);
    let generatedHtml = result.response.text();
    generatedHtml = generatedHtml.replace(/^```html\n?/i, '').replace(/```$/i, '').trim();

    return NextResponse.json({ html: generatedHtml });
    
  } catch (error: any) {
    console.error("Roadmap Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}