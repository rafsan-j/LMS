"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListTodo, CheckSquare, Settings, Menu, X, BookOpen } from "lucide-react";

export default function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Deep Work (Home)", href: "/", icon: Home },
    { name: "Wishlist Queue", href: "/wishlist", icon: ListTodo },
    { name: "Daily Planner", href: "/todo", icon: CheckSquare },
    { name: "Curriculum Admin", href: "/admin", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-neutral-900">
      
      {/* --- Desktop Sidebar --- */}
      <aside className="hidden md:flex flex-col w-64 bg-neutral-50 border-r border-neutral-200 fixed h-full z-20">
        <div className="p-6 flex items-center gap-2 font-bold text-lg tracking-tight mb-4">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg"><BookOpen size={18} /></div>
          Focus OS
        </div>
        <nav className="flex flex-col gap-2 px-4">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link key={link.name} href={link.href} onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  isActive ? "bg-white shadow-sm border border-neutral-200/60 text-blue-700" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                <Icon size={18} /> {link.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* --- Mobile Header --- */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-neutral-200 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg"><BookOpen size={18} /></div>
          Focus OS
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-neutral-600">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* --- Mobile Menu Overlay --- */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40 p-4 border-t border-neutral-100">
          <nav className="flex flex-col gap-2">
             {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link key={link.name} href={link.href} onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 text-base font-medium rounded-xl transition-all ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-neutral-600"
                  }`}
                >
                  <Icon size={20} /> {link.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* --- Main Content Area --- */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen relative overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}