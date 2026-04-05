import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- NEW: Helper to extract Playlist ID from URL ---
function extractPlaylistId(url: string) {
  const reg = /[&?]list=([^&]+)/i;
  const match = url.match(reg);
  return match ? match[1] : null;
}

// --- NEW: Helper to fetch actual videos from YouTube ---
async function getPlaylistItems(playlistId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    // Fetch up to 50 videos from the playlist
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}`);
    const data = await res.json();
    
    if (!data.items) return null;

    // Format them cleanly for the AI
    return data.items.map((item: any) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}&list=${playlistId}`
    }));
  } catch (e) {
    console.error("YouTube API Error:", e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { topic, level, playlistUrl } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }

    // --- NEW: Fetch Real Videos if URL is provided ---
    let realVideoContext = "";
    if (playlistUrl) {
      const pid = extractPlaylistId(playlistUrl);
      if (pid) {
        const videos = await getPlaylistItems(pid);
        if (videos && videos.length > 0) {
          realVideoContext = `\n\nCRITICAL PLAYLIST DATA: The user wants to use a specific playlist. Here is the EXACT JSON list of real videos and their valid URLs. You MUST use these exact titles and URLs to construct the 'lec-block' sections in the 'Lecture Spine' tab.\n${JSON.stringify(videos, null, 2)}`;
        }
      }
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are an expert university curriculum architect. Your job is to generate a comprehensive, actionable, day-by-day HTML learning roadmap.

CRITICAL RULES:
1. ALWAYS include these exact 4 phase tabs: Lecture Spine (ph-spine), CS/AI/Real-World (ph-cs), Boss Level (ph-boss), and Daily Plan (ph-plan).
2. For the 'Lecture Spine', break the topic down into 5 to 10 logical 'lec-block' sections. 
3. **URL HANDLING (ABSOLUTE PRIORITY):** - If given a JSON list of real videos in the prompt, you MUST use those exact URLs.
   - For ANY other YouTube video (including the spine if no JSON was provided, or supplementary Khan Academy/3Blue1Brown videos), DO NOT attempt to guess the YouTube watch ID. You MUST generate a YouTube search URL like this: href="https://www.youtube.com/results?search_query=Khan+Academy+Chain+Rule". Guessing IDs results in broken links.
   - For non-YouTube text resources (like documentation or articles), you may generate standard semantic URLs (e.g., https://www.learn-c.org/en/Functions).
4. **MATH FORMATTING:** Use double $$ for block math equations and single $ for inline math.
5. DO NOT wrap the final output in markdown code blocks (\`\`\`html). Output ONLY raw HTML.
6. **INTERACTIVITY (CRITICAL):** Every single <div class="lec-block"> MUST have a unique ID. You MUST wire up the onclick="tog('YOUR_ID')" on the header, and include the dropdown arrow. 

=== EXACT BLOCK TEMPLATE TO USE ===
<div class="lec-block" id="lec-1">
  <div class="lec-head" onclick="tog('lec-1')">
    <span class="lec-num">LEC 1</span>
    <span class="lec-title">Your Title Here</span>
    <span class="lec-parts">3 parts</span>
    <span class="lec-arrow">▾</span>
  </div>
  <div class="lec-body">
    <button class="done-btn" onclick="toggleProgress(this)">Mark Done</button>
  </div>
</div>
=== END BLOCK TEMPLATE ===

=== EXACT TEMPLATE TO FOLLOW ===
<style>
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
.lec-block{border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);margin-bottom:12px;overflow:hidden;transition:all 0.2s;}
.lec-head{display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;background:var(--color-background-primary)}
.lec-num{font-size:11px;font-weight:500;padding:3px 9px;border-radius:999px;background:#FCEBEB;color:#791F1F;white-space:nowrap}
.lec-title{font-size:14px;font-weight:500;color:var(--color-text-primary);flex:1}
.lec-parts{font-size:11px;color:var(--color-text-tertiary);white-space:nowrap}
.lec-arrow{font-size:12px;color:var(--color-text-tertiary);transition:transform 0.15s}
.lec-body{display:none;padding:12px 14px 14px;border-top:0.5px solid var(--color-border-tertiary);background:var(--color-background-primary)}
.lec-block.open .lec-body{display:block}
.lec-block.open .lec-arrow{transform:rotate(180deg)}
.section-lbl{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-text-tertiary);margin:10px 0 5px}
.res-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:4px 10px;border-radius:var(--border-radius-md);text-decoration:none;cursor:pointer;line-height:1.4}
.c-pl{background:#FCEBEB;border:0.5px solid #F7C1C1;color:#791F1F} .c-3b{background:#EEEDFE;border:0.5px solid #CECBF6;color:#3C3489} .c-kh{background:#EAF3DE;border:0.5px solid #C0DD97;color:#27500A} .c-cs{background:#E1F5EE;border:0.5px solid #9FE1CB;color:#085041}
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
.done-btn{margin-top:10px;font-size:12px;padding:6px 12px;border-radius:6px;border:1px solid #C0DD97;background:#EAF3DE;color:#27500A;cursor:pointer;transition:all 0.2s;}
.done-btn:hover{background:#C0DD97;}
.lec-block.completed{opacity:0.6; border-color:#C0DD97;}
.lec-block.completed .lec-head{background:#f4f9ef;}
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
=== END TEMPLATE ===`
    });

    // Combine topic and the real video context
    const prompt = `Generate a highly detailed V3 learning roadmap for the topic: "${topic}". Target skill level: "${level || 'Intermediate'}". ${realVideoContext}`;

    const result = await model.generateContent(prompt);
    let generatedHtml = result.response.text();
    generatedHtml = generatedHtml.replace(/^```html\n?/i, '').replace(/```$/i, '').trim();

    return NextResponse.json({ html: generatedHtml });
    
  } catch (error: any) {
    console.error("Roadmap Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}