"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReaderSearch, noteHref, type SearchEntry } from "@/lib/reader-search";
import { useCloseDrawer } from "./DrawerContext";

export default function PageSearch({ notes, lexicon }: { notes: SearchEntry[]; lexicon: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const closeDrawer = useCloseDrawer();
  const search = useMemo(() => createReaderSearch(notes), [notes]);
  const results = query.trim() ? search(query, 8) : notes.slice(0, 8);
  const allResults = `/${lexicon}/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`;

  const close = useCallback(() => {
    dialog.current?.close();
    setOpen(false);
    setQuery("");
    setActive(0);
    opener.current?.focus();
  }, []);

  function finish() {
    close();
    closeDrawer();
  }

  useEffect(() => {
    function show() {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    }
    function key(e: KeyboardEvent) {
      const shortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey &&
        !(e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]"));
      if (shortcut || (slash && !open)) {
        e.preventDefault();
        if (open) close();
        else show();
      }
    }
    document.addEventListener("keydown", key);
    document.addEventListener("pensieve:opensearch", show);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pensieve:opensearch", show);
    };
  }, [close, open]);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      dialog.current.querySelector("input")?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog ref={dialog} aria-labelledby="quick-search-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] bottom-auto sm:top-[16vh] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-gray-950/60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <div>
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 id="quick-search-title" className="text-xs font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-300">Find a note</h2>
          <button type="button" onClick={close} aria-label="Close search" className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">✕</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          const note = results[active];
          finish();
          router.push(note ? noteHref(lexicon, note.slug) : allResults);
        }}>
          <input type="search" aria-label="Jump to page" placeholder="Jump to page…" value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const next = Math.max(0, Math.min(results.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
                setActive(next);
                document.getElementById(`quick-search-${next}`)?.scrollIntoView({ block: "nearest" });
              }
            }}
            className="mx-4 my-2 w-[calc(100%-2rem)] rounded-md border border-gray-300 bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-amber-600 dark:border-gray-600" />
        </form>
        <ul aria-label="Suggested notes" className="max-h-[40dvh] overflow-y-auto px-2 py-1">
          {results.map((note, index) => (
            <li id={`quick-search-${index}`} key={note.slug}>
              <Link href={noteHref(lexicon, note.slug)} onNavigate={finish} prefetch={false}
                onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)}
                className={`block rounded-md px-3 py-2 ${index === active ? "bg-amber-50 dark:bg-amber-950/60" : ""}`}>
                <span className="block text-sm font-medium">{note.title}</span>
                <span className="block truncate font-mono text-xs text-gray-600 dark:text-gray-400">{note.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
        {!results.length && <p role="status" className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">No matching titles, paths, or tags. Try searching note text.</p>}
        <Link href={allResults} onNavigate={finish} prefetch={false}
          className="block border-t border-gray-200 px-4 py-3 text-sm font-medium text-amber-800 hover:underline dark:border-gray-700 dark:text-amber-300">
          Search note text {query.trim() && <>for “{query.trim()}”</>} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </dialog>
  );
}
