"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, Circle, Trash2, Plus, Calendar, 
  BookOpen, Loader2, Zap, Sun, Inbox, ArrowRight, X, ChevronRight, ExternalLink, Pencil, RotateCcw
} from "lucide-react";

type Todo = {
  id: string;
  title: string;
  is_completed: boolean;
  linked_roadmap_id: string | null;
  linked_lesson_id: string | null; 
  horizon_status: 'today' | 'tomorrow' | 'week' | 'backlog';
};

type RoadmapMin = { id: string; title: string; file_url: string; };
type LessonMin = { id: string; title: string; };

export default function CommandDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [todos, setTodos] = useState<Todo[]>([]);
  const [roadmaps, setRoadmaps] = useState<RoadmapMin[]>([]);
  const [roadmapMap, setRoadmapMap] = useState<Record<string, string>>({});
  
  const [inputValue, setInputValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadmapMin | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonMin | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<'today' | 'tomorrow' | 'week' | 'backlog'>('today');
  
  const [showRoadmapMenu, setShowRoadmapMenu] = useState(false);
  const [showLessonMenu, setShowLessonMenu] = useState(false);
  const [showHorizonMenu, setShowHorizonMenu] = useState(false);
  const [lessons, setLessons] = useState<LessonMin[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // --- NEW: Editing State ---
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  
  const inputRef = useRef<HTMLInputElement>(null);
  const horizons: ('today' | 'tomorrow' | 'week' | 'backlog')[] = ['today', 'tomorrow', 'week', 'backlog'];

  useEffect(() => {
    if (showRoadmapMenu || showLessonMenu || showHorizonMenu) {
      const el = document.getElementById(`menu-item-${activeIndex}`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex, showRoadmapMenu, showLessonMenu, showHorizonMenu]);

  useEffect(() => {
    const checkSessionAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let uid = session?.user?.id;
      if (!uid) {
        const { data: fallback } = await supabase.from('focus_user_profiles').select('user_id').limit(1).single();
        if (fallback) uid = fallback.user_id;
        else return;
      }
      setUserId(uid);
      fetchData(uid);
    };
    checkSessionAndFetch();
  }, [router]);

  const fetchData = async (uid: string) => {
    setIsLoading(true);
    const { data: todoData } = await supabase.from("focus_todos").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (todoData) setTodos(todoData);

    const { data: roadmapData } = await supabase.from("roadmaps").select("id, title, file_url");
    if (roadmapData) {
      setRoadmaps(roadmapData);
      const rMap: Record<string, string> = {};
      roadmapData.forEach((rm: RoadmapMin) => { rMap[rm.id] = rm.title; });
      setRoadmapMap(rMap);
    }
    setIsLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.endsWith("@")) { setShowRoadmapMenu(true); setShowHorizonMenu(false); setShowLessonMenu(false); setActiveIndex(0); } 
    else if (!val.includes("@") && showRoadmapMenu) { setShowRoadmapMenu(false); }

    if (val.endsWith("#")) { setShowHorizonMenu(true); setShowRoadmapMenu(false); setShowLessonMenu(false); setActiveIndex(0); } 
    else if (!val.includes("#") && showHorizonMenu) { setShowHorizonMenu(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showRoadmapMenu && !showHorizonMenu && !showLessonMenu) return;
    let max = 0;
    if (showRoadmapMenu) max = roadmaps.length;
    if (showHorizonMenu) max = horizons.length;
    if (showLessonMenu) max = lessons.length;

    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((prev) => (prev + 1) % max); } 
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((prev) => (prev - 1 + max) % max); } 
    else if (e.key === "Enter") {
      e.preventDefault();
      if (showRoadmapMenu && roadmaps[activeIndex]) handleSelectRoadmap(roadmaps[activeIndex]);
      else if (showHorizonMenu && horizons[activeIndex]) handleSelectHorizon(horizons[activeIndex]);
      else if (showLessonMenu && lessons[activeIndex]) handleSelectLesson(lessons[activeIndex]);
    } else if (e.key === "Escape") {
      setShowRoadmapMenu(false); setShowHorizonMenu(false); setShowLessonMenu(false);
    }
  };

  const fetchLessonsForRoadmap = async (fileUrl: string) => {
    setIsLoadingLessons(true);
    try {
      const res = await fetch(fileUrl);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const blocks = Array.from(doc.querySelectorAll('.lec-block'));
      const extracted: LessonMin[] = [];
      
      if (blocks.length > 0) {
        blocks.forEach((block, idx) => {
          let titleText = "";
          const heading = block.querySelector('h3, h4, h5');
          if (heading && heading.textContent) { titleText = heading.textContent.trim(); } 
          else {
            const rawText = block.textContent?.replace(/\s+/g, ' ').trim() || "";
            titleText = rawText.substring(0, 60); 
          }
          titleText = titleText.replace(/^(Day goal|Objective|Task|Goal)[^a-zA-Z0-9]*\s*/i, '');
          if (titleText.length > 45) titleText = titleText.substring(0, 45) + "...";
          if (!titleText) titleText = `Module ${idx + 1}`;
          extracted.push({ id: block.id || `retro-${idx}`, title: titleText });
        });
      } else {
        const headers = Array.from(doc.querySelectorAll('h3, h4'));
        headers.forEach((hdr, idx) => { extracted.push({ id: hdr.id || `fallback-${idx}`, title: hdr.textContent?.trim() || `Section ${idx + 1}` }); });
      }

      setLessons(extracted);
      setShowLessonMenu(true);
      setActiveIndex(0);
    } catch (err) { console.error("Failed to parse lessons", err); } 
    finally { setIsLoadingLessons(false); }
  };

  const handleSelectRoadmap = (rm: RoadmapMin) => { setSelectedRoadmap(rm); setInputValue(inputValue.replace(/@\w*/, "").trim()); setShowRoadmapMenu(false); fetchLessonsForRoadmap(rm.file_url); inputRef.current?.focus(); };
  const handleSelectLesson = (lesson: LessonMin) => { setSelectedLesson(lesson); setShowLessonMenu(false); inputRef.current?.focus(); };
  const handleSelectHorizon = (horizon: 'today' | 'tomorrow' | 'week' | 'backlog') => { setSelectedHorizon(horizon); setInputValue(inputValue.replace(/#\w*/, "").trim()); setShowHorizonMenu(false); inputRef.current?.focus(); };
  const clearRoadmapSelection = () => { setSelectedRoadmap(null); setSelectedLesson(null); setShowLessonMenu(false); }

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !userId) return;
    
    setIsAdding(true);
    try {
      const finalTitle = selectedLesson ? `${inputValue.trim()} — ${selectedLesson.title}` : inputValue.trim();

      const { error } = await supabase.from("focus_todos").insert([{
        user_id: userId,
        title: finalTitle,
        linked_roadmap_id: selectedRoadmap?.id || null,
        linked_lesson_id: selectedLesson?.id || null,
        horizon_status: selectedHorizon
      }]);

      if (error) throw error;
      setInputValue(""); setSelectedRoadmap(null); setSelectedLesson(null); setSelectedHorizon('today');
      fetchData(userId);
    } catch (error) { console.error("Failed to add task:", error); } 
    finally { setIsAdding(false); }
  };

  // --- TASK ACTIONS ---
  const toggleComplete = async (todo: Todo) => {
    if (!userId) return;
    setTodos(todos.map(t => t.id === todo.id ? { ...t, is_completed: !t.is_completed } : t));
    await supabase.from("focus_todos").update({ is_completed: !todo.is_completed }).eq("id", todo.id);
  };

  const deleteTodo = async (id: string) => {
    if (!userId) return;
    setTodos(todos.filter(t => t.id !== id));
    await supabase.from("focus_todos").delete().eq("id", id);
  };

  const moveHorizon = async (id: string, newHorizon: string) => {
    if (!userId) return;
    setTodos(todos.map(t => t.id === id ? { ...t, horizon_status: newHorizon as any } : t));
    await supabase.from("focus_todos").update({ horizon_status: newHorizon }).eq("id", id);
  };

  // --- NEW: Inline Editing Functions ---
  const startEditing = (todo: Todo) => {
    setEditingTaskId(todo.id);
    setEditTitle(todo.title);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingTaskId(null);
      return;
    }
    
    // Optimistic UI Update
    setTodos(todos.map(t => t.id === id ? { ...t, title: editTitle.trim() } : t));
    setEditingTaskId(null);
    
    // Save to Database
    await supabase.from("focus_todos").update({ title: editTitle.trim() }).eq("id", id);
  };

  const handleTaskClick = (todo: Todo) => {
    if (!todo.linked_roadmap_id) return;
    let url = `/roadmap/${todo.linked_roadmap_id}`;
    if (todo.linked_lesson_id) url += `?lesson=${todo.linked_lesson_id}`;
    router.push(url);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-neutral-400"><Loader2 className="animate-spin mr-2" /> Booting Command Center...</div>;

  const todayTodos = todos.filter(t => !t.is_completed && t.horizon_status === 'today');
  const upcomingTodos = todos.filter(t => !t.is_completed && (t.horizon_status === 'tomorrow' || t.horizon_status === 'week'));
  const backlogTodos = todos.filter(t => !t.is_completed && t.horizon_status === 'backlog');
  const completedTodos = todos.filter(t => t.is_completed);

  const TaskCard = ({ todo }: { todo: Todo }) => {
    const isEditing = editingTaskId === todo.id;

    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm hover:border-neutral-700 transition-all group relative">
        <div className="flex items-start gap-3">
          <button onClick={() => toggleComplete(todo)} className="mt-0.5 text-neutral-500 hover:text-blue-500 transition-colors flex-shrink-0">
            <Circle size={20} strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            {/* INLINE EDITING LOGIC */}
            {isEditing ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(todo.id);
                  if (e.key === 'Escape') setEditingTaskId(null);
                }}
                onBlur={() => handleSaveEdit(todo.id)}
                className="w-full bg-neutral-950 text-white px-2 py-1 -ml-2 rounded border border-blue-500/50 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium text-[15px] mb-2"
              />
            ) : (
              <div 
                onClick={() => handleTaskClick(todo)}
                className={`${todo.linked_roadmap_id ? 'cursor-pointer hover:text-blue-400' : ''} font-medium text-neutral-200 text-[15px] leading-tight mb-2 pr-6 transition-colors`}
              >
                {todo.title}
              </div>
            )}
            
            {!isEditing && (
              <div className="flex items-center gap-2 flex-wrap">
                {todo.linked_roadmap_id && roadmapMap[todo.linked_roadmap_id] && (
                  <button onClick={() => handleTaskClick(todo)} className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-2 py-1 rounded uppercase tracking-wider truncate max-w-[200px] transition-colors cursor-pointer border border-blue-500/20">
                    <BookOpen size={10} className="flex-shrink-0" /> {roadmapMap[todo.linked_roadmap_id]} <ExternalLink size={10} className="opacity-50 ml-1"/>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hover Actions (Including Edit) */}
        {!isEditing && (
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-neutral-800 p-1 rounded-lg border border-neutral-700">
            <button onClick={() => startEditing(todo)} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-md" title="Edit Task"><Pencil size={14} /></button>
            
            {todo.horizon_status !== 'today' && <button onClick={() => moveHorizon(todo.id, 'today')} className="p-1.5 text-neutral-400 hover:text-blue-400 hover:bg-neutral-700 rounded-md" title="Move to Today"><Sun size={14} /></button>}
            {todo.horizon_status === 'today' && <button onClick={() => moveHorizon(todo.id, 'week')} className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-700 rounded-md" title="Push to Later"><ArrowRight size={14} /></button>}
            
            <button onClick={() => deleteTodo(todo.id)} className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-700 rounded-md"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-10 mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen flex flex-col bg-[#0a0a0a]">
      <div className="mb-8 max-w-7xl w-full mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Command Center</h1>
        <p className="text-neutral-400">Capture thoughts instantly. Type <kbd className="bg-neutral-800 border border-neutral-700 px-1 py-0.5 rounded text-blue-400 font-mono text-sm">@</kbd> to link a course, or <kbd className="bg-neutral-800 border border-neutral-700 px-1 py-0.5 rounded text-amber-400 font-mono text-sm">#</kbd> to set a horizon.</p>
      </div>

      <div className="relative mb-10 z-50 max-w-7xl w-full mx-auto">
        <form onSubmit={handleAddTodo} className="relative flex items-center bg-neutral-900 border border-neutral-800 focus-within:border-blue-500/50 rounded-2xl p-2 transition-colors shadow-lg">
          <div className="flex items-center gap-2 pl-2">
            <button type="button" onClick={() => setSelectedHorizon('today')} className={`text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition ${selectedHorizon === 'today' ? 'bg-blue-500/10 text-blue-400' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>
              {selectedHorizon === 'today' ? <Sun size={12}/> : selectedHorizon === 'tomorrow' ? <Calendar size={12}/> : selectedHorizon === 'week' ? <Calendar size={12}/> : <Inbox size={12}/>}
              {selectedHorizon.charAt(0).toUpperCase() + selectedHorizon.slice(1)} 
            </button>
            
            {selectedRoadmap && (
              <button type="button" onClick={clearRoadmapSelection} className="text-xs font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-500/20 transition truncate max-w-[250px]">
                <BookOpen size={12} className="shrink-0"/> <span className="truncate">{selectedRoadmap.title}</span>
                {selectedLesson && <><ChevronRight size={12} className="mx-0.5 opacity-50 shrink-0"/> <span className="truncate">{selectedLesson.title}</span></>}
                <X size={12} className="ml-1 shrink-0"/>
              </button>
            )}
            {isLoadingLessons && <span className="text-xs font-medium text-neutral-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Scanning...</span>}
          </div>

          <input ref={inputRef} type="text" value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={selectedRoadmap ? "What needs to be done?" : "Type a task... try typing @ or #"} disabled={isAdding} className="flex-1 p-3 bg-transparent outline-none text-white placeholder:text-neutral-600 font-medium ml-2" autoComplete="off" />
          <button type="submit" disabled={!inputValue.trim() || isAdding} className="shrink-0 w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 transition-colors ml-2">
            {isAdding ? <Loader2 size={20} className="animate-spin" /> : <Plus size={24} strokeWidth={2.5} />}
          </button>
        </form>

        {showRoadmapMenu && roadmaps.length > 0 && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden py-2 animate-in slide-in-from-top-2">
            <div className="px-4 py-2 text-xs font-bold text-neutral-500 uppercase tracking-wider">Link to Course</div>
            <div className="max-h-60 overflow-y-auto scroll-smooth">
              {roadmaps.map((rm, idx) => (
                <button key={rm.id} id={`menu-item-${idx}`} type="button" onClick={() => handleSelectRoadmap(rm)} className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors ${activeIndex === idx ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-300 hover:bg-neutral-800'}`}>
                  <BookOpen size={14} className={activeIndex === idx ? 'opacity-100' : 'opacity-50'} /> {rm.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {showLessonMenu && lessons.length > 0 && (
          <div className="absolute top-full left-0 mt-2 w-96 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden py-2 animate-in slide-in-from-top-2">
            <div className="px-4 py-2 text-xs font-bold text-indigo-500 uppercase tracking-wider flex justify-between items-center"><span>Select Lesson</span><button onClick={() => setShowLessonMenu(false)} className="text-neutral-500 hover:text-white"><X size={14}/></button></div>
            <div className="max-h-64 overflow-y-auto scroll-smooth">
              {lessons.map((lesson, idx) => (
                <button key={lesson.id} id={`menu-item-${idx}`} type="button" onClick={() => handleSelectLesson(lesson)} className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${activeIndex === idx ? 'bg-indigo-500/10 text-indigo-400' : 'text-neutral-300 hover:bg-neutral-800'}`}>
                  {lesson.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {showHorizonMenu && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden py-2 animate-in slide-in-from-top-2">
            <div className="px-4 py-2 text-xs font-bold text-neutral-500 uppercase tracking-wider">Set Horizon</div>
            {horizons.map((h, idx) => (
              <button key={h} id={`menu-item-${idx}`} type="button" onClick={() => handleSelectHorizon(h)} className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${activeIndex === idx ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-300 hover:bg-neutral-800'}`}>
                {h === 'today' ? <Sun size={14}/> : h === 'backlog' ? <Inbox size={14}/> : <Calendar size={14}/>} {h.charAt(0).toUpperCase() + h.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl w-full mx-auto">
        <div className="flex flex-col bg-neutral-950 rounded-2xl p-4 border border-neutral-900">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Zap size={16} className="text-amber-400" /> Deep Work (Today)<span className="ml-auto bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs px-2 py-0.5 rounded-full">{todayTodos.length}</span></h2>
          <div className="flex flex-col gap-3 flex-1">
            {todayTodos.length === 0 ? <div className="h-32 flex flex-col items-center justify-center text-neutral-600 border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-900/50"><CheckCircle2 size={24} className="mb-2 opacity-50" /><span className="text-sm font-medium">Zone Clear</span></div> : todayTodos.map(todo => <TaskCard key={todo.id} todo={todo} />)}
          </div>
        </div>

        <div className="flex flex-col bg-neutral-950 rounded-2xl p-4 border border-neutral-900">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Calendar size={16} className="text-blue-400" /> Up Next<span className="ml-auto bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs px-2 py-0.5 rounded-full">{upcomingTodos.length}</span></h2>
          <div className="flex flex-col gap-3 flex-1">
            {upcomingTodos.length === 0 && <div className="h-10"></div>}
            {upcomingTodos.map(todo => <TaskCard key={todo.id} todo={todo} />)}
          </div>
        </div>

        <div className="flex flex-col bg-neutral-950 rounded-2xl p-4 border border-neutral-900">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Inbox size={16} className="text-neutral-500" /> Backlog<span className="ml-auto bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs px-2 py-0.5 rounded-full">{backlogTodos.length}</span></h2>
          <div className="flex flex-col gap-3 flex-1">
            {backlogTodos.length === 0 && <div className="h-10"></div>}
            {backlogTodos.map(todo => <TaskCard key={todo.id} todo={todo} />)}
            
            {/* UPGRADED: Recently Completed Section with interactive buttons */}
            {completedTodos.length > 0 && (
              <div className="mt-8 pt-4 border-t border-neutral-800">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Recently Completed</h3>
                <div className="space-y-2">
                  {completedTodos.map(todo => (
                    <div key={todo.id} className="flex items-start justify-between gap-2 text-sm p-2 hover:bg-neutral-900 rounded-lg group transition-colors">
                      <div className="flex items-start gap-2 overflow-hidden flex-1 cursor-pointer" onClick={() => toggleComplete(todo)}>
                        <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                        <span className="line-through text-neutral-500 truncate">{todo.title}</span>
                      </div>
                      
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                         <button onClick={() => toggleComplete(todo)} className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 rounded-md border border-neutral-700" title="Undo"><RotateCcw size={14}/></button>
                         <button onClick={() => deleteTodo(todo.id)} className="p-1.5 text-neutral-400 hover:text-red-400 bg-neutral-800 rounded-md border border-neutral-700" title="Delete"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}