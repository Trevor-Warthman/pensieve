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
      <Link href="/dashboard" className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight hover:opacity-70 transition-opacity">
        Pensieve
      </Link>
      <div className="flex items-center gap-4">
        {email && (
          <Link
            href="/settings"
            className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {email}
          </Link>
        )}
        <ThemeToggle />
        <button
          onClick={logout}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
