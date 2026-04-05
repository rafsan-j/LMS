"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Calendar, Clock, Plus, Loader2, Trash2, Link as LinkIcon, BookOpen, Flag
} from "lucide-react";

type FocusEvent = {
  id: string;
  title: string;
  event_date: string;
};

type RoadmapMin = {
  id: string;
  title: string;
  linked_event_id: string | null;
};

export default function EventsManager() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [events, setEvents] = useState<FocusEvent[]>([]);
  const [roadmaps, setRoadmaps] = useState<RoadmapMin[]>([]);
  
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [isAdding, setIsAdding] = useState(false);

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
    // Fetch Events
    const { data: eventData } = await supabase.from("focus_events").select("*").eq("user_id", uid).order("event_date", { ascending: true });
    if (eventData) setEvents(eventData);

    // Fetch Roadmaps to see what is linked
    const { data: roadmapData } = await supabase.from("roadmaps").select("id, title, linked_event_id").eq("user_id", uid);
    if (roadmapData) setRoadmaps(roadmapData);
    
    setIsLoading(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate || !userId) return;
    
    setIsAdding(true);
    try {
      const { error } = await supabase.from("focus_events").insert([{
        user_id: userId,
        title: newEventTitle.trim(),
        event_date: newEventDate,
      }]);

      if (error) throw error;
      setNewEventTitle("");
      setNewEventDate("");
      fetchData(userId);
    } catch (error) {
      console.error("Failed to create event:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("Delete this event? Roadmaps linked to it will simply become unlinked.")) return;
    setEvents(events.filter(e => e.id !== id));
    await supabase.from("focus_events").delete().eq("id", id);
    fetchData(userId!); // Refresh roadmaps to clear links
  };

  const linkRoadmapToEvent = async (roadmapId: string, eventId: string | null) => {
    // Optimistic update
    setRoadmaps(roadmaps.map(rm => rm.id === roadmapId ? { ...rm, linked_event_id: eventId } : rm));
    await supabase.from("roadmaps").update({ linked_event_id: eventId }).eq("id", roadmapId);
  };

  const getDaysRemaining = (dateStr: string) => {
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight
    
    // Add timezone offset correction to prevent off-by-one-day errors
    const diffTime = target.getTime() + (target.getTimezoneOffset() * 60000) - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-neutral-400"><Loader2 className="animate-spin mr-2" /> Syncing Timeline...</div>;

  return (
    <div className="p-6 md:p-10 mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen flex flex-col bg-[#0a0a0a]">
      <div className="mb-8 max-w-5xl w-full mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Event Anchors</h1>
        <p className="text-neutral-400">Establish hard deadlines for your semesters, exams, or projects. Link roadmaps to them to automatically scale their priority as the deadline approaches.</p>
      </div>

      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Create Form */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg sticky top-6">
          <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
            <Flag size={16} className="text-blue-500" /> New Milestone
          </h2>
          
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">Event Title</label>
              <input 
                type="text" 
                value={newEventTitle} 
                onChange={(e) => setNewEventTitle(e.target.value)} 
                placeholder="e.g. Semester 2 Finals" 
                disabled={isAdding}
                required
                className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:border-blue-500/50 outline-none text-white placeholder:text-neutral-700 font-medium transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">Target Date</label>
              <input 
                type="date" 
                value={newEventDate} 
                onChange={(e) => setNewEventDate(e.target.value)} 
                disabled={isAdding}
                required
                className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:border-blue-500/50 outline-none text-white font-medium transition-colors cursor-pointer"
                style={{ colorScheme: 'dark' }} // Forces datepicker UI to be dark
              />
            </div>
            
            <button type="submit" disabled={!newEventTitle.trim() || !newEventDate || isAdding} className="w-full mt-2 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 transition-colors flex items-center justify-center gap-2 font-medium">
              {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={2.5} />} Create Anchor
            </button>
          </form>
        </div>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {events.length === 0 ? (
             <div className="h-64 flex flex-col items-center justify-center text-neutral-600 border-2 border-dashed border-neutral-800 rounded-2xl bg-neutral-900/30">
               <Calendar size={32} className="mb-3 opacity-50" />
               <span className="text-sm font-medium">Your timeline is empty.</span>
             </div>
          ) : (
            events.map(event => {
              const daysLeft = getDaysRemaining(event.event_date);
              const isPast = daysLeft < 0;
              const isUrgent = daysLeft >= 0 && daysLeft <= 14; // Urgent if less than 2 weeks
              
              // Find roadmaps linked to this specific event
              const linkedRoadmaps = roadmaps.filter(rm => rm.linked_event_id === event.id);
              // Find roadmaps NOT linked to any event yet
              const availableRoadmaps = roadmaps.filter(rm => rm.linked_event_id === null);

              return (
                <div key={event.id} className={`bg-neutral-900 border ${isUrgent ? 'border-amber-500/30 shadow-amber-500/5' : 'border-neutral-800'} rounded-2xl p-6 shadow-lg transition-all group relative`}>
                  
                  {/* Event Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{event.title}</h3>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-neutral-400"><Calendar size={14}/> {new Date(event.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-sm tracking-wide ${isPast ? 'bg-neutral-800 text-neutral-500' : isUrgent ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                        <Clock size={16} /> 
                        {isPast ? `${Math.abs(daysLeft)} Days Ago` : daysLeft === 0 ? 'TODAY' : `${daysLeft} Days Left`}
                      </div>
                      <button onClick={() => deleteEvent(event.id)} className="text-neutral-500 hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>

                  {/* Linked Roadmaps Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2"><LinkIcon size={12}/> Anchored Roadmaps</h4>
                    
                    <div className="flex flex-col gap-2">
                      {linkedRoadmaps.length === 0 ? (
                        <div className="text-sm text-neutral-500 italic px-2 py-1">No courses anchored to this deadline yet.</div>
                      ) : (
                        linkedRoadmaps.map(rm => (
                          <div key={rm.id} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 px-3 py-2 rounded-lg">
                            <span className="text-sm font-medium text-neutral-300 flex items-center gap-2"><BookOpen size={14} className="text-blue-500"/> {rm.title}</span>
                            <button onClick={() => linkRoadmapToEvent(rm.id, null)} className="text-xs font-medium text-neutral-500 hover:text-red-400 px-2 py-1 hover:bg-red-500/10 rounded transition-colors">Unlink</button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Attach Existing Roadmap Dropdown */}
                    {availableRoadmaps.length > 0 && !isPast && (
                      <div className="pt-2">
                        <select 
                          onChange={(e) => {
                            if (e.target.value) linkRoadmapToEvent(e.target.value, event.id);
                            e.target.value = ""; // reset dropdown
                          }}
                          className="text-sm bg-neutral-950 border border-neutral-800 text-neutral-400 rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 cursor-pointer hover:bg-neutral-800 transition-colors w-full sm:w-auto"
                        >
                          <option value="">+ Anchor an active course...</option>
                          {availableRoadmaps.map(rm => <option key={rm.id} value={rm.id}>{rm.title}</option>)}
                        </select>
                      </div>
                    )}

                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}