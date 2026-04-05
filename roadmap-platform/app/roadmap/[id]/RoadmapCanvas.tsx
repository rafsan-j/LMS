"use client";

import { useEffect, useState, useRef } from "react";
import { X, Sparkles, Loader2, ArrowUp } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
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

  // --- CRITICAL FIX: Clean the poisonous CSS leak ---
  // This removes the universal selector that destroys the global sidebar navigation
  const cleanedHtml = htmlContent.replace(/\*\s*\{[^}]*\}/g, '');

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => scrollToBottom(), [messages, isLoading]);

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
  }, [roadmapId]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || chatInput;
    if (!textToSend.trim()) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setChatInput("");
    setIsLoading(true);

    try {
      const strippedText = htmlContent.replace(/<[^>]*>?/gm, '').substring(0, 300);
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, contextSnippet: strippedText })
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: "An error occurred." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full relative min-h-screen flex overflow-hidden bg-[#FDFDFD]">
      
      {/* THE LAYOUT FIX: Main Content Pane */}
      {/* Uses flex-1 and a dynamic right-margin. When the sidebar opens, this box physically shrinks, preventing overlap. */}
      <div className={`flex-1 h-screen overflow-y-auto transition-all duration-500 ease-in-out ${isSidebarOpen ? 'xl:mr-[480px]' : ''}`}>
        <div className="max-w-[900px] mx-auto p-4 md:p-8 pb-32">
          
          {/* THE STYLE FIX: Hardcoded colors ensure Dark Reader or global dark mode don't make the text invisible */}
          <div 
            className="bg-white text-neutral-900 p-6 md:p-10 rounded-2xl shadow-sm border border-neutral-200"
            style={{
              "--font-sans": "inherit" as any, 
              "--color-text-primary": "#171717" as any,
              "--color-text-secondary": "#525252" as any, 
              "--color-text-tertiary": "#737373" as any,
              "--color-border-secondary": "#e5e5e5" as any, 
              "--color-border-tertiary": "#f5f5f5" as any,
              "--color-background-primary": "#ffffff" as any, 
              "--color-background-secondary": "#fafafa" as any,
              "--border-radius-lg": "12px" as any, 
              "--border-radius-md": "8px" as any,
            }}
            dangerouslySetInnerHTML={{ __html: cleanedHtml }} 
          />
        </div>
      </div>

      {/* Floating Sparkle Button */}
      <button onClick={() => setIsSidebarOpen(true)} className={`fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xl transition-all z-40 ${isSidebarOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 hover:scale-105'}`}>
        <Sparkles size={20} />
      </button>

      {/* AI Tutor Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl border-l border-neutral-200 transform transition-transform duration-500 ease-in-out z-[100] flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* THE CLOSE BUTTON FIX: High z-index, solid background, fully blocking */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-white z-[110] relative shrink-0">
          <span className="font-semibold text-sm tracking-tight text-black flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" /> AI Tutor
          </span>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="text-neutral-500 hover:text-black hover:bg-neutral-100 p-2 rounded-lg cursor-pointer flex items-center justify-center bg-white border border-neutral-200 shadow-sm transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6 scrollbar-hide relative z-[100]">
          {messages.length === 0 && !isLoading && (
            <div className="mt-8 text-neutral-500 font-light leading-relaxed text-center">
               <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Sparkles size={20} /></div>
               <p>I am ready to help you dissect this roadmap.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className="flex flex-col w-full">
              {msg.role === 'user' ? (
                <div className="self-end bg-neutral-100 text-black px-5 py-3.5 rounded-2xl rounded-tr-sm text-[15px] max-w-[85%] leading-relaxed">{msg.content}</div>
              ) : (
                <div className="flex gap-4 w-full">
                  <div className="flex-shrink-0 mt-1"><div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center shadow-sm"><Sparkles size={14} /></div></div>
                  <div className="flex-1 text-neutral-800 prose prose-neutral max-w-none prose-p:leading-relaxed prose-code:bg-blue-50 prose-pre:bg-neutral-900 prose-pre:text-white prose-math:font-medium">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
             <div className="flex gap-4 w-full text-neutral-400">
               <div className="flex-shrink-0 mt-1"><div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center"><Sparkles size={14} /></div></div>
               <div className="flex items-center gap-2 h-8"><Loader2 size={16} className="animate-spin" /><span>Thinking...</span></div>
             </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        <div className="flex-shrink-0 p-5 bg-white border-t border-neutral-100 relative z-[110]">
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative flex items-center bg-neutral-50 border border-neutral-200 focus-within:border-neutral-300 focus-within:bg-white rounded-xl p-1.5 transition-colors">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={isLoading} placeholder="Ask a question..." className="w-full bg-transparent text-[15px] px-3 py-2.5 focus:outline-none disabled:opacity-50" />
            <button type="submit" disabled={isLoading || !chatInput.trim()} className="w-10 h-10 shrink-0 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-neutral-200 transition-colors flex items-center justify-center">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
            </button>
          </form>
        </div>
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/10 z-40 xl:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
}