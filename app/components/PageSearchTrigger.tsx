"use client";

export default function PageSearchTrigger() {
  return (
    <button
      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      onClick={() => document.dispatchEvent(new CustomEvent("pensieve:opensearch"))}
      aria-label="Open page search (⌘K)"
    >
      <span>Jump to page…</span>
      <kbd className="font-sans text-[10px] border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5">⌘K</kbd>
    </button>
  );
}
