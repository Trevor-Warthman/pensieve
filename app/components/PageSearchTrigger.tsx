"use client";

export default function PageSearchTrigger() {
  return (
    <button
      className="w-full flex items-center justify-between px-2 py-1 rounded text-xs text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      onClick={() => document.dispatchEvent(new CustomEvent("pensieve:opensearch"))}
      aria-label="Open page search (⌘K)"
    >
      <span>Jump to page…</span>
      <kbd className="font-sans">⌘K</kbd>
    </button>
  );
}
