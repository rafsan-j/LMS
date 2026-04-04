import Link from "next/link";
import { supabase } from "../lib/supabase";
import { ArrowRight, BookOpen } from "lucide-react";

// This runs on the server, keeping the client bundle light
export default async function LibraryPage() {
  const { data: roadmaps, error } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-12 text-red-500">Error loading library: {error.message}</div>;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-neutral-900 selection:bg-blue-100 font-sans">
      {/* Premium minimal header */}
      <header className="px-8 py-12 max-w-4xl mx-auto border-b border-neutral-100">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium tracking-wide text-blue-800 uppercase bg-blue-50 rounded-full">
          <BookOpen size={14} />
          <span>Curriculum Center</span>
        </div>
        <h1 className="text-4xl font-light tracking-tight text-neutral-900 mb-3">
          Your Study Roadmaps
        </h1>
        <p className="text-neutral-500 font-light text-lg">
          Structured learning paths to master complex concepts.
        </p>
      </header>

      {/* Editorial List Layout */}
      <main className="max-w-4xl mx-auto px-8 py-12">
        <div className="flex flex-col gap-8">
          {roadmaps?.map((roadmap) => (
            <Link 
              key={roadmap.id} 
              href={`/roadmap/${roadmap.id}`}
              className="group block relative pl-6 border-l border-neutral-200 hover:border-blue-600 transition-colors duration-300"
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-medium text-neutral-400 group-hover:text-blue-600 transition-colors">
                  {roadmap.category}
                </span>
                <span className="text-sm text-neutral-400 font-light flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                  View Path <ArrowRight size={14} />
                </span>
              </div>
              <h2 className="text-2xl font-medium text-neutral-800 mb-2 group-hover:text-black transition-colors">
                {roadmap.title}
              </h2>
              <p className="text-neutral-500 font-light leading-relaxed max-w-2xl">
                {roadmap.description || "Explore this module to master the foundational and advanced techniques required for this topic."}
              </p>
            </Link>
          ))}
          
          {roadmaps?.length === 0 && (
            <p className="text-neutral-400 font-light italic">No roadmaps published yet. Head to the admin dashboard to upload one.</p>
          )}
        </div>
      </main>
    </div>
  );
}