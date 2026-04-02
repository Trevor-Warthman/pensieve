"use client";
import { useState, useEffect, useRef } from "react";

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
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-gray-500"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 rounded border border-gray-700 bg-gray-900 shadow-lg max-h-72 overflow-y-auto">
          {results.map((r) => (
            <li key={r.url}>
              <a
                href={r.url}
                className="block px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
                onClick={() => setOpen(false)}
              >
                <div className="text-gray-100 font-medium">{r.meta.title ?? r.url}</div>
                <div
                  className="text-gray-400 text-xs mt-0.5 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
