"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Trash2, Eye, EyeOff, UploadCloud, LayoutDashboard, 
  Code, FileUp, Pencil, X, Sparkles, Wand2, Loader2, FolderPlus, Save, Brain, FileText
} from "lucide-react";

type Category = { id: string; name: string; active_limit: number };
type Roadmap = { 
  id: string; title: string; category_id: string; description: string; 
  file_url: string; is_published: boolean; target_deadline: string | null; 
  urgency: number; importance: number; difficulty: number; priority_score: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<"upload" | "manage" | "generate" | "categories">("upload");
  const [uploadMethod, setUploadMethod] = useState<"file" | "paste">("file");
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  
  // Upload Form State
  const [title, setTitle] = useState(""); 
  const [description, setDescription] = useState(""); 
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null); 
  const [pastedHtml, setPastedHtml] = useState("");
  const [status, setStatus] = useState<{ type: "error" | "success" | "loading", msg: string } | null>(null);
  const [targetDeadline, setTargetDeadline] = useState("");
  
  // Priority State (Upload)
  const [u, setU] = useState(5);
  const [i, setI] = useState(5);
  const [d, setD] = useState(5);
  const [aiReasoning, setAiReasoning] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const priorityScore = parseFloat(((u * 0.6) + (i * 0.3) + (d * 0.1)).toFixed(1));

  // Generate Form State
  const [genTopic, setGenTopic] = useState(""); 
  const [genLevel, setGenLevel] = useState(""); 
  const [genUrl, setGenUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false); 
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Category State
  const [newCatName, setNewCatName] = useState("");
  const [newCatLimit, setNewCatLimit] = useState(3);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatLimit, setEditCatLimit] = useState(3);

  // Edit Roadmap Modal State
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPastedHtml, setEditPastedHtml] = useState("");
  const [editUploadMethod, setEditUploadMethod] = useState<"keep" | "file" | "paste">("keep");
  const [editTargetDeadline, setEditTargetDeadline] = useState("");
  
  // Priority State (Edit)
  const [editU, setEditU] = useState(5);
  const [editI, setEditI] = useState(5);
  const [editD, setEditD] = useState(5);
  const [editAiReasoning, setEditAiReasoning] = useState("");
  const editPriorityScore = parseFloat(((editU * 0.6) + (editI * 0.3) + (editD * 0.1)).toFixed(1));

  useEffect(() => {
    const checkSessionAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profile } = await supabase.from("focus_user_profiles").select("*").eq("user_id", session.user.id).single();
        if (profile) setUserProfile(profile);
      } else {
        console.warn("No active session found. Skipping profile fetch for dev mode.");
      }

      setIsCheckingAuth(false);
      fetchInitialData();
    };
    checkSessionAndFetchData();
  }, [router]);

  const fetchInitialData = async () => {
    const { data: cats } = await supabase.from("focus_categories").select("*").order("name");
    if (cats) { 
      setCategories(cats); 
      if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id); 
    }
    fetchRoadmaps();
  };

  const fetchRoadmaps = async () => {
    const { data } = await supabase.from("roadmaps").select("*").order("created_at", { ascending: false });
    if (data) setRoadmaps(data);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setStatus({ type: "loading", msg: "Adding..." });
    await supabase.from("focus_categories").insert([{ name: newCatName, active_limit: newCatLimit }]);
    setNewCatName(""); setNewCatLimit(3);
    fetchInitialData();
    setStatus({ type: "success", msg: "Category created!" });
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCatName.trim()) return;
    setStatus({ type: "loading", msg: "Updating..." });
    try {
      const { error } = await supabase.from("focus_categories").update({ name: editCatName, active_limit: editCatLimit }).eq("id", editingCategory.id);
      if (error) throw error;
      setStatus({ type: "success", msg: "Category updated!" });
      setEditingCategory(null);
      fetchInitialData();
    } catch (err: any) { setStatus({ type: "error", msg: err.message }); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Delete this category? (Will fail if courses are attached)")) return;
    try {
      const { error } = await supabase.from("focus_categories").delete().eq("id", id);
      if (error) {
        if (error.code === '23503') throw new Error("Cannot delete: You must delete or reassign all courses in this category first.");
        throw error;
      }
      setStatus({ type: "success", msg: "Category deleted!" });
      fetchInitialData();
    } catch (err: any) { setStatus({ type: "error", msg: err.message }); }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategory(cat); setEditCatName(cat.name); setEditCatLimit(cat.active_limit); setStatus(null);
  };

  const createHtmlFileFromText = (htmlString: string, filename: string) => {
    const blob = new Blob([htmlString], { type: "text/html" });
    return new File([blob], filename, { type: "text/html" });
  };

  const uploadFileToStorage = async (targetFile: File) => {
    const fileExt = targetFile.name.split('.').pop() || 'html';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from("roadmap_files").upload(fileName, targetFile);
    if (error) throw error;
    const { data } = supabase.storage.from("roadmap_files").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const extractMetadataFromText = async (text: string) => {
    if (!text.trim()) return;
    setIsExtracting(true);
    setStatus({ type: "loading", msg: "AI is analyzing metadata..." });

    try {
      const response = await fetch('/api/extract-metadata', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: text })
      });
      if (!response.ok) throw new Error("AI extraction failed.");
      const data = await response.json();
      
      setTitle(data.title || ""); 
      setDescription(data.description || "");
      if (data.category && categories.length > 0) {
        const match = categories.find(c => c.name.toLowerCase().includes(data.category.toLowerCase()));
        if (match) setCategoryId(match.id);
      }
      setStatus({ type: "success", msg: "AI successfully auto-filled the details!" });
    } catch (error) {
      setStatus({ type: "error", msg: "AI failed to read content. Please enter manually." });
    } finally { setIsExtracting(false); }
  };

  const handleEvaluatePriority = async (mode: "upload" | "edit") => {
    const evalTitle = mode === "upload" ? title : editingRoadmap?.title;
    if (!evalTitle) return alert("Please enter a title before evaluating.");

    setIsEvaluating(true);
    setStatus({ type: "loading", msg: "AI is evaluating priority..." });
    
    try {
      const response = await fetch('/api/evaluate-priority', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: evalTitle, 
          description: mode === "upload" ? description : editingRoadmap?.description,
          targetDeadline: mode === "upload" ? targetDeadline : editTargetDeadline,
          userProfile 
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Evaluation failed.");

      if (mode === "upload") {
        setU(data.urgency); setI(data.importance); setD(data.difficulty);
        setAiReasoning(data.reasoning);
      } else {
        setEditU(data.urgency); setEditI(data.importance); setEditD(data.difficulty);
        setEditAiReasoning(data.reasoning);
      }
      setStatus(null);
    } catch (error: any) {
      console.error(error); 
      setStatus({ type: "error", msg: error.message });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTopic.trim()) return;
    setIsGenerating(true); setStatus({ type: "loading", msg: "Architecting..." });
    try {
      const response = await fetch('/api/generate-roadmap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: genTopic, level: genLevel, playlistUrl: genUrl })
      });
      if (!response.ok) throw new Error("Generation failed.");
      const data = await response.json();
      
      setPastedHtml(data.html); setUploadMethod("paste"); setActiveTab("upload");
      setGenTopic(""); setGenLevel(""); setGenUrl("");
      extractMetadataFromText(data.html);
    } catch (err: any) { setStatus({ type: "error", msg: err.message }); } 
    finally { setIsGenerating(false); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return setStatus({ type: "error", msg: "Please select a category." });
    setStatus({ type: "loading", msg: "Publishing..." });

    try {
      let finalFile = file;
      if (uploadMethod === "paste" && pastedHtml) {
        finalFile = createHtmlFileFromText(pastedHtml, "pasted-roadmap.html");
      }
      if (!finalFile) throw new Error("Please select or paste an HTML file.");

      const publicUrl = await uploadFileToStorage(finalFile);
      const { error: dbError } = await supabase.from("roadmaps").insert([{ 
        title, description, category_id: categoryId, file_url: publicUrl, 
        is_published: true, status: 'wishlist', 
        target_deadline: targetDeadline || null,
        urgency: u, importance: i, difficulty: d, priority_score: priorityScore 
      }]);
      if (dbError) throw dbError;

      setStatus({ type: "success", msg: "Published to Wishlist!" });
      setTitle(""); setDescription(""); setFile(null); setPastedHtml(""); setTargetDeadline("");
      setU(5); setI(5); setD(5); setAiReasoning("");
      fetchRoadmaps(); setActiveTab("manage");
    } catch (error: any) { setStatus({ type: "error", msg: error.message }); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoadmap) return;
    setStatus({ type: "loading", msg: "Saving changes..." });

    try {
      let updatedFileUrl = editingRoadmap.file_url;
      if (editUploadMethod !== "keep") {
        let newFile = editFile;
        if (editUploadMethod === "paste" && editPastedHtml) {
          newFile = createHtmlFileFromText(editPastedHtml, "updated-roadmap.html");
        }
        if (!newFile) throw new Error("Please provide the new HTML file.");
        updatedFileUrl = await uploadFileToStorage(newFile);
      }
      const { error } = await supabase.from("roadmaps").update({ 
        title: editingRoadmap.title, category_id: editingRoadmap.category_id, 
        description: editingRoadmap.description, file_url: updatedFileUrl,
        target_deadline: editTargetDeadline || null,
        urgency: editU, importance: editI, difficulty: editD, priority_score: editPriorityScore
      }).eq("id", editingRoadmap.id);
      
      if (error) throw error;
      setStatus({ type: "success", msg: "Roadmap updated successfully!" });
      setEditingRoadmap(null); fetchRoadmaps();
    } catch (error: any) { setStatus({ type: "error", msg: error.message }); }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    await supabase.from("roadmaps").update({ is_published: !currentStatus }).eq("id", id); 
    fetchRoadmaps();
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!window.confirm("Permanently delete this?")) return;
    try {
      const exactFileName = fileUrl.split('roadmap_files/')[1]?.split('?')[0];
      if (exactFileName) await supabase.storage.from("roadmap_files").remove([exactFileName]);
      await supabase.from("roadmaps").delete().eq("id", id);
      fetchRoadmaps();
    } catch (err) { alert("Deletion failed."); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    let selectedFile: File | undefined = undefined;

    if ('dataTransfer' in e) {
      selectedFile = e.dataTransfer.files?.[0]; 
    } else {
      selectedFile = (e.target as HTMLInputElement).files?.[0]; 
    }
    
    if (selectedFile) { 
      setFile(selectedFile); 
      const text = await selectedFile.text(); 
      extractMetadataFromText(text); 
    } else { 
      setFile(null); 
    }
  };

  if (isCheckingAuth) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-neutral-400">Securing dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        {/* HEADER & NAV */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Curriculum Admin</h1>
            <p className="text-neutral-400 text-sm">Generate, upload, and manage your raw course files.</p>
          </div>
          <div className="flex bg-neutral-900 p-1 rounded-lg border border-neutral-800 w-fit overflow-x-auto max-w-full">
            <button onClick={() => { setActiveTab("generate"); setStatus(null); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === "generate" ? "bg-neutral-800 text-white border border-neutral-700 shadow-sm" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}`}><Wand2 size={16} /> Generate</button>
            <button onClick={() => { setActiveTab("upload"); setStatus(null); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === "upload" ? "bg-neutral-800 text-white border border-neutral-700 shadow-sm" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}`}><UploadCloud size={16} /> Publish</button>
            <button onClick={() => { setActiveTab("manage"); setStatus(null); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === "manage" ? "bg-neutral-800 text-white border border-neutral-700 shadow-sm" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}`}><LayoutDashboard size={16} /> Manage</button>
            <button onClick={() => { setActiveTab("categories"); setStatus(null); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === "categories" ? "bg-neutral-800 text-white border border-neutral-700 shadow-sm" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}`}><FolderPlus size={16} /> Categories</button>
          </div>
        </div>

        {/* CATEGORIES TAB */}
        {activeTab === "categories" && (
          <div className="bg-neutral-900 p-8 rounded-2xl shadow-lg border border-neutral-800 max-w-2xl mx-auto animate-in fade-in">
             <h2 className="text-xl font-bold mb-6 text-white">Manage Categories</h2>
             <form onSubmit={handleAddCategory} className="flex gap-3 mb-8">
                <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New Category (e.g., Physics)" className="flex-1 p-3 bg-neutral-950 border border-neutral-800 rounded-xl outline-none text-white placeholder-neutral-600 focus:border-blue-500/50" required />
                <div className="flex items-center gap-2 border border-neutral-800 rounded-xl px-4 bg-neutral-950">
                  <span className="text-sm text-neutral-500">Slot Limit:</span>
                  <input type="number" min={1} max={10} value={newCatLimit} onChange={e => setNewCatLimit(Number(e.target.value))} className="w-12 bg-transparent font-semibold text-white outline-none" />
                </div>
                <button type="submit" className="bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-neutral-200 transition-colors">Add</button>
              </form>
              
              <div className="space-y-3">
                {categories.map(cat => (
                  <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-xl gap-4">
                    {editingCategory?.id === cat.id ? (
                      <form onSubmit={handleUpdateCategory} className="flex flex-1 items-center gap-3">
                        <input type="text" value={editCatName} onChange={e => setEditCatName(e.target.value)} className="flex-1 p-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:border-blue-500/50 outline-none" required autoFocus />
                        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1">
                          <span className="text-xs text-neutral-500">Limit:</span>
                          <input type="number" min={1} max={10} value={editCatLimit} onChange={e => setEditCatLimit(Number(e.target.value))} className="w-10 bg-transparent text-white text-sm font-semibold outline-none" />
                        </div>
                        <button type="submit" className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"><Save size={16}/></button>
                        <button type="button" onClick={() => setEditingCategory(null)} className="p-2 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 hover:text-white transition-colors"><X size={16}/></button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-neutral-200">{cat.name}</span>
                          <span className="text-xs text-neutral-400 bg-neutral-800 px-2.5 py-1 rounded-md border border-neutral-700 shadow-sm">Limit: {cat.active_limit}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEditCategory(cat)} className="p-2 text-neutral-500 hover:text-blue-400 hover:bg-neutral-800 rounded-md transition-colors"><Pencil size={16} /></button>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-md transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {categories.length === 0 && <p className="text-neutral-500 text-center py-4">No categories created yet.</p>}
              </div>
              {status && <div className={`mt-6 p-4 rounded-lg text-sm text-center font-medium border ${status.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>{status.msg}</div>}
          </div>
        )}

        {/* GENERATE TAB */}
        {activeTab === "generate" && (
          <div className="bg-neutral-900 p-8 rounded-2xl shadow-lg border border-neutral-800 max-w-2xl mx-auto animate-in fade-in">
            <form onSubmit={handleGenerate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-400">Topic</label>
                <input type="text" required value={genTopic} onChange={(e) => setGenTopic(e.target.value)} disabled={isGenerating} placeholder="e.g., Quantum Physics" className="w-full p-4 text-lg bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:border-blue-500/50 outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-400">Target Audience / Skill Level</label>
                <input type="text" value={genLevel} onChange={(e) => setGenLevel(e.target.value)} disabled={isGenerating} placeholder="e.g., Absolute Beginner" className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:border-blue-500/50 outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-400">Playlist URL (Optional)</label>
                <input type="url" value={genUrl} onChange={(e) => setGenUrl(e.target.value)} disabled={isGenerating} placeholder="https://youtube.com/playlist?list=..." className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:border-blue-500/50 outline-none transition-colors" />
              </div>
              <button type="submit" disabled={isGenerating || !genTopic.trim()} className="w-full bg-blue-600 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-500 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 transition-colors">
                {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} 
                {isGenerating ? "Architecting..." : "Generate Roadmap"}
              </button>
            </form>
          </div>
        )}

        {/* UPLOAD TAB */}
        {activeTab === "upload" && (
          <div className="bg-neutral-900 p-8 rounded-2xl shadow-lg border border-neutral-800 animate-in fade-in">
            <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-white">Curriculum Details</label>
                  {isExtracting && <span className="text-xs text-blue-400 font-medium flex items-center gap-1 animate-pulse"><Sparkles size={12} /> AI Generating...</span>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Title</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={isExtracting} className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white outline-none focus:border-blue-500/50 transition-colors" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Category</label>
                    <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={categories.length === 0} className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white outline-none focus:border-blue-500/50 transition-colors">
                      {categories.length === 0 && <option value="">No categories found. Create one first!</option>}
                      {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Target Deadline (Optional)</label>
                    <input type="date" value={targetDeadline} onChange={(e) => setTargetDeadline(e.target.value)} disabled={isExtracting} style={{ colorScheme: 'dark' }} className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white outline-none focus:border-blue-500/50 transition-colors cursor-pointer" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Brief Description</label>
                  <textarea rows={4} required value={description} onChange={(e) => setDescription(e.target.value)} disabled={isExtracting} className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white outline-none resize-none focus:border-blue-500/50 transition-colors" />
                </div>
                
                {/* PRIORITY ENGINE UI */}
                <div className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider">Priority Algorithm</label>
                    <button type="button" onClick={() => handleEvaluatePriority("upload")} disabled={isEvaluating || !title} className="text-xs bg-neutral-900 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-md hover:bg-blue-500/10 transition flex items-center gap-1.5 font-medium disabled:opacity-50">
                      {isEvaluating ? <Loader2 size={12} className="animate-spin"/> : <Brain size={12}/>} Auto-Evaluate Context
                    </button>
                  </div>
                  
                  {aiReasoning && <p className="text-xs text-blue-300 bg-blue-950/50 p-3 rounded-lg border border-blue-500/20 italic">{aiReasoning}</p>}

                  <div className="space-y-3 pt-2">
                    {[ ['Urgency', u, setU], ['Importance', i, setI], ['Difficulty', d, setD] ].map(([lbl, val, setFn]: any) => (
                      <div key={lbl} className="flex items-center gap-4">
                        <span className="text-xs font-medium text-neutral-400 w-20">{lbl}</span>
                        <input type="range" min={1} max={10} value={val} onChange={e => setFn(Number(e.target.value))} disabled={isEvaluating} className="flex-1 accent-blue-500 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                        <span className="font-mono text-xs font-semibold text-blue-400 w-6 text-right">{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-blue-500/20 flex justify-between items-center">
                    <span className="text-blue-500/60 font-mono text-[10px]">P = (U×0.6) + (I×0.3) + (D×0.1)</span>
                    <span className="font-bold text-sm text-white">Score: <span className="text-blue-400 text-lg">{priorityScore}</span></span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col h-full">
                <label className="block text-sm font-bold text-white mb-2">Content Source</label>
                <div className="flex gap-2 mb-4">
                  <button type="button" onClick={() => setUploadMethod("file")} className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${uploadMethod === "file" ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"}`}><FileUp size={16} className="inline mr-2" />Upload File</button>
                  <button type="button" onClick={() => setUploadMethod("paste")} className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${uploadMethod === "paste" ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"}`}><Code size={16} className="inline mr-2" />Paste HTML</button>
                </div>
                <div className="flex-grow flex flex-col mb-6 relative">
                  {uploadMethod === "file" ? (
                    <div 
                      onDragOver={(e)=>{e.preventDefault(); setIsDragging(true);}} 
                      onDragLeave={(e)=>{e.preventDefault(); setIsDragging(false);}} 
                      onDrop={handleFileSelect} 
                      className={`flex-grow border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-colors relative ${isDragging ? 'border-blue-500 bg-blue-500/5' : 'bg-neutral-950 border-neutral-800 hover:bg-neutral-800/50'}`}
                    >
                      {file ? (
                        <div className="text-center animate-in fade-in duration-300">
                          <FileText className="mx-auto text-blue-500 mb-3" size={40} />
                          <p className="text-sm font-medium text-white truncate max-w-[200px]">{file.name}</p>
                          <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }} className="mt-3 text-xs font-semibold text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md transition-colors">Remove File</button>
                        </div>
                      ) : (
                        <>
                          <FileUp className="text-neutral-600 mb-3" size={32} />
                          <p className="text-sm font-medium text-neutral-400 mb-1">Drag & drop HTML file here</p>
                          <p className="text-xs text-neutral-600 mb-4">or click to browse</p>
                          <input type="file" accept=".html" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </>
                      )}
                    </div>
                  ) : (
                    <textarea value={pastedHtml} onChange={(e) => setPastedHtml(e.target.value)} className="flex-grow w-full p-4 bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-lg font-mono text-sm outline-none resize-none focus:border-blue-500/50 transition-colors" placeholder="Paste HTML code here..." />
                  )}
                </div>
                <button type="submit" disabled={status?.type === "loading" || !categoryId} className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 transition-colors">Publish to Wishlist</button>
              </div>
            </form>
            {status && <div className={`mt-6 p-4 rounded-lg text-sm text-center font-medium border ${status.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{status.msg}</div>}
          </div>
        )}

        {/* MANAGE TAB */}
        {activeTab === "manage" && (
          <div className="bg-neutral-900 rounded-2xl shadow-lg border border-neutral-800 overflow-hidden animate-in fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-950 text-neutral-500 border-b border-neutral-800 uppercase tracking-wider text-xs">
                  <tr><th className="px-6 py-5 font-medium">Curriculum Details</th><th className="px-6 py-5 font-medium text-center">Visibility</th><th className="px-6 py-5 font-medium text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {roadmaps.map((rm) => (
                    <tr key={rm.id} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white flex items-center gap-2">
                          {rm.title}
                          <span className="text-[10px] font-mono font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">P:{rm.priority_score}</span>
                        </div>
                        <div className="text-neutral-500 text-xs mt-1">{categories.find(c => c.id === rm.category_id)?.name || 'Uncategorized'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => togglePublish(rm.id, rm.is_published)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${rm.is_published ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20" : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700"}`}>
                          {rm.is_published ? <><Eye size={14} /> Published</> : <><EyeOff size={14} /> Draft</>}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { 
                            setEditingRoadmap(rm); 
                            setEditUploadMethod("keep");
                            setEditTargetDeadline(rm.target_deadline || ""); 
                            setEditU(rm.urgency || 5); setEditI(rm.importance || 5); setEditD(rm.difficulty || 5);
                            setEditAiReasoning("");
                          }} className="text-neutral-500 hover:text-blue-400 hover:bg-neutral-800 p-2 rounded-lg transition-colors"><Pencil size={16} /></button>
                          <button onClick={() => handleDelete(rm.id, rm.file_url)} className="text-neutral-500 hover:text-red-400 hover:bg-neutral-800 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EDIT MODAL OVERLAY */}
        {editingRoadmap && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Pencil size={18} className="text-blue-500" /> Edit Roadmap</h2>
                <button onClick={() => setEditingRoadmap(null)} className="text-neutral-500 hover:text-white p-1 transition-colors"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto flex-grow space-y-5 text-sm">
                <div>
                  <label className="block font-medium text-neutral-400 mb-1">Title</label>
                  <input type="text" required value={editingRoadmap.title} onChange={(e) => setEditingRoadmap({...editingRoadmap, title: e.target.value})} className="w-full p-2 bg-neutral-950 border border-neutral-800 text-white rounded-lg focus:border-blue-500/50 outline-none transition-colors" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-neutral-400 mb-1">Category</label>
                    <select required value={editingRoadmap.category_id} onChange={(e) => setEditingRoadmap({...editingRoadmap, category_id: e.target.value})} className="w-full p-2 bg-neutral-950 border border-neutral-800 text-white rounded-lg focus:border-blue-500/50 outline-none transition-colors">
                      {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-neutral-400 mb-1">Target Deadline</label>
                    <input type="date" value={editTargetDeadline} onChange={(e) => setEditTargetDeadline(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full p-2 bg-neutral-950 border border-neutral-800 text-white rounded-lg focus:border-blue-500/50 outline-none transition-colors cursor-pointer" />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-neutral-400 mb-1">Description</label>
                  <textarea rows={3} required value={editingRoadmap.description} onChange={(e) => setEditingRoadmap({...editingRoadmap, description: e.target.value})} className="w-full p-2 bg-neutral-950 border border-neutral-800 text-white rounded-lg focus:border-blue-500/50 outline-none transition-colors" />
                </div>

                {/* EDIT MODAL PRIORITY ENGINE */}
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider">Priority Algorithm</label>
                    <button type="button" onClick={() => handleEvaluatePriority("edit")} disabled={isEvaluating} className="text-xs bg-neutral-900 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-md hover:bg-blue-500/10 transition flex items-center gap-1.5 font-medium disabled:opacity-50">
                      {isEvaluating ? <Loader2 size={12} className="animate-spin"/> : <Brain size={12}/>} Auto-Evaluate Context
                    </button>
                  </div>
                  {editAiReasoning && <p className="text-xs text-blue-300 bg-blue-950/50 p-3 rounded-lg border border-blue-500/20 italic">{editAiReasoning}</p>}
                  <div className="space-y-2 pt-2">
                    {[ ['Urgency', editU, setEditU], ['Importance', editI, setEditI], ['Difficulty', editD, setEditD] ].map(([lbl, val, setFn]: any) => (
                      <div key={lbl} className="flex items-center gap-4">
                        <span className="text-xs font-medium text-neutral-400 w-20">{lbl}</span>
                        <input type="range" min={1} max={10} value={val} onChange={e => setFn(Number(e.target.value))} disabled={isEvaluating} className="flex-1 accent-blue-500 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                        <span className="font-mono text-xs font-semibold text-blue-400 w-6 text-right">{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 flex justify-end font-bold text-sm text-white">
                    Score: <span className="text-blue-400 ml-2">{editPriorityScore}</span>
                  </div>
                </div>

                <div className="p-4 border border-neutral-800 rounded-xl bg-neutral-950 space-y-3">
                  <label className="block font-medium text-white">Update Content Source</label>
                  <select value={editUploadMethod} onChange={(e: any) => setEditUploadMethod(e.target.value)} className="w-full p-2 bg-neutral-900 border border-neutral-700 text-white rounded-lg outline-none focus:border-blue-500/50">
                    <option value="keep">Keep existing HTML file</option>
                    <option value="file">Upload a new file</option>
                    <option value="paste">Paste new HTML code</option>
                  </select>

                  {editUploadMethod === "file" && (
                     <input type="file" accept=".html" onChange={handleFileSelect} className="w-full p-2 bg-neutral-900 border border-neutral-700 text-neutral-300 rounded-lg file:mr-3 file:rounded-md file:border-0 file:bg-blue-500/10 file:border file:border-blue-500/20 file:text-blue-400 file:px-3 file:py-1.5 file:font-medium text-sm" />
                  )}
                  {editUploadMethod === "paste" && (
                     <textarea rows={4} value={editPastedHtml} onChange={(e) => setEditPastedHtml(e.target.value)} className="w-full p-2 bg-neutral-900 border border-neutral-700 text-neutral-300 rounded-lg font-mono text-xs outline-none focus:border-blue-500/50" placeholder="Paste updated HTML here..." />
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingRoadmap(null)} className="px-5 py-2 rounded-lg font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">Cancel</button>
                  <button type="submit" disabled={status?.type === "loading"} className="px-5 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500">
                    {status?.type === "loading" ? "Saving..." : "Save Changes"}
                  </button>
                </div>
                
                {status && (
                  <div className={`mt-2 text-center font-medium ${status.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{status.msg}</div>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}