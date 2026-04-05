"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Trash2, Eye, EyeOff, UploadCloud, LayoutDashboard, 
  Code, FileUp, Pencil, X, Sparkles, Wand2, Loader2, FolderPlus, Save 
} from "lucide-react";

type Category = { id: string; name: string; active_limit: number };
type Roadmap = { 
  id: string; title: string; category_id: string; description: string; 
  file_url: string; is_published: boolean; target_deadline: string | null; 
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
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
  const [editTargetDeadline, setEditTargetDeadline] = useState("");

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

  useEffect(() => {
    const checkSessionAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
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

  // --- Category Handlers ---
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
      const { error } = await supabase
        .from("focus_categories")
        .update({ name: editCatName, active_limit: editCatLimit })
        .eq("id", editingCategory.id);
      if (error) throw error;
      setStatus({ type: "success", msg: "Category updated!" });
      setEditingCategory(null);
      fetchInitialData();
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Delete this category? (Will fail if courses are attached)")) return;
    try {
      const { error } = await supabase.from("focus_categories").delete().eq("id", id);
      if (error) {
        // Handle Foreign Key violation gracefully
        if (error.code === '23503') throw new Error("Cannot delete: You must delete or reassign all courses in this category first.");
        throw error;
      }
      setStatus({ type: "success", msg: "Category deleted!" });
      fetchInitialData();
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatLimit(cat.active_limit);
    setStatus(null);
  };

  // --- Upload & Gen Handlers ---
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
    } finally {
      setIsExtracting(false);
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
        title, 
        description, 
        category_id: categoryId, 
        file_url: publicUrl, 
        is_published: true, 
        status: 'wishlist', 
        priority_score: 5.0,
        target_deadline: targetDeadline || null // ADDED: Save deadline to DB
      }]);
      if (dbError) throw dbError;

      setStatus({ type: "success", msg: "Published to Wishlist!" });
      setTitle(""); setDescription(""); setFile(null); setPastedHtml(""); setTargetDeadline("");
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
        title: editingRoadmap.title, 
        category_id: editingRoadmap.category_id, 
        description: editingRoadmap.description, 
        file_url: updatedFileUrl,
        target_deadline: editTargetDeadline || null // ADDED: Save updated deadline to DB
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) { setFile(droppedFile); const text = await droppedFile.text(); extractMetadataFromText(text); }
  };

  if (isCheckingAuth) return <div className="min-h-screen flex items-center justify-center text-neutral-500">Securing dashboard...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* HEADER & NAV */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight mb-1">Curriculum Admin</h1>
          <p className="text-neutral-500 text-sm">Generate, upload, and manage your raw course files.</p>
        </div>
        <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 w-fit overflow-x-auto max-w-full">
          <button onClick={() => { setActiveTab("generate"); setStatus(null); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === "generate" ? "bg-white shadow-sm text-blue-700" : "text-neutral-500 hover:text-neutral-700"}`}><Wand2 size={16} /> Generate</button>
          <button onClick={() => { setActiveTab("upload"); setStatus(null); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === "upload" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}><UploadCloud size={16} /> Publish</button>
          <button onClick={() => { setActiveTab("manage"); setStatus(null); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === "manage" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}><LayoutDashboard size={16} /> Manage</button>
          <button onClick={() => { setActiveTab("categories"); setStatus(null); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === "categories" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}><FolderPlus size={16} /> Categories</button>
        </div>
      </div>

      {/* CATEGORIES TAB */}
      {activeTab === "categories" && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 max-w-2xl mx-auto">
           <h2 className="text-xl font-bold mb-6">Manage Categories</h2>
           <form onSubmit={handleAddCategory} className="flex gap-3 mb-8">
              <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New Category (e.g., Physics)" className="flex-1 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required />
              <div className="flex items-center gap-2 border rounded-xl px-4 bg-neutral-50">
                <span className="text-sm text-neutral-500">Slot Limit:</span>
                <input type="number" min={1} max={10} value={newCatLimit} onChange={e => setNewCatLimit(Number(e.target.value))} className="w-12 bg-transparent font-semibold outline-none" />
              </div>
              <button type="submit" className="bg-neutral-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-neutral-800">Add</button>
            </form>
            
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-50 border border-neutral-100 rounded-xl gap-4">
                  {editingCategory?.id === cat.id ? (
                    <form onSubmit={handleUpdateCategory} className="flex flex-1 items-center gap-3">
                      <input type="text" value={editCatName} onChange={e => setEditCatName(e.target.value)} className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required autoFocus />
                      <div className="flex items-center gap-2 bg-white border rounded-lg px-2 py-1">
                        <span className="text-xs text-neutral-500">Limit:</span>
                        <input type="number" min={1} max={10} value={editCatLimit} onChange={e => setEditCatLimit(Number(e.target.value))} className="w-10 bg-transparent text-sm font-semibold outline-none" />
                      </div>
                      <button type="submit" className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Save size={16}/></button>
                      <button type="button" onClick={() => setEditingCategory(null)} className="p-2 bg-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-300"><X size={16}/></button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-neutral-900">{cat.name}</span>
                        <span className="text-xs text-neutral-500 bg-white px-2.5 py-1 rounded-md border shadow-sm">Limit: {cat.active_limit}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEditCategory(cat)} className="p-2 text-neutral-400 hover:text-blue-600 rounded-md transition-colors"><Pencil size={16} /></button>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-neutral-400 hover:text-red-600 rounded-md transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {categories.length === 0 && <p className="text-neutral-400 text-center py-4">No categories created yet.</p>}
            </div>
            {status && <div className={`mt-6 p-4 rounded-lg text-sm text-center font-medium ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{status.msg}</div>}
        </div>
      )}

      {/* GENERATE TAB */}
      {activeTab === "generate" && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 max-w-2xl mx-auto">
          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-700">Topic</label>
              <input type="text" required value={genTopic} onChange={(e) => setGenTopic(e.target.value)} disabled={isGenerating} placeholder="e.g., Quantum Physics" className="w-full p-4 text-lg border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-700">Target Audience / Skill Level</label>
              <input type="text" value={genLevel} onChange={(e) => setGenLevel(e.target.value)} disabled={isGenerating} placeholder="e.g., Absolute Beginner" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-700">Playlist URL (Optional)</label>
              <input type="url" value={genUrl} onChange={(e) => setGenUrl(e.target.value)} disabled={isGenerating} placeholder="https://youtube.com/playlist?list=..." className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <button type="submit" disabled={isGenerating || !genTopic.trim()} className="w-full bg-blue-600 text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50">
              {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} 
              {isGenerating ? "Architecting..." : "Generate Roadmap"}
            </button>
          </form>
        </div>
      )}

      {/* UPLOAD TAB */}
      {activeTab === "upload" && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200">
          <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-5">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-neutral-700">Curriculum Details</label>
                {isExtracting && <span className="text-xs text-blue-600 font-medium flex items-center gap-1 animate-pulse"><Sparkles size={12} /> AI Generating...</span>}
              </div>
              <div><label className="block text-xs font-medium text-neutral-500 mb-1">Title</label><input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={isExtracting} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              
              {/* UPDATED: Category and Deadline Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Category</label>
                  <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={categories.length === 0} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    {categories.length === 0 && <option value="">No categories found. Create one first!</option>}
                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Target Deadline (Optional)</label>
                  <input type="date" value={targetDeadline} onChange={(e) => setTargetDeadline(e.target.value)} disabled={isExtracting} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-neutral-700" />
                </div>
              </div>

              <div><label className="block text-xs font-medium text-neutral-500 mb-1">Brief Description</label><textarea rows={4} required value={description} onChange={(e) => setDescription(e.target.value)} disabled={isExtracting} className="w-full p-3 border rounded-lg outline-none resize-none focus:ring-2 focus:ring-blue-500" /></div>
            </div>
            
            <div className="flex flex-col h-full">
              <label className="block text-sm font-medium text-neutral-700 mb-2">Content Source</label>
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={() => setUploadMethod("file")} className={`flex-1 py-2 text-sm font-medium rounded-lg border ${uploadMethod === "file" ? "border-blue-600 bg-blue-50 text-blue-700" : "text-neutral-600"}`}><FileUp size={16} className="inline mr-2" />Upload File</button>
                <button type="button" onClick={() => setUploadMethod("paste")} className={`flex-1 py-2 text-sm font-medium rounded-lg border ${uploadMethod === "paste" ? "border-blue-600 bg-blue-50 text-blue-700" : "text-neutral-600"}`}><Code size={16} className="inline mr-2" />Paste HTML</button>
              </div>
              <div className="flex-grow flex flex-col mb-6 relative">
                {uploadMethod === "file" ? (
                  <div onDragOver={(e)=>{e.preventDefault(); setIsDragging(true);}} onDragLeave={(e)=>{e.preventDefault(); setIsDragging(false);}} onDrop={handleDrop} className={`flex-grow border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'bg-neutral-50 hover:bg-neutral-100'}`}>
                    <input type="file" accept=".html" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-white file:border file:border-neutral-200 cursor-pointer" />
                  </div>
                ) : (
                  <textarea value={pastedHtml} onChange={(e) => setPastedHtml(e.target.value)} className="flex-grow w-full p-4 border rounded-lg font-mono text-sm bg-neutral-50 outline-none resize-none focus:ring-2 focus:ring-blue-500" placeholder="Paste HTML code here..." />
                )}
              </div>
              <button type="submit" disabled={status?.type === "loading" || !categoryId} className="w-full bg-neutral-900 text-white font-medium py-3 rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors">Publish to Wishlist</button>
            </div>
          </form>
          {status && <div className={`mt-6 p-4 rounded-lg text-sm text-center font-medium ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{status.msg}</div>}
        </div>
      )}

      {/* MANAGE TAB */}
      {activeTab === "manage" && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-100 uppercase tracking-wider text-xs">
                <tr><th className="px-6 py-5 font-medium">Curriculum Details</th><th className="px-6 py-5 font-medium text-center">Visibility</th><th className="px-6 py-5 font-medium text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {roadmaps.map((rm) => (
                  <tr key={rm.id} className="hover:bg-neutral-50/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900">{rm.title}</div>
                      <div className="text-neutral-500 text-xs mt-1">{categories.find(c => c.id === rm.category_id)?.name || 'Uncategorized'}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => togglePublish(rm.id, rm.is_published)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${rm.is_published ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600"}`}>
                        {rm.is_published ? <><Eye size={14} /> Published</> : <><EyeOff size={14} /> Draft</>}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { 
                          setEditingRoadmap(rm); 
                          setEditUploadMethod("keep");
                          setEditTargetDeadline(rm.target_deadline || ""); // SET DEADLINE FOR EDITING
                        }} className="text-neutral-400 hover:text-blue-600 p-2"><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(rm.id, rm.file_url)} className="text-neutral-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
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
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
              <h2 className="text-lg font-medium text-neutral-900 flex items-center gap-2"><Pencil size={18} /> Edit Roadmap</h2>
              <button onClick={() => setEditingRoadmap(null)} className="text-neutral-400 hover:text-neutral-600 p-1"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto flex-grow space-y-5 text-sm">
              <div>
                <label className="block font-medium text-neutral-700 mb-1">Title</label>
                <input type="text" required value={editingRoadmap.title} onChange={(e) => setEditingRoadmap({...editingRoadmap, title: e.target.value})} className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              
              {/* UPDATED: Category and Deadline Grid in Edit Modal */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Category</label>
                  <select required value={editingRoadmap.category_id} onChange={(e) => setEditingRoadmap({...editingRoadmap, category_id: e.target.value})} className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Target Deadline</label>
                  <input type="date" value={editTargetDeadline} onChange={(e) => setEditTargetDeadline(e.target.value)} className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-neutral-700" />
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
                <div className={`mt-2 text-center font-medium ${status.type === 'error' ? 'text-red-600' : 'text-blue-600'}`}>{status.msg}</div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}