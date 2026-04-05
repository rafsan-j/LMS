"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import RoadmapCanvas from "./RoadmapCanvas";
import { Loader2, AlertCircle } from "lucide-react";

export default function RoadmapPage() {
  // FIXED: Safely extract the ID using the Next.js hook instead of props
  const params = useParams();
  const id = params?.id as string;

  const [htmlContent, setHtmlContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Prevent fetching until the URL parameter is successfully parsed
    if (!id) return;

    const fetchRoadmap = async () => {
      try {
        console.log("Attempting to fetch course ID:", id); // Debugging log
        
        const { data, error: dbError } = await supabase
          .from("roadmaps")
          .select("*")
          .eq("id", id)
          .single();
        
        if (dbError) {
          console.error("Supabase Error:", dbError.message);
          throw new Error("Could not find this course in the database.");
        }
        
        if (!data?.file_url) {
          throw new Error("This course does not have an attached HTML file.");
        }

        const res = await fetch(data.file_url);
        if (!res.ok) {
          throw new Error(`Storage error: Failed to load file (${res.status}). Ensure the URL is correct.`);
        }
        
        const html = await res.text();
        setHtmlContent(html);
        
      } catch (e: any) {
        console.error("Roadmap Load Error:", e);
        setErrorMsg(e.message || "An unknown error occurred while loading the roadmap.");
      } finally {
        setLoading(false);
      }
    };

    fetchRoadmap();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-neutral-500 gap-3">
        <Loader2 className="animate-spin" size={32} /> 
        <p>Loading Interactive Roadmap...</p>
      </div>
    );
  }
  
  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl max-w-md border border-red-100">
          <AlertCircle size={40} className="mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-bold mb-2">Failed to Load Content</h2>
          <p className="text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return <RoadmapCanvas htmlContent={htmlContent} roadmapId={id} />;
}