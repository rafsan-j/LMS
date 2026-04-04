"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Trash2, Eye, EyeOff, FileText, UploadCloud, 
  LayoutDashboard, Code, FileUp, Pencil, X, Sparkles
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
  const [activeTab, setActiveTab] = useState<"upload" | "manage">("upload");
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

  // --- NEW: Reusable AI Extraction Logic ---
  const extractMetadataFromText = async (text: string) => {
    if (!text.trim()) return;
    setIsExtracting(true);
    setStatus({ type: "loading", msg: "AI is analyzing your roadmap..." });

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

  // --- NEW: Drag and Drop Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      const text = await droppedFile.text();
      extractMetadataFromText(text); // Trigger AI on Drop
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const text = await selectedFile.text();
      extractMetadataFromText(text); // Trigger AI on Browse
    } else {
      setFile(null);
    }
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

      const { error: dbError } = await supabase
        .from("roadmaps")
        .insert([{ title, description, category, file_url: publicUrl, is_published: true }]);
      
      if (dbError) throw dbError;

      setStatus({ type: "success", msg: "Roadmap successfully published!" });
      setTitle(""); setDescription(""); setCategory(""); setFile(null); setPastedHtml("");
      fetchRoadmaps();
    } catch (error: any) {
      setStatus({ type: "error", msg: error.message });
    }
  };

  // --- Edit Logic (Same as before) ---
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

  // --- Delete & Toggle Logic (Same as before) ---
  const togglePublish = async (id: string, currentStatus: boolean) => {
    await supabase.from("roadmaps").update({ is_published: !currentStatus }).eq("id", id); fetchRoadmaps();
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this roadmap?")) return;
    const fileName = fileUrl.split('/').pop();
    if (fileName) await supabase.storage.from("roadmap_files").remove([fileName]);
    await supabase.from("roadmaps").delete().eq("id", id); fetchRoadmaps();
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
            <button onClick={() => { setActiveTab("upload"); setStatus(null); }} className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "upload" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
              <UploadCloud size={16} /> Publish
            </button>
            <button onClick={() => { setActiveTab("manage"); setStatus(null); }} className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "manage" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
              <LayoutDashboard size={16} /> Manage
            </button>
          </div>
        </div>

        {/* --- TAB 1: UPLOAD --- */}
        {activeTab === "upload" && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200">
            <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* Left Column: Metadata */}
              <div className="space-y-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-neutral-700">Curriculum Details</label>
                  {isExtracting && <span className="text-xs text-blue-600 font-medium flex items-center gap-1 animate-pulse"><Sparkles size={12} /> AI Generating...</span>}
                </div>
                <div><label className="block text-xs font-medium text-neutral-500 mb-1">Roadmap Title</label><input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={isExtracting} className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors" placeholder="e.g., Advanced Calculus" /></div>
                <div><label className="block text-xs font-medium text-neutral-500 mb-1">Category</label><input type="text" required value={category} onChange={(e) => setCategory(e.target.value)} disabled={isExtracting} className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors" placeholder="e.g., Mathematics" /></div>
                <div><label className="block text-xs font-medium text-neutral-500 mb-1">Brief Description</label><textarea rows={4} required value={description} onChange={(e) => setDescription(e.target.value)} disabled={isExtracting} className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 transition-colors resize-none" placeholder="What will the student learn?" /></div>
              </div>

              {/* Right Column: File Source */}
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
                    // NEW: Drag and Drop Area
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`flex-grow border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-all duration-200 ${
                        isDragging ? 'border-blue-500 bg-blue-50' : 
                        isExtracting ? 'border-blue-300 bg-blue-50/50' : 
                        'border-neutral-300 bg-neutral-50 hover:bg-neutral-100'
                      }`}
                    >
                       <FileUp className={`${isExtracting || isDragging ? 'text-blue-500 animate-bounce' : 'text-neutral-400'} mb-3`} size={32} />
                       <p className="text-sm font-medium text-neutral-700 mb-1">{isDragging ? 'Drop file here' : 'Drag & drop HTML file here'}</p>
                       <p className="text-xs text-neutral-500 mb-4">or</p>
                       <input type="file" accept=".html" disabled={isExtracting} onChange={handleFileSelect} className="text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-white file:border file:border-neutral-200 file:text-neutral-700 hover:file:bg-neutral-50 cursor-pointer disabled:opacity-50" />
                    </div>
                  ) : (
                    // NEW: Paste Area with Floating AI Button
                    <div className="flex-grow flex flex-col relative">
                      <textarea 
                        value={pastedHtml} 
                        onChange={(e) => setPastedHtml(e.target.value)} 
                        className="flex-grow w-full p-4 border border-neutral-300 rounded-lg font-mono text-sm bg-neutral-50 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none pb-12" 
                        placeholder="" 
                      />
                      <button 
                        type="button" 
                        onClick={() => extractMetadataFromText(pastedHtml)}
                        disabled={isExtracting || !pastedHtml.trim()}
                        className="absolute bottom-4 right-4 bg-white border border-neutral-200 shadow-sm text-neutral-700 hover:bg-neutral-50 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Sparkles size={14} className="text-blue-600" /> Auto-Fill Details
                      </button>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={status?.type === "loading" || isExtracting} className="w-full bg-neutral-900 text-white font-medium py-3 rounded-lg hover:bg-neutral-800 transition disabled:opacity-50">
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
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* Edit Modal code remains exactly the same, omitted here to save space but keep it in your file if you copy over section by section, or I can provide the full file if needed! */}
    </div>
  );
}