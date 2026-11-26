"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { createReaderSearch, noteHref, searchTerms, type SearchEntry } from "@/lib/reader-search";

function snippet(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  const offsets = terms.map((term) => normalized.indexOf(term)).filter((offset) => offset >= 0);
  const start = offsets.length ? Math.max(0, Math.min(...offsets) - 36) : 0;
  const end = start + 160;
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  // Terms are Unicode letters or digits; no user-supplied regex operators.
  const matches = new RegExp(`(${terms.slice().sort((a, b) => b.length - a.length).join("|")})`, "giu");
  return text.split(matches).map((part, i) => i % 2
    ? <mark key={i} className="rounded bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-100">{part}</mark>
    : part);
}

export default function SearchClient({ index, lexiconSlug, initialQuery }: {
  index: SearchEntry[];
  lexiconSlug: string;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query.trim());
  const search = useMemo(() => createReaderSearch(index), [index]);
  const results = useMemo(() => search(deferredQuery, 31), [search, deferredQuery]);
  const terms = searchTerms(deferredQuery);

  return (
    <>
      <div className="mb-6 flex gap-2">
        <input type="search" aria-label="Search notes" value={query}
          onChange={(event) => setQuery(event.target.value)} placeholder="Search notes…"
          className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus-visible:outline-2 focus-visible:outline-amber-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
        {query && <button type="button" onClick={() => setQuery("")}
          className="rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Clear</button>}
      </div>
      <p role="status" className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        {!deferredQuery ? `Search ${index.length} published ${index.length === 1 ? "note" : "notes"} by title, path, tag, or excerpt.`
          : results.length === 0 ? "No results. Try fewer words, a note title, or a tag."
          : results.length > 30 ? "Showing the first 30 results. Add a word to narrow your search."
          : `${results.length} ${results.length === 1 ? "result" : "results"}`}
      </p>
      <ol aria-label="Search results" className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {results.slice(0, 30).map((note) => (
          <li key={note.slug}>
            <Link href={noteHref(lexiconSlug, note.slug)} prefetch={false}
              className="block rounded-sm px-2 py-4 hover:bg-amber-50/60 focus-visible:outline-2 focus-visible:outline-amber-600 dark:hover:bg-amber-950/30 sm:px-4">
              <div className="break-words font-semibold text-gray-900 dark:text-gray-100">{highlight(note.title, terms)}</div>
              <div className="mt-1 break-words font-mono text-xs text-gray-600 dark:text-gray-400">{highlight(note.slug, terms)}</div>
              {note.content && <p className="mt-2 line-clamp-2 break-words text-sm text-gray-700 dark:text-gray-300">{highlight(snippet(note.content, terms), terms)}</p>}
              {note.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                {note.tags.map((tag) => <span key={tag}>#{highlight(tag, terms)}</span>)}
              </div>}
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
