import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center max-w-2xl">
        <div className="flex items-center justify-center gap-4 mb-6">
          <svg width="56" height="56" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="0.75" className="text-amber-300 dark:text-amber-700" />
            <circle cx="11" cy="11" r="5.5" fill="currentColor" className="text-amber-400 dark:text-amber-500" />
            <circle cx="11" cy="11" r="5.5" fill="url(#home-glow)" />
            <defs>
              <radialGradient id="home-glow" cx="0.35" cy="0.3" r="0.8">
                <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
          <h1 className="font-display text-6xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Pensieve
          </h1>
        </div>
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-8">
          Pour your notes in. Let others walk through them.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/dashboard" className="btn-primary px-5">
            Dashboard
          </Link>
          <p className="text-sm text-gray-400 dark:text-gray-600">
            A self-hosted markdown blog platform.
          </p>
        </div>
      </div>
    </main>
  );
}
