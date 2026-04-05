"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Sparkles, ListTodo } from "lucide-react";

type Category = { id: string; name: string; active_limit: number };
type Roadmap = { id: string; title: string; category_id: string; is_ai_generated: boolean; priority_score: number; };

export default function Wishlist() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [wishlistRoadmaps, setWishlistRoadmaps] = useState<Roadmap[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchWishlist(); }, []);

  const fetchWishlist = async () => {
    setIsLoading(true);
    const { data: cats } = await supabase.from("focus_categories").select("*");
    
    // CRITICAL LOGIC: Only fetch Wishlist items that are PUBLISHED
    const { data: rm } = await supabase.from("roadmaps")
      .select("*")
      .eq('status', 'wishlist')
      .eq('is_published', true) 
      .order("priority_score", { ascending: false });
    
    if (cats) setCategories(cats);
    if (rm) setWishlistRoadmaps(rm);
    setIsLoading(false);
  };

  const activateTarget = async (roadmap: Roadmap) => {
    const cat = categories.find(c => c.id === roadmap.category_id);
    const { count } = await supabase.from("roadmaps").select("*", { count: 'exact', head: true })
      .eq('category_id', roadmap.category_id).eq('status', 'active');
    
    if (cat && count !== null && count >= cat.active_limit) {
      return alert(`Slot limit reached! You already have ${count} active courses in ${cat.name}. Finish or demote one first.`);
    }

    await supabase.from("roadmaps").update({ status: 'active' }).eq('id', roadmap.id);
    fetchWishlist();
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-neutral-500">Loading Queue...</div>;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Wishlist Queue</h1>
        <p className="text-neutral-500">Your backlog. Draft items in the Admin panel are hidden from here.</p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-neutral-100 text-neutral-500">
              <tr>
                <th className="px-6 py-4 font-medium w-24">Score</th>
                <th className="px-6 py-4 font-medium">Target</th>
                <th className="px-6 py-4 font-medium text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {wishlistRoadmaps.map((rm) => (
                <tr key={rm.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-semibold text-blue-600 text-base">{rm.priority_score || '5.0'}</td>
                  <td className="px-6 py-4 whitespace-normal">
                    <div className="font-medium text-neutral-900 text-base flex items-center gap-2">
                      {rm.title}
                      {rm.is_ai_generated && <Sparkles size={14} className="text-blue-500" />}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{categories.find(c => c.id === rm.category_id)?.name || 'Uncategorized'}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                      <button onClick={() => activateTarget(rm)} className="bg-neutral-900 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-neutral-800 transition">Promote to Active</button>
                  </td>
                </tr>
              ))}
              {wishlistRoadmaps.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-16 text-center text-neutral-400"><ListTodo size={32} className="mx-auto mb-3 opacity-20" /> Queue is empty or items are set to Draft.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}