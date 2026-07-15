"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useCloseDrawer } from "./DrawerContext";

interface PagefindResult {
  url: string;
  meta: { title?: string };
  excerpt: string;
}

interface PagefindAPI {
  search: (query: string) => Promise<{ results: Array<{ data: () => Promise<PagefindResult> }> }>;
}

declare global {
  interface Window {
    pagefind?: PagefindAPI;
  }
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeDrawer = useCloseDrawer();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;

    async function run() {
      if (!window.pagefind) {
        try {
          // @ts-expect-error pagefind is generated at postbuild, not available at compile time
          await import(/* webpackIgnore: true */ "/pagefind/pagefind.js");
        } catch {
          return;
        }
      }
      const res = await window.pagefind!.search(query);
      const data = await Promise.all(res.results.slice(0, 8).map((r) => r.data()));
      if (!cancelled) {
        setResults(data);
        setOpen(true);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="input-field pl-8"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-72 overflow-y-auto">
          {results.map((r) => (
            <li key={r.url}>
              <Link
                href={r.url}
                className="block px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                onClick={() => {
                  setOpen(false);
                  closeDrawer();
                }}
              >
                <div className="text-gray-900 dark:text-gray-100 font-medium">{r.meta.title ?? r.url}</div>
                <div
                  className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
