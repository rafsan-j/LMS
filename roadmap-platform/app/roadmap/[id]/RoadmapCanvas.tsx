"use client";

import { useEffect, useState, useRef } from "react";
import { X, Sparkles, Loader2, ArrowUp, User } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface RoadmapCanvasProps {
  htmlContent: string;
}

type Message = {
  role: 'user' | 'ai';
  content: string;
};

export default function RoadmapCanvas({ htmlContent }: RoadmapCanvasProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    (window as any).showPhase = function (id: string, btn: HTMLElement) {
      document.querySelectorAll('.phase').forEach(p => p.classList.remove('visible'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('phase-' + id)?.classList.add('visible');
      btn.classList.add('active');
    };

    (window as any).sendPrompt = async function (prompt: string) {
      setIsSidebarOpen(true);
      handleSendMessage(prompt);
    };
  }, []);

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
        body: JSON.stringify({ 
          messages: newMessages,
          contextSnippet: strippedText
        })
      });

      if (!response.ok) throw new Error("Failed to fetch response.");

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "An error occurred." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center relative min-h-screen">
      
      {/* --- Main Content Area --- */}
      <div 
        className={`w-full transition-all duration-500 ease-in-out ${isSidebarOpen ? 'mr-[480px] max-w-[800px]' : 'max-w-[860px]'}`}
        style={{
          "--font-sans": "inherit" as any,
          "--color-text-primary": "#111111" as any,
          "--color-text-secondary": "#666666" as any,
          "--color-text-tertiary": "#999999" as any,
          "--color-border-secondary": "#eaeaea" as any,
          "--color-border-tertiary": "#f0f0f0" as any,
          "--color-background-primary": "#ffffff" as any,
          "--color-background-secondary": "#fafafa" as any,
          "--border-radius-lg": "8px" as any,
          "--border-radius-md": "6px" as any,
        }}
      >
        <div 
          className="w-full bg-white px-8 py-12 my-8"
          dangerouslySetInnerHTML={{ __html: htmlContent }} 
        />
      </div>

      {/* --- Global Floating Action Button (FAB) --- */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className={`fixed bottom-8 right-8 w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 transition-all z-40 ${isSidebarOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100'}`}
      >
        <Sparkles size={20} />
      </button>

      {/* --- Upgraded Sidebar --- */}
      <div 
        className={`fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl border-l border-neutral-100 transform transition-transform duration-500 ease-in-out z-50 flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="px-8 py-5 flex items-center justify-between border-b border-neutral-100/60 bg-white z-10 flex-shrink-0">
          <span className="font-semibold text-sm tracking-tight text-black flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" /> AI Tutor
          </span>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="text-neutral-400 hover:text-black transition-colors bg-neutral-50 hover:bg-neutral-100 p-1.5 rounded-md"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Chat Feed (Now properly flexing) */}
        <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-8 scrollbar-hide">
          
          {messages.length === 0 && !isLoading && (
            <div className="mt-8 text-neutral-500 font-light leading-relaxed text-center px-4">
               <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Sparkles size={20} />
               </div>
               <p>I have analyzed this curriculum. Click an AI prompt in the roadmap or ask a question below to begin.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className="flex flex-col w-full">
              {msg.role === 'user' ? (
                // User Prompt - Distinctly separated and aligned right
                <div className="self-end flex flex-col items-end max-w-[85%]">
                  <div className="bg-neutral-100 text-black px-5 py-3.5 rounded-2xl rounded-tr-sm text-[15px] leading-relaxed shadow-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                // AI Response - Elegant left alignment with an icon
                <div className="flex gap-4 w-full">
                  <div className="flex-shrink-0 mt-1">
                     <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center shadow-sm">
                        <Sparkles size={14} />
                     </div>
                  </div>
                  <div className="flex-1 text-neutral-800 prose prose-neutral max-w-none 
                prose-p:leading-relaxed prose-p:text-[15px] prose-p:mb-4
                prose-headings:text-black prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3
                prose-li:my-1
                prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-neutral-900 prose-pre:text-white prose-pre:rounded-xl prose-pre:shadow-sm
                prose-math:text-black prose-math:font-medium
                [&_.katex-display]:my-4 [&_.katex-display]:py-2">
  <ReactMarkdown 
    remarkPlugins={[remarkGfm, remarkMath]} 
    rehypePlugins={[rehypeKatex]}
  >
    {msg.content}
  </ReactMarkdown>
</div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
             <div className="flex gap-4 w-full">
               <div className="flex-shrink-0 mt-1">
                 <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center shadow-sm">
                    <Sparkles size={14} />
                 </div>
               </div>
               <div className="flex items-center text-neutral-400 gap-2 h-8">
                 <Loader2 size={16} className="animate-spin" />
                 <span className="text-[15px]">Thinking...</span>
               </div>
             </div>
          )}
          
          <div ref={messagesEndRef} className="h-2" />
        </div>

        {/* Input Field (Now structurally anchored to the bottom) */}
        <div className="flex-shrink-0 p-6 bg-white border-t border-neutral-100">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="relative flex items-center bg-neutral-50 border border-neutral-200 focus-within:border-neutral-300 focus-within:bg-white rounded-xl p-1.5 transition-colors shadow-sm"
          >
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ask a follow-up question..."
              className="w-full bg-transparent text-black text-[15px] px-3 py-2.5 focus:outline-none disabled:opacity-50 placeholder:text-neutral-400"
            />
            <button 
              type="submit"
              disabled={isLoading || !chatInput.trim()}
              className="w-10 h-10 shrink-0 bg-black text-white rounded-lg hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors flex items-center justify-center mr-0.5"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
            </button>
          </form>
          <div className="text-center mt-3">
             <span className="text-[11px] text-neutral-400 font-medium tracking-wide uppercase">AI can make mistakes. Verify complex math.</span>
          </div>
        </div>

      </div>

      {/* Dimmed Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/5 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}