import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
          Pensieve
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-8">
          Pour your notes in. Let others walk through them.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-5 py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-sm font-medium hover:opacity-90 transition-opacity"
          >
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
