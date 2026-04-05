"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Home, ListTodo, CheckSquare, Settings, User, LogOut, Sparkles, Menu, X, FolderOpen } from "lucide-react";

export default function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hide navigation entirely on the login page
  if (pathname === "/login") return <>{children}</>;

  const navLinks = [
    { name: "Deep Work (Home)", href: "/", icon: Home },
    { name: "Wishlist Queue", href: "/wishlist", icon: ListTodo },
    { name: "Command Center", href: "/todo", icon: CheckSquare },
    { name: "Curriculum Admin", href: "/admin", icon: FolderOpen },
    { name: "OS Profile", href: "/settings", icon: User }, 
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const NavContent = () => (
    <div className="flex flex-col h-full bg-neutral-900 text-neutral-400 p-6">
      <div className="flex items-center gap-3 text-white mb-10 px-2">
        <div className="bg-blue-600 p-2 rounded-lg"><Sparkles size={20} /></div>
        <span className="font-bold text-lg tracking-tight">Focus OS</span>
      </div>

      <nav className="flex-1 space-y-2">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link 
              key={link.name} 
              href={link.href} 
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                isActive ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <Icon size={18} /> {link.name}
            </Link>
          );
        })}
      </nav>

      {/* NEW: Logout Button at the bottom */}
      <div className="pt-6 border-t border-neutral-800 mt-auto">
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-all font-medium hover:bg-red-500/10 hover:text-red-400 text-left"
        >
          <LogOut size={18} /> Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#FDFDFD]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-72 flex-shrink-0 fixed h-screen z-20">
        <NavContent />
      </aside>

      {/* Mobile Header & Overlay */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-neutral-900 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-white">
          <div className="bg-blue-600 p-1.5 rounded-md"><Sparkles size={16} /></div>
          <span className="font-bold tracking-tight">Focus OS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white p-2">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-20 pt-16 bg-neutral-900">
          <NavContent />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 md:ml-72 pt-16 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}