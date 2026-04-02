"use client";
import { useState, useRef, useEffect } from "react";
import Fuse from "fuse.js";
import type { SearchEntry } from "@/lib/content";

interface SearchClientProps {
  index: SearchEntry[];
  lexiconSlug: string;
  initialQuery?: string;
}

export default function SearchClient({ index, lexiconSlug, initialQuery = "" }: SearchClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useRef(
    new Fuse(index, {
      keys: [
        { name: "title", weight: 2 },
        { name: "content", weight: 1 },
        { name: "tags", weight: 1.5 },
      ],
      includeMatches: true,
      threshold: 0.35,
      minMatchCharLength: 2,
    })
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = query.trim()
    ? fuse.current.search(query.trim()).slice(0, 20)
    : [];

  function getExcerpt(item: SearchEntry, query: string): string {
    if (!item.content) return "";
    const q = query.toLowerCase();
    const idx = item.content.toLowerCase().indexOf(q);
    if (idx === -1) return item.content.slice(0, 120) + "…";
    const start = Math.max(0, idx - 40);
    const end = Math.min(item.content.length, idx + q.length + 80);
    return (start > 0 ? "…" : "") + item.content.slice(start, end) + (end < item.content.length ? "…" : "");
  }

  function highlight(text: string, query: string): React.ReactNode {
    const q = query.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-indigo-500/30 text-white rounded px-0.5">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="relative mb-8">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-indigo-500 text-base"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>

      {query.trim() && (
        <p className="text-sm text-gray-500 mb-4">
          {results.length === 0
            ? "No results"
            : `${results.length} result${results.length !== 1 ? "s" : ""}`}
        </p>
      )}

      <ul className="space-y-3">
        {results.map(({ item }) => (
          <li key={item.slug}>
            <a
              href={`/${lexiconSlug}/${item.slug}`}
              className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white mb-1">
                {highlight(item.title, query)}
              </div>
              {item.content && (
                <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {highlight(getExcerpt(item, query.trim()), query.trim())}
                </div>
              )}
              {item.tags.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {item.tags.map((t) => (
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </a>
          </li>
        ))}
      </ul>

      {!query.trim() && (
        <p className="text-sm text-gray-400 dark:text-gray-600 text-center pt-8">
          Type to search across all {index.length} note{index.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
