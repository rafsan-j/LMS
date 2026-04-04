"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Trash2, Eye, EyeOff, FileText, UploadCloud, 
  LayoutDashboard, Code, FileUp, Pencil, X, Sparkles, Wand2, Loader2
} from "lucide-react";

type Roadmap = {
  id: string;
  title: string;
  category: string;
  description: string;
  file_url: string;
  is_published: boolean;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<"upload" | "manage" | "generate">("upload");
  const [uploadMethod, setUploadMethod] = useState<"file" | "paste">("file");
  
  // Data State
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  
  // Upload Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pastedHtml, setPastedHtml] = useState("");
  const [status, setStatus] = useState<{ type: "error" | "success" | "loading", msg: string } | null>(null);
  
  // Generator State
  const [genTopic, setGenTopic] = useState("");
  const [genLevel, setGenLevel] = useState("");
  const [genUrl, setGenUrl] = useState(""); // NEW: Playlist URL State
  const [isGenerating, setIsGenerating] = useState(false);

  // AI & Drag State
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Edit Modal State
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPastedHtml, setEditPastedHtml] = useState("");
  const [editUploadMethod, setEditUploadMethod] = useState<"keep" | "file" | "paste">("keep");

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const checkSessionAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
        return;
      }
      setIsCheckingAuth(false);
      fetchRoadmaps();
    };
    checkSessionAndFetchData();
  }, [router]);

  const fetchRoadmaps = async () => {
    const { data } = await supabase.from("roadmaps").select("*").order("created_at", { ascending: false });
    if (data) setRoadmaps(data);
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

  // --- Reusable AI Extraction Logic ---
  const extractMetadataFromText = async (text: string) => {
    if (!text.trim()) return;
    setIsExtracting(true);
    setStatus({ type: "loading", msg: "AI is analyzing your roadmap metadata..." });

    try {
      const response = await fetch('/api/extract-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: text })
      });

      if (!response.ok) throw new Error("AI extraction failed.");

      const data = await response.json();
      setTitle(data.title || "");
      setCategory(data.category || "");
      setDescription(data.description || "");
      setStatus({ type: "success", msg: "AI successfully auto-filled the details!" });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", msg: "AI failed to read content. Please enter details manually." });
    } finally {
      setIsExtracting(false);
    }
  };

  // --- NEW: Curriculum Generator Logic ---
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTopic.trim()) return;

    setIsGenerating(true);
    setStatus({ type: "loading", msg: "AI is architecting the V3 curriculum. This takes 10-20 seconds..." });

    try {
      const response = await fetch('/api/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: genTopic, 
          level: genLevel,
          playlistUrl: genUrl // NEW: Sending the URL
        })
      });

      if (!response.ok) throw new Error("Failed to generate roadmap.");

      const data = await response.json();
      
      // Magic flow: Set the HTML, switch to the Paste tab, and run metadata extraction!
      setPastedHtml(data.html);
      setUploadMethod("paste");
      setActiveTab("upload");
      setGenTopic("");
      setGenLevel("");
      
      // We purposefully do not await this so it happens seamlessly in the background
      extractMetadataFromText(data.html);

    } catch (error: any) {
      setStatus({ type: "error", msg: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) { setFile(droppedFile); const text = await droppedFile.text(); extractMetadataFromText(text); }
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) { setFile(selectedFile); const text = await selectedFile.text(); extractMetadataFromText(text); } 
    else { setFile(null); }
  };

  // --- Upload Logic ---
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Processing upload..." });

    try {
      let finalFile = file;
      if (uploadMethod === "paste") {
        if (!pastedHtml.trim()) throw new Error("Please paste your HTML code.");
        finalFile = createHtmlFileFromText(pastedHtml, "pasted-roadmap.html");
      }
      if (!finalFile) throw new Error("Please select or paste an HTML file.");

      const publicUrl = await uploadFileToStorage(finalFile);
      const { error: dbError } = await supabase.from("roadmaps").insert([{ title, description, category, file_url: publicUrl, is_published: true }]);
      if (dbError) throw dbError;

      setStatus({ type: "success", msg: "Roadmap successfully published!" });
      setTitle(""); setDescription(""); setCategory(""); setFile(null); setPastedHtml("");
      fetchRoadmaps();
      
      // Send user to manage tab to see their new upload
      setActiveTab("manage");
      
    } catch (error: any) {
      setStatus({ type: "error", msg: error.message });
    }
  };

  // --- Edit Logic ---
  const openEditModal = (roadmap: Roadmap) => {
    setEditingRoadmap(roadmap); setEditUploadMethod("keep"); setEditFile(null); setEditPastedHtml(""); setStatus(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoadmap) return;
    setStatus({ type: "loading", msg: "Saving changes..." });

    try {
      let updatedFileUrl = editingRoadmap.file_url;
      if (editUploadMethod !== "keep") {
        let newFile = editFile;
        if (editUploadMethod === "paste") {
          if (!editPastedHtml.trim()) throw new Error("Please paste your updated HTML code.");
          newFile = createHtmlFileFromText(editPastedHtml, "updated-roadmap.html");
        }
        if (!newFile) throw new Error("Please provide the new HTML file.");
        updatedFileUrl = await uploadFileToStorage(newFile);
      }
      const { error } = await supabase.from("roadmaps").update({ title: editingRoadmap.title, category: editingRoadmap.category, description: editingRoadmap.description, file_url: updatedFileUrl }).eq("id", editingRoadmap.id);
      if (error) throw error;
      setStatus({ type: "success", msg: "Roadmap updated successfully!" });
      setEditingRoadmap(null); fetchRoadmaps();
    } catch (error: any) {
      setStatus({ type: "error", msg: error.message });
    }
  };

  // --- Delete & Toggle Logic ---
  const togglePublish = async (id: string, currentStatus: boolean) => {
    await supabase.from("roadmaps").update({ is_published: !currentStatus }).eq("id", id); fetchRoadmaps();
  };

// --- Delete Logic ---
  const handleDelete = async (id: string, fileUrl: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this roadmap?")) return;

    try {
      // 1. Safely extract the exact filename, ignoring domain paths and query strings
      // This splits at your bucket name and grabs everything after it, trimming any '?t=' tags
      const exactFileName = fileUrl.split('roadmap_files/')[1]?.split('?')[0];

      if (exactFileName) {
        // 2. Delete from the Storage Bucket FIRST
        const { error: storageError } = await supabase.storage
          .from("roadmap_files")
          .remove([exactFileName]);
          
        if (storageError) {
          console.error("Storage Deletion Error:", storageError.message);
          alert(`Database row deleted, but file remained in storage: ${storageError.message}`);
        }
      }

      // 3. Delete from the Database
      const { error: dbError } = await supabase.from("roadmaps").delete().eq("id", id);
      if (dbError) throw dbError;

      // 4. Refresh the UI table
      fetchRoadmaps();
      
    } catch (error: any) {
      console.error("Complete Deletion Failed:", error);
      alert("Failed to delete roadmap completely.");
    }
  };

  if (isCheckingAuth) return <div className="min-h-screen flex items-center justify-center font-sans text-neutral-500">Securing dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-8 text-neutral-900 font-sans selection:bg-blue-100 relative">
      <div className="max-w-5xl mx-auto">
        
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight mb-1">Control Center</h1>
            <p className="text-neutral-500 text-sm">Manage your study curriculum</p>
          </div>
          <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 w-fit">
            <button onClick={() => { setActiveTab("generate"); setStatus(null); }} className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "generate" ? "bg-white shadow-sm text-blue-700" : "text-neutral-500 hover:text-neutral-700"}`}>
              <Wand2 size={16} /> Generate
            </button>
            <button onClick={() => { setActiveTab("upload"); setStatus(null); }} className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "upload" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
              <UploadCloud size={16} /> Publish
            </button>
            <button onClick={() => { setActiveTab("manage"); setStatus(null); }} className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "manage" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
              <LayoutDashboard size={16} /> Manage
            </button>
          </div>
        </div>

        {/* --- TAB 0: GENERATE --- */}
        {activeTab === "generate" && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 max-w-2xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
            <div className="mb-8 text-center">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Wand2 size={24} />
              </div>
              <h2 className="text-2xl font-medium text-neutral-900 mb-2">Curriculum Architect</h2>
              <p className="text-neutral-500 text-sm">Let AI build a comprehensive, 6-phase interactive roadmap for any topic.</p>
            </div>

            <form onSubmit={handleGenerate} className="space-y-5 relative z-10">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">What do you want to learn?</label>
                <input type="text" required value={genTopic} onChange={(e) => setGenTopic(e.target.value)} disabled={isGenerating} className="w-full p-4 text-lg border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors" placeholder="e.g., Quantum Physics, React.js, Macroeconomics" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Target Audience / Skill Level</label>
                <input type="text" value={genLevel} onChange={(e) => setGenLevel(e.target.value)} disabled={isGenerating} className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors" placeholder="e.g., Absolute Beginner, College Sophomore, Advanced" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">YouTube Playlist URL (Optional)</label>
                <input type="url" value={genUrl} onChange={(e) => setGenUrl(e.target.value)} disabled={isGenerating} className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors" placeholder="https://youtube.com/playlist?list=..." />
                <p className="text-xs text-neutral-500 mt-1">Leave blank to let AI pick the best industry-standard curriculum.</p>
              </div>
              <button type="submit" disabled={isGenerating || !genTopic.trim()} className="w-full bg-blue-600 text-white font-medium py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-4 shadow-sm shadow-blue-600/20">
                {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Architecting...</> : <><Sparkles size={18} /> Generate Roadmap</>}
              </button>
            </form>
          </div>
        )}

        {/* --- TAB 1: UPLOAD --- */}
        {activeTab === "upload" && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200">
            <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              <div className="space-y-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-neutral-700">Curriculum Details</label>
                  {isExtracting && <span className="text-xs text-blue-600 font-medium flex items-center gap-1 animate-pulse"><Sparkles size={12} /> AI Generating...</span>}
                </div>
                <div><label className="block text-xs font-medium text-neutral-500 mb-1">Roadmap Title</label><input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={isExtracting || isGenerating} className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors" placeholder="e.g., Advanced Calculus" /></div>
                <div><label className="block text-xs font-medium text-neutral-500 mb-1">Category</label><input type="text" required value={category} onChange={(e) => setCategory(e.target.value)} disabled={isExtracting || isGenerating} className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors" placeholder="e.g., Mathematics" /></div>
                <div><label className="block text-xs font-medium text-neutral-500 mb-1">Brief Description</label><textarea rows={4} required value={description} onChange={(e) => setDescription(e.target.value)} disabled={isExtracting || isGenerating} className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors resize-none" placeholder="What will the student learn?" /></div>
              </div>

              <div className="flex flex-col h-full">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Content Source</label>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button type="button" onClick={() => setUploadMethod("file")} className={`py-3 flex items-center justify-center gap-2 border rounded-lg text-sm font-medium transition-colors ${uploadMethod === "file" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>
                    <FileUp size={16} /> Upload File
                  </button>
                  <button type="button" onClick={() => setUploadMethod("paste")} className={`py-3 flex items-center justify-center gap-2 border rounded-lg text-sm font-medium transition-colors ${uploadMethod === "paste" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>
                    <Code size={16} /> Paste HTML
                  </button>
                </div>

                <div className="flex-grow flex flex-col mb-6 relative">
                  {uploadMethod === "file" ? (
                    <div 
                      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      className={`flex-grow border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-all duration-200 ${isDragging ? 'border-blue-500 bg-blue-50' : isExtracting ? 'border-blue-300 bg-blue-50/50' : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100'}`}
                    >
                       <FileUp className={`${isExtracting || isDragging ? 'text-blue-500 animate-bounce' : 'text-neutral-400'} mb-3`} size={32} />
                       <p className="text-sm font-medium text-neutral-700 mb-1">{isDragging ? 'Drop file here' : 'Drag & drop HTML file here'}</p>
                       <p className="text-xs text-neutral-500 mb-4">or</p>
                       <input type="file" accept=".html" disabled={isExtracting} onChange={handleFileSelect} className="text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-white file:border file:border-neutral-200 file:text-neutral-700 hover:file:bg-neutral-50 cursor-pointer disabled:opacity-50" />
                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col relative">
                      <textarea value={pastedHtml} onChange={(e) => setPastedHtml(e.target.value)} className="flex-grow w-full p-4 border border-neutral-300 rounded-lg font-mono text-sm bg-neutral-50 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none pb-12" placeholder="" />
                      <button type="button" onClick={() => extractMetadataFromText(pastedHtml)} disabled={isExtracting || !pastedHtml.trim()} className="absolute bottom-4 right-4 bg-white border border-neutral-200 shadow-sm text-neutral-700 hover:bg-neutral-50 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50">
                        <Sparkles size={14} className="text-blue-600" /> Auto-Fill Details
                      </button>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={status?.type === "loading" || isExtracting || isGenerating} className="w-full bg-neutral-900 text-white font-medium py-3 rounded-lg hover:bg-neutral-800 transition disabled:opacity-50">
                  {status?.type === "loading" ? "Publishing..." : isExtracting ? "Analyzing..." : "Publish Roadmap"}
                </button>
              </div>
            </form>

            {status && <div className={`mt-6 p-4 rounded-lg text-sm font-medium flex items-center justify-center ${status.type === 'error' ? 'bg-red-50 text-red-700' : status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{status.msg}</div>}
          </div>
        )}

        {/* --- TAB 2: MANAGE --- */}
        {activeTab === "manage" && (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-100 uppercase tracking-wider text-xs">
                  <tr><th className="px-6 py-5 font-medium">Curriculum Details</th><th className="px-6 py-5 font-medium text-center">Visibility</th><th className="px-6 py-5 font-medium text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {roadmaps.map((roadmap) => (
                    <tr key={roadmap.id} className="hover:bg-neutral-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-neutral-900 text-base mb-1">{roadmap.title}</div>
                        <div className="flex items-center gap-2 text-neutral-500 text-xs"><span className="bg-neutral-100 px-2 py-0.5 rounded-md">{roadmap.category}</span></div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => togglePublish(roadmap.id, roadmap.is_published)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${roadmap.is_published ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                          {roadmap.is_published ? <><Eye size={14} /> Published</> : <><EyeOff size={14} /> Draft</>}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEditModal(roadmap)} className="text-neutral-400 hover:text-blue-600 p-2 rounded-md hover:bg-blue-50 transition-colors"><Pencil size={16} /></button>
                          <button onClick={() => handleDelete(roadmap.id, roadmap.file_url)} className="text-neutral-400 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {roadmaps.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-neutral-400">
                        <FileText className="mx-auto mb-3 opacity-20" size={48} />
                        Your library is empty.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* --- EDIT MODAL OVERLAY --- */}
      {editingRoadmap && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
              <h2 className="text-lg font-medium text-neutral-900 flex items-center gap-2"><Pencil size={18} /> Edit Roadmap</h2>
              <button onClick={() => setEditingRoadmap(null)} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto flex-grow space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Title</label>
                  <input type="text" required value={editingRoadmap.title} onChange={(e) => setEditingRoadmap({...editingRoadmap, title: e.target.value})} className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Category</label>
                  <input type="text" required value={editingRoadmap.category} onChange={(e) => setEditingRoadmap({...editingRoadmap, category: e.target.value})} className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block font-medium text-neutral-700 mb-1">Description</label>
                <textarea rows={3} required value={editingRoadmap.description} onChange={(e) => setEditingRoadmap({...editingRoadmap, description: e.target.value})} className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="p-4 border border-neutral-200 rounded-xl bg-neutral-50 space-y-3">
                <label className="block font-medium text-neutral-900">Update Content Source</label>
                <select value={editUploadMethod} onChange={(e: any) => setEditUploadMethod(e.target.value)} className="w-full p-2 border border-neutral-300 rounded-lg bg-white">
                  <option value="keep">Keep existing HTML file</option>
                  <option value="file">Upload a new file</option>
                  <option value="paste">Paste new HTML code</option>
                </select>

                {editUploadMethod === "file" && (
                   <input type="file" accept=".html" onChange={(e) => setEditFile(e.target.files?.[0] || null)} className="w-full p-2 border border-neutral-300 rounded-lg bg-white file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 file:px-3 file:py-1 text-sm" />
                )}
                {editUploadMethod === "paste" && (
                   <textarea rows={4} value={editPastedHtml} onChange={(e) => setEditPastedHtml(e.target.value)} className="w-full p-2 border border-neutral-300 rounded-lg font-mono text-xs bg-white" placeholder="Paste updated HTML here..." />
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingRoadmap(null)} className="px-5 py-2 rounded-lg font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">Cancel</button>
                <button type="submit" disabled={status?.type === "loading"} className="px-5 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {status?.type === "loading" ? "Saving..." : "Save Changes"}
                </button>
              </div>
              
              {status && (
                <div className={`mt-2 text-center font-medium ${status.type === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                  {status.msg}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}