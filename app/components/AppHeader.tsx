"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

interface AppHeaderProps {
  email?: string | null;
}

export default function AppHeader({ email }: AppHeaderProps) {
  const router = useRouter();

  function logout() {
    localStorage.removeItem("pensieve_token");
    localStorage.removeItem("pensieve_email");
    document.cookie = "pensieve_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
      <Link href="/dashboard" className="group flex items-center gap-2.5 hover:opacity-90 transition-opacity">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:scale-110">
          <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="1.25" className="text-amber-300 dark:text-amber-700" />
          <circle cx="11" cy="11" r="5.5" fill="currentColor" className="text-amber-400 dark:text-amber-500" />
          <circle cx="11" cy="11" r="5.5" fill="url(#pensieve-glow)" />
          <defs>
            <radialGradient id="pensieve-glow" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
        <span className="font-display text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
          Pensieve
        </span>
      </Link>
      <div className="flex items-center gap-3">
        {email && (
          <Link
            href="/settings"
            className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
          >
            {email}
          </Link>
        )}
        <ThemeToggle />
        <button onClick={logout} className="btn-ghost text-xs px-3 py-1.5">
          Log out
        </button>
      </div>
    </header>
  );
}
