"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, Sparkles, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ type: "error" | "success", msg: string } | null>(null);

  // If they are already logged in, kick them straight to the app
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/");
      } else {
        setIsCheckingAuth(false);
      }
    };
    checkSession();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      if (isLogin) {
        // --- SIGN IN ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        router.push("/"); // Boot them to the Deep Work zone on success
        
      } else {
        // --- SIGN UP ---
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        setStatus({ type: "success", msg: "Account created successfully! Logging you in..." });
        
        // Auto-login after successful signup
        await supabase.auth.signInWithPassword({ email, password });
        
        // Route new users to the settings page to build their Learning Profile
        setTimeout(() => router.push("/settings"), 1500);
      }
    } catch (error: any) {
      setStatus({ type: "error", msg: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) return <div className="min-h-screen flex items-center justify-center text-neutral-500">Authenticating...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] p-4">
      {/* Decorative Background Element */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-3xl shadow-xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="px-8 pt-10 pb-6 text-center border-b border-neutral-100">
          <div className="w-12 h-12 bg-neutral-900 text-white rounded-xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <Sparkles size={24} />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-2">
            {isLogin ? "Welcome back" : "Initialize your OS"}
          </h1>
          <p className="text-sm text-neutral-500">
            {isLogin ? "Enter your credentials to access your learning environment." : "Create an account to start building your dynamic curriculum."}
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="p-8 space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" 
                  disabled={isLoading}
                  className="w-full pl-10 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-neutral-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required 
                  minLength={6}
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  disabled={isLoading}
                  className="w-full pl-10 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-neutral-900"
                />
              </div>
            </div>
          </div>

          {status && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
              {status.msg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading || !email || !password}
            className="w-full bg-blue-600 text-white font-medium py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 mt-2"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
            {isLoading ? "Authenticating..." : isLogin ? "Sign In" : "Create Account"}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="px-8 pb-8 text-center">
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setStatus(null); }}
            disabled={isLoading}
            className="text-sm text-neutral-500 hover:text-neutral-900 font-medium transition-colors"
          >
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span className="text-blue-600 underline underline-offset-4 decoration-blue-600/30 hover:decoration-blue-600">
              {isLogin ? "Sign up here" : "Sign in instead"}
            </span>
          </button>
        </div>
        
      </div>
    </div>
  );
}