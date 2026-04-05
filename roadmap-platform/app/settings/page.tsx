"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { Target, Brain, Clock, Save, Sparkles, Loader2, Zap } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "error" | "success", msg: string } | null>(null);

  // Generalized Context State
  const [goals, setGoals] = useState("");
  const [learningStyle, setLearningStyle] = useState("mixed");
  const [capacityHours, setCapacityHours] = useState(10);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUserId(session.user.id);

      const { data } = await supabase
        .from("focus_user_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        setHasProfile(true);
        setGoals(data.primary_goals || "");
        setLearningStyle(data.learning_style || "mixed");
        setCapacityHours(data.weekly_capacity_hours || 10);
      }
      setIsLoading(false);
    };
    fetchProfile();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSaving(true);
    setStatus(null);

    try {
      const payload = {
        user_id: userId,
        primary_goals: goals,
        learning_style: learningStyle,
        weekly_capacity_hours: capacityHours,
        updated_at: new Date().toISOString(),
      };

      if (hasProfile) {
        const { error } = await supabase.from("focus_user_profiles").update(payload).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("focus_user_profiles").insert([payload]);
        if (error) throw error;
        setHasProfile(true);
      }
      
      setStatus({ type: "success", msg: "Learning profile synchronized successfully." });
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-neutral-400"><Loader2 className="animate-spin mr-2" /> Loading OS Context...</div>;

  return (
    <div className="p-6 md:p-10 mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen flex flex-col bg-[#0a0a0a]">
      <div className="mb-8 max-w-4xl w-full mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">
          {hasProfile ? "Learning Profile" : "Welcome to Focus OS"}
        </h1>
        <p className="text-neutral-400 text-lg">
          {hasProfile 
            ? "Calibrate your learning engine. The AI uses this context to prioritize your curriculum." 
            : "Let's map out your learning psychology so the AI can build a tailored curriculum for you."}
        </p>
      </div>

      <div className="max-w-4xl w-full mx-auto bg-neutral-900 border border-neutral-800 rounded-2xl shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <form onSubmit={handleSave} className="p-8 relative z-10 space-y-10">
          
          {/* Section 1: The "Why" */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-lg font-bold text-white border-b border-neutral-800 pb-2">
              <Target className="text-blue-500" /> What is your primary objective?
            </label>
            <p className="text-sm text-neutral-400">Be specific. Are you trying to pivot careers, master a hobby, or pass a specific certification?</p>
            <textarea 
              rows={3} 
              value={goals} 
              onChange={e => setGoals(e.target.value)} 
              placeholder="e.g., I want to transition from marketing to frontend development within the next 8 months by mastering React." 
              className="w-full p-4 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-none leading-relaxed text-white placeholder-neutral-600"
              required
            />
          </div>

          {/* Section 2: The "How" */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-lg font-bold text-white border-b border-neutral-800 pb-2">
              <Brain className="text-blue-500" /> How do you learn best?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: "visual", label: "Visual & Conceptual", desc: "I need to see the big picture and visual intuition before doing the math/code." },
                { id: "practice", label: "Practice-First", desc: "I learn by breaking things. Give me exercises immediately." },
                { id: "theory", label: "Theoretical First", desc: "I need to understand the underlying documentation and rules deeply first." },
                { id: "mixed", label: "Mixed Approach", desc: "A balanced diet of lectures, visuals, and exercises." },
              ].map(style => (
                <div 
                  key={style.id}
                  onClick={() => setLearningStyle(style.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${learningStyle === style.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-900'}`}
                >
                  <h3 className={`font-semibold mb-1 ${learningStyle === style.id ? 'text-blue-400' : 'text-neutral-200'}`}>{style.label}</h3>
                  <p className={`text-xs ${learningStyle === style.id ? 'text-blue-300' : 'text-neutral-500'}`}>{style.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: The "Capacity" */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-lg font-bold text-white border-b border-neutral-800 pb-2">
              <Clock className="text-blue-500" /> Weekly Deep Work Capacity
            </label>
            <p className="text-sm text-neutral-400">Be honest. How many hours per week can you dedicate exclusively to focused learning?</p>
            
            <div className="pt-4 px-2">
              <div className="flex justify-between items-end mb-4">
                <span className="text-blue-400 font-mono text-xl font-bold bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">{capacityHours} hrs / week</span>
                <span className="text-sm font-medium text-neutral-500">{capacityHours < 5 ? 'Casual' : capacityHours < 15 ? 'Dedicated' : 'Intensive'}</span>
              </div>
              <input 
                type="range" min={1} max={40} step={1}
                value={capacityHours} 
                onChange={e => setCapacityHours(Number(e.target.value))} 
                className="w-full accent-blue-500 cursor-pointer h-2 bg-neutral-800 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-xs text-neutral-500 font-medium mt-2">
                <span>1 hr</span>
                <span>40 hrs</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
            <div className="flex-1">
              {status && (
                <div className={`text-sm font-medium flex items-center gap-2 ${status.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                  {status.type === 'success' && <Zap size={16} />}
                  {status.msg}
                </div>
              )}
            </div>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 flex items-center gap-2 shadow-lg"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isSaving ? "Syncing..." : "Update OS Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}