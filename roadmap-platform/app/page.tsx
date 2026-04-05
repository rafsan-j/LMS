"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  CheckCircle2, Circle, Clock, Calendar, BookOpen, 
  Zap, Loader2, ArrowRight, Target, Flame
} from "lucide-react";

type FocusEvent = { id: string; title: string; event_date: string; };
type RoadmapMin = { id: string; title: string; linked_event_id: string | null; };
type TodoMin = { id: string; title: string; is_completed: boolean; linked_roadmap_id: string | null; };

export default function DeepWorkHome() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [closestEvent, setClosestEvent] = useState<{ event: FocusEvent, daysLeft: number } | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodoMin[]>([]);
  const [activeRoadmaps, setActiveRoadmaps] = useState<(RoadmapMin & { daysLeft: number | null })[]>([]);
  const [roadmapMap, setRoadmapMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkSessionAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let uid = session?.user?.id;
      if (!uid) {
        const { data: fallback } = await supabase.from('focus_user_profiles').select('user_id').limit(1).single();
        if (fallback) uid = fallback.user_id;
        else return router.push("/login");
      }
      setUserId(uid);
      fetchData(uid);
    };
    checkSessionAndFetch();
  }, [router]);

  const fetchData = async (uid: string) => {
    setIsLoading(true);

    // 1. Fetch all events to find the absolute closest deadline
    const { data: eventsData } = await supabase.from("focus_events").select("*").eq("user_id", uid);
    let nearest: { event: FocusEvent, daysLeft: number } | null = null;
    
    if (eventsData && eventsData.length > 0) {
      eventsData.forEach(event => {
        const days = getDaysRemaining(event.event_date);
        if (days >= 0 && (!nearest || days < nearest.daysLeft)) {
          nearest = { event, daysLeft: days };
        }
      });
    }
    setClosestEvent(nearest);

    // 2. Fetch active Roadmaps and calculate their personal urgency
    const { data: roadmapData } = await supabase.from("roadmaps").select("id, title, linked_event_id").eq("user_id", uid);
    if (roadmapData) {
      const rMap: Record<string, string> = {};
      const enrichedRoadmaps = roadmapData.map(rm => {
        rMap[rm.id] = rm.title;
        let daysLeft = null;
        if (rm.linked_event_id && eventsData) {
          const linkedEvent = eventsData.find(e => e.id === rm.linked_event_id);
          if (linkedEvent) daysLeft = getDaysRemaining(linkedEvent.event_date);
        }
        return { ...rm, daysLeft };
      });
      
      // Sort: Urgent first, then unlinked
      enrichedRoadmaps.sort((a, b) => {
        if (a.daysLeft === null) return 1;
        if (b.daysLeft === null) return -1;
        return a.daysLeft - b.daysLeft;
      });
      
      setActiveRoadmaps(enrichedRoadmaps);
      setRoadmapMap(rMap);
    }

    // 3. Fetch ONLY Today's uncompleted tasks from the Command Center
    const { data: todoData } = await supabase
      .from("focus_todos")
      .select("id, title, is_completed, linked_roadmap_id")
      .eq("user_id", uid)
      .eq("horizon_status", "today")
      .eq("is_completed", false);
      
    if (todoData) setTodayTasks(todoData);

    setIsLoading(false);
  };

  const getDaysRemaining = (dateStr: string) => {
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const diffTime = target.getTime() + (target.getTimezoneOffset() * 60000) - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const completeTaskFast = async (id: string) => {
    setTodayTasks(todayTasks.filter(t => t.id !== id));
    await supabase.from("focus_todos").update({ is_completed: true }).eq("id", id);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-neutral-400"><Loader2 className="animate-spin mr-2" /> Initializing OS...</div>;

  return (
    <div className="p-6 md:p-10 mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen flex flex-col bg-[#0a0a0a]">
      
      {/* 1. Global Milestone Countdown */}
      {closestEvent && (
        <div className="mb-10 w-full rounded-2xl bg-gradient-to-br from-blue-900/40 to-neutral-900 border border-blue-500/20 p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Target size={120} className="text-blue-500" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h2 className="text-blue-400 font-bold tracking-wider text-xs uppercase mb-2 flex items-center gap-2"><Flame size={14}/> Primary Target</h2>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">{closestEvent.event.title}</h1>
              <p className="text-neutral-400 font-medium">All systems prioritized for this outcome.</p>
            </div>
            
            <div className="flex flex-col items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-6 shrink-0">
              <span className="text-5xl font-black text-white">{closestEvent.daysLeft}</span>
              <span className="text-neutral-400 text-sm font-bold uppercase tracking-widest mt-1">Days Left</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. Tactical Execution (Command Center Mirror) */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Zap size={18} className="text-amber-400"/> Deep Work (Today)</h2>
            <Link href="/todo" className="text-xs font-bold text-neutral-500 hover:text-blue-400 flex items-center gap-1 transition-colors">Open Center <ArrowRight size={12}/></Link>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg flex-1">
            {todayTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-600 py-10">
                <CheckCircle2 size={32} className="mb-3 opacity-30" />
                <span className="text-sm font-medium text-center">Zone clear.<br/>You have no critical tasks for today.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {todayTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 bg-neutral-950 border border-neutral-800 p-3 rounded-xl group hover:border-neutral-700 transition-colors">
                    <button onClick={() => completeTaskFast(task.id)} className="mt-0.5 text-neutral-500 hover:text-green-500 transition-colors shrink-0">
                      <Circle size={18} strokeWidth={2.5} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-200 text-sm truncate">{task.title}</p>
                      {task.linked_roadmap_id && roadmapMap[task.linked_roadmap_id] && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-blue-500 uppercase tracking-wider truncate max-w-full">
                          {roadmapMap[task.linked_roadmap_id]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Active Roadmaps Sorted by Temporal Priority */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><BookOpen size={18} className="text-blue-400"/> Active Curriculum</h2>
            <Link href="/wishlist" className="text-xs font-bold text-neutral-500 hover:text-blue-400 flex items-center gap-1 transition-colors">View Queue <ArrowRight size={12}/></Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeRoadmaps.length === 0 ? (
              <div className="sm:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-10 flex flex-col items-center justify-center text-neutral-500">
                <p>No active courses found.</p>
                <Link href="/wishlist" className="mt-4 text-blue-500 hover:underline text-sm font-medium">Add a course from your wishlist</Link>
              </div>
            ) : (
              activeRoadmaps.map(rm => {
                const isUrgent = rm.daysLeft !== null && rm.daysLeft <= 14;
                
                return (
                  <Link href={`/roadmap/${rm.id}`} key={rm.id}>
                    <div className={`h-full bg-neutral-900 border ${isUrgent ? 'border-amber-500/30' : 'border-neutral-800'} hover:border-blue-500/50 rounded-2xl p-5 shadow-lg transition-all group hover:-translate-y-1`}>
                      <h3 className="font-bold text-white text-lg mb-4 group-hover:text-blue-400 transition-colors line-clamp-2">{rm.title}</h3>
                      
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-neutral-800/50">
                        {rm.daysLeft !== null ? (
                          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isUrgent ? 'text-amber-500' : 'text-neutral-400'}`}>
                            <Clock size={12}/> {rm.daysLeft} Days to finish
                          </span>
                        ) : (
                          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                            <Calendar size={12}/> No Deadline
                          </span>
                        )}
                        <ArrowRight size={16} className="text-neutral-600 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}