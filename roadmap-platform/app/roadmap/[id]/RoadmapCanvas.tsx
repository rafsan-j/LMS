"use client";

import { useEffect, useState, useRef } from "react";
import { X, Sparkles, Loader2, ArrowUp } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { supabase } from "../../../lib/supabase"; 

interface RoadmapCanvasProps {
  htmlContent: string;
  roadmapId: string;
}

type Message = { role: 'user' | 'ai'; content: string; };

export default function RoadmapCanvas({ htmlContent, roadmapId }: RoadmapCanvasProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cleanedHtml = htmlContent.replace(/\*\s*\{[^}]*\}/g, '');
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  
  useEffect(() => scrollToBottom(), [messages, isLoading]);

  // --- NEW: MATHJAX ENGINE FOR THE COURSE CANVAS ---
  useEffect(() => {
    if (!htmlContent) return;

    if (!(window as any).MathJax) {
      // Configure MathJax to recognize single $ for inline math and $$ for block math
      (window as any).MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
          processEscapes: true,
        },
        startup: {
          typeset: false // We trigger it manually so it doesn't interrupt React
        }
      };

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
      script.async = true;
      script.onload = () => {
        (window as any).MathJax.typesetPromise?.();
      };
      document.head.appendChild(script);
    } else {
      // If the script is already loaded, just tell it to re-scan the new content
      (window as any).MathJax.typesetPromise?.();
    }
  }, [htmlContent]);


  // --- SMART CONTEXT STRIPPER ---
  const plainTextContext = htmlContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Destroy JS
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   // Destroy CSS
    .replace(/<[^>]+>/g, ' ')                                          // Destroy HTML tags
    .replace(/\s+/g, ' ')                                              // Clean up weird spacing
    .trim()
    .substring(0, 15000);                                              // Give Gemini 15k chars to read!

  // URL Router Listener
  useEffect(() => {
    if (!htmlContent) return;
    const params = new URLSearchParams(window.location.search);
    const lessonId = params.get('lesson');
    if (!lessonId) return;

    let attempts = 0;
    const findAndHighlight = setInterval(() => {
      attempts++;
      const el = document.getElementById(lessonId);
      
      if (el) {
        clearInterval(findAndHighlight);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.animate([
          { backgroundColor: 'transparent', outline: '2px solid transparent', transform: 'scale(1)' },
          { backgroundColor: 'rgba(59, 130, 246, 0.15)', outline: '2px solid rgba(59, 130, 246, 0.8)', transform: 'scale(1.01)', borderRadius: '8px' },
          { backgroundColor: 'transparent', outline: '2px solid transparent', transform: 'scale(1)' }
        ], { duration: 800, iterations: 3, easing: 'ease-in-out' });
      } else if (attempts > 20) {
        clearInterval(findAndHighlight);
      }
    }, 500);

    return () => clearInterval(findAndHighlight);
  }, [htmlContent]);

  // Progress tracking
  useEffect(() => {
    const fetchProgress = async () => {
      const { data } = await supabase.from('roadmaps').select('progress_state').eq('id', roadmapId).single();
      if (data?.progress_state) setProgress(data.progress_state);
    };
    if (roadmapId) fetchProgress();
  }, [roadmapId]);

  useEffect(() => {
    Object.keys(progress).forEach(id => {
      const el = document.getElementById(id);
      const btn = el?.querySelector('.done-btn');
      if (el && progress[id]) {
        el.classList.add('completed');
        if (btn) btn.innerHTML = "✓ Completed";
      } else if (el) {
        el.classList.remove('completed');
        if (btn) btn.innerHTML = "Mark Done";
      }
    });
  }, [progress, htmlContent]);

  useEffect(() => {
    if (htmlContent) {
      const firstTab = document.querySelector('.ph');
      const anyVisible = document.querySelector('.ph.show');
      if (firstTab && !anyVisible) firstTab.classList.add('show');
    }
  }, [htmlContent]);

  // Todo Button Injection
  useEffect(() => {
    if (!htmlContent) return;
    const timeout = setTimeout(() => {
      const container = document.getElementById('roadmap-content-container');
      if (!container) return;

      const targets = container.querySelectorAll('.lec-block, h3, h4');
      
      targets.forEach((target, index) => {
        if (target.querySelector('.todo-btn') || target.parentElement?.querySelector('.todo-btn')) return;
        
        const btn = document.createElement('button');
        btn.className = 'todo-btn inline-flex items-center text-[10px] uppercase font-bold tracking-wider bg-neutral-800 border border-neutral-700 hover:border-blue-500/50 hover:bg-blue-500/10 text-neutral-400 hover:text-blue-400 px-2 py-1 rounded transition-colors ml-3 shadow-sm align-middle translate-y-[-2px]';
        btn.innerHTML = '+ Planner';
        
        const blockId = target.id || `retro-block-${index}`;
        if (!target.id) target.id = blockId;

        btn.onclick = (e) => {
          e.preventDefault(); 
          (window as any).sendToTodo(blockId, target);
        };
        
        const doneBtn = target.querySelector ? target.querySelector('.done-btn') : null;
        if (doneBtn && doneBtn.parentNode) {
          doneBtn.parentNode.insertBefore(btn, doneBtn.nextSibling);
        } else if (target.tagName.match(/^H[34]$/i)) {
          target.appendChild(btn);
        } else {
          const hdr = target.querySelector('h3, h4, h5');
          if (hdr) hdr.appendChild(btn); 
        }
      });
    }, 200);

    return () => clearTimeout(timeout);
  }, [htmlContent]);

  // Window functions for injected buttons
  useEffect(() => {
    (window as any).go = function (id: string, btn: HTMLElement) {
      document.querySelectorAll('.ph').forEach(p => p.classList.remove('show'));
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      const target = document.getElementById('ph-' + id);
      if(target) target.classList.add('show');
      if(btn) btn.classList.add('on');
    };

    (window as any).tog = function (id: string) {
      const b = document.getElementById(id);
      if(b) b.classList.toggle('open');
    };

    (window as any).sendPrompt = async function (prompt: string) {
      setIsSidebarOpen(true);
      handleSendMessage(prompt);
    };

    (window as any).toggleProgress = async function (btnElement: HTMLElement) {
      const block = btnElement.closest('.lec-block');
      if (!block) return;
      const blockId = block.id;
      if (!blockId) return;

      setProgress(prev => {
        const newState = { ...prev, [blockId]: !prev[blockId] };
        supabase.from('roadmaps').update({ progress_state: newState }).eq('id', roadmapId).then();
        return newState;
      });
    };

    (window as any).sendToTodo = async function (blockId: string, blockElement: HTMLElement) {
      const { data: { session } } = await supabase.auth.getSession();
      let uid = session?.user?.id;

      if (!uid) {
        const { data: fallback } = await supabase.from('focus_user_profiles').select('user_id').limit(1).single();
        if (fallback) uid = fallback.user_id;
        else return alert("No valid user found to save this task to.");
      }

      let titleText = `Task: ${blockId}`;
      const headerEl = blockElement.tagName.match(/^H[345]$/i) ? blockElement : blockElement.querySelector('h3, h4, h5, strong');
      
      if (headerEl) {
        let text = "";
        headerEl.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
        });
        if (text.trim()) titleText = text.trim();
      }

      const btn = blockElement.querySelector('.todo-btn') || (blockElement.tagName.match(/^H[345]$/i) ? blockElement.querySelector('.todo-btn') : null);
      if (btn) {
        btn.innerHTML = '✓ Synced';
        btn.className = 'todo-btn inline-flex items-center text-[10px] uppercase font-bold tracking-wider bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded transition-colors ml-3 align-middle translate-y-[-2px] cursor-default';
        (btn as HTMLButtonElement).disabled = true;
      }

      await supabase.from('focus_todos').insert({
        user_id: uid,
        title: titleText,
        linked_roadmap_id: roadmapId,
        linked_lesson_id: blockId, 
        target_date: new Date().toISOString().split('T')[0] 
      });
    };
  }, [roadmapId]);

  // AI Chat Handler
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || chatInput;
    if (!textToSend.trim()) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setChatInput("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages, 
          contextSnippet: plainTextContext 
        })
      });

      if (!response.ok || !response.body) throw new Error();

      setIsLoading(false);
      setMessages(prev => [...prev, { role: 'ai', content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            updated[lastIdx] = { ...updated[lastIdx], content: updated[lastIdx].content + chunk };
            return updated;
          });
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: "An error occurred." }]);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full relative min-h-screen flex overflow-hidden bg-[#0a0a0a]">
      <div className={`flex-1 h-screen overflow-y-auto transition-all duration-500 ease-in-out ${isSidebarOpen ? 'xl:mr-[480px]' : ''}`}>
        <div className="max-w-[900px] mx-auto p-4 md:p-8 pb-32">
          <div 
            id="roadmap-content-container"
            className="bg-neutral-950 text-neutral-200 p-6 md:p-10 rounded-2xl shadow-lg border border-neutral-800 relative z-0"
            style={{
              "--font-sans": "inherit" as any, 
              "--color-text-primary": "#f5f5f5" as any,    
              "--color-text-secondary": "#a3a3a3" as any,  
              "--color-text-tertiary": "#737373" as any,    
              "--color-border-secondary": "#262626" as any, 
              "--color-border-tertiary": "#171717" as any,
              "--color-background-primary": "#0a0a0a" as any, 
              "--color-background-secondary": "#171717" as any, 
              "--border-radius-lg": "12px" as any, 
              "--border-radius-md": "8px" as any,
            }}
            dangerouslySetInnerHTML={{ __html: cleanedHtml }} 
          />
        </div>
      </div>

      <button onClick={() => setIsSidebarOpen(true)} className={`fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xl transition-all z-40 border border-blue-500/50 ${isSidebarOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 hover:scale-105 hover:bg-blue-500'}`}>
        <Sparkles size={20} />
      </button>

      <div className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-neutral-900 shadow-2xl border-l border-neutral-800 transform transition-transform duration-500 ease-in-out z-[100] flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900 z-[110] relative shrink-0">
          <span className="font-semibold text-sm tracking-tight text-white flex items-center gap-2"><Sparkles size={16} className="text-blue-400" /> AI Tutor</span>
          <button onClick={() => setIsSidebarOpen(false)} className="text-neutral-400 hover:text-white hover:bg-neutral-800 p-2 rounded-lg cursor-pointer flex items-center justify-center bg-neutral-900 border border-neutral-800 transition-colors"><X size={18} strokeWidth={2.5} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6 scrollbar-hide relative z-[100]">
          {messages.length === 0 && !isLoading && (
            <div className="mt-8 text-neutral-500 font-light leading-relaxed text-center">
               <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4"><Sparkles size={20} /></div>
               <p>I am ready to help you dissect this roadmap.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className="flex flex-col w-full">
              {msg.role === 'user' ? (
                <div className="self-end bg-neutral-800 text-neutral-100 px-5 py-3.5 rounded-2xl rounded-tr-sm text-[15px] max-w-[85%] leading-relaxed border border-neutral-700">{msg.content}</div>
              ) : (
                <div className="flex gap-4 w-full">
                  <div className="flex-shrink-0 mt-1"><div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-sm"><Sparkles size={14} /></div></div>
                  <div className="flex-1 min-w-0 overflow-x-auto break-words text-neutral-300 prose prose-invert max-w-none prose-p:leading-relaxed prose-code:bg-neutral-800 prose-code:text-blue-300 prose-pre:bg-neutral-950 prose-pre:text-neutral-300 prose-pre:border prose-pre:border-neutral-800 prose-math:font-medium">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
             <div className="flex gap-4 w-full text-neutral-500">
               <div className="flex-shrink-0 mt-1"><div className="w-8 h-8 bg-neutral-800 text-neutral-400 rounded-full flex items-center justify-center"><Sparkles size={14} /></div></div>
               <div className="flex items-center gap-2 h-8"><Loader2 size={16} className="animate-spin" /><span>Thinking...</span></div>
             </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        <div className="flex-shrink-0 p-5 bg-neutral-900 border-t border-neutral-800 relative z-[110]">
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative flex items-center bg-neutral-950 border border-neutral-800 focus-within:border-blue-500/50 rounded-xl p-1.5 transition-colors">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={isLoading} placeholder="Ask a question..." className="w-full bg-transparent text-[15px] px-3 py-2.5 focus:outline-none text-white placeholder-neutral-600 disabled:opacity-50" />
            <button type="submit" disabled={isLoading || !chatInput.trim()} className="w-10 h-10 shrink-0 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 transition-colors flex items-center justify-center">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
            </button>
          </form>
        </div>
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 xl:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
}