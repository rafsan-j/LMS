import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import RoadmapCanvas from "./RoadmapCanvas";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RoadmapViewer({ params }: PageProps) {
  const { id } = await params;

  const { data: roadmap, error: dbError } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("id", id)
    .single();

  if (dbError || !roadmap) return notFound();

  let htmlContent = "<p>Error loading content.</p>";
  try {
    const response = await fetch(roadmap.file_url);
    if (response.ok) {
      htmlContent = await response.text();
    }
  } catch (err) {
    console.error("Failed to fetch HTML:", err);
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans selection:bg-blue-100">
      <nav className="sticky top-0 z-50 bg-[#FDFDFD]/80 backdrop-blur-md border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Library
        </Link>
        <div className="text-sm font-medium text-neutral-400">
          {roadmap.category}
        </div>
      </nav>

      <main className="px-6">
        {/* We use our new Client Component to handle interactivity and theme formatting */}
        <RoadmapCanvas htmlContent={htmlContent} />
      </main>
    </div>
  );
}