"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { Play, CheckCircle, ListTodo, LayoutDashboard, Sparkles, AlertCircle } from "lucide-react";

type Category = { id: string; name: string; active_limit: number };
type Roadmap = { id: string; title: string; category_id: string; is_ai_generated: boolean; priority_score: number; simple_url: string | null; };

export default function Home() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeRoadmaps, setActiveRoadmaps] = useState<Roadmap[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchActiveData(); }, []);

  const fetchActiveData = async () => {
    setIsLoading(true);
    const { data: cats } = await supabase.from("focus_categories").select("*").order("name");
    const { data: rm } = await supabase.from("roadmaps")
      .select("*")
      .eq('status', 'active')
      .eq('is_published', true) 
      .order("priority_score", { ascending: false });
    
    if (cats) setCategories(cats);
    if (rm) setActiveRoadmaps(rm);
    setIsLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from("roadmaps").update({ status: newStatus }).eq('id', id);
    fetchActiveData();
  };

  // Find orphans: Active roadmaps that don't belong to any valid category ID
  const uncategorizedActive = activeRoadmaps.filter(r => !categories.find(c => c.id === r.category_id));

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-neutral-500">Loading Active Slots...</div>;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Deep Work Zone</h1>
        <p className="text-neutral-500">Your currently active subjects. Focus here.</p>
      </div>

      <div className="space-y-6">
        
        {/* Render Valid Categories */}
        {categories.map(cat => {
          const catActive = activeRoadmaps.filter(r => r.category_id === cat.id);
          if (catActive.length === 0) return null;

          return (
            <div key={cat.id} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b border-neutral-100 pb-4">
                <h2 className="text-lg font-semibold">{cat.name}</h2>
                <span className="text-xs font-medium bg-neutral-100 text-neutral-500 px-3 py-1 rounded-full uppercase tracking-wider">
                  Slot Status: {catActive.length} / {cat.active_limit}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catActive.map(rm => (
                  <div key={rm.id} className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 flex flex-col hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg leading-tight pr-4">{rm.title}</h3>
                      {rm.is_ai_generated && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase font-bold shrink-0">AI</span>}
                    </div>
                    <p className="text-xs text-neutral-500 mb-6 font-mono">Priority: {rm.priority_score}</p>
                    
                    {rm.is_ai_generated || !rm.simple_url ? (
                        <button onClick={() => router.push(`/roadmap/${rm.id}`)} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition mt-auto mb-2">
                        <Play size={14} fill="currentColor" /> Enter Roadmap
                        </button>
                    ) : (
                        <a href={rm.simple_url} target="_blank" rel="noreferrer" className="w-full bg-neutral-900 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 transition mt-auto mb-2">
                        Open Link ↗
                        </a>
                    )}
                    
                    <div className="flex gap-2">
                      <button onClick={() => updateStatus(rm.id, 'completed')} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-neutral-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition border border-transparent hover:border-green-100"><CheckCircle size={14} /> Finish</button>
                      <button onClick={() => updateStatus(rm.id, 'wishlist')} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-neutral-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition border border-transparent hover:border-orange-100"><ListTodo size={14} /> Demote</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* --- SAFETY NET: Uncategorized Active Courses --- */}
        {uncategorizedActive.length > 0 && (
          <div className="bg-white border border-orange-200 rounded-2xl p-6 shadow-sm mt-6">
            <div className="flex justify-between items-center mb-6 border-b border-orange-100 pb-4">
              <h2 className="text-lg font-semibold text-orange-700 flex items-center gap-2">
                <AlertCircle size={20} /> Uncategorized & Manual Uploads
              </h2>
              <span className="text-xs font-medium bg-orange-50 text-orange-700 px-3 py-1 rounded-full uppercase tracking-wider">
                Unrestricted Slots
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uncategorizedActive.map(rm => (
                <div key={rm.id} className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 flex flex-col hover:border-orange-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg leading-tight pr-4">{rm.title}</h3>
                  </div>
                  <p className="text-xs text-neutral-500 mb-6 font-mono">Priority: {rm.priority_score}</p>
                  
                  <button onClick={() => router.push(`/roadmap/${rm.id}`)} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition mt-auto mb-2">
                    <Play size={14} fill="currentColor" /> Enter Roadmap
                  </button>
                  
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(rm.id, 'completed')} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-neutral-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition border border-transparent hover:border-green-100"><CheckCircle size={14} /> Finish</button>
                    <button onClick={() => updateStatus(rm.id, 'wishlist')} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-neutral-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition border border-transparent hover:border-orange-100"><ListTodo size={14} /> Demote</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {activeRoadmaps.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-neutral-200 rounded-3xl text-neutral-500 bg-white/50">
            <LayoutDashboard size={40} className="mx-auto mb-4 opacity-20" />
            <p>Your workspace is clear. Promote a course from your wishlist.</p>
            <button onClick={() => router.push('/wishlist')} className="mt-4 px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition">Go to Wishlist</button>
          </div>
        )}
      </div>
    </div>
  );
}