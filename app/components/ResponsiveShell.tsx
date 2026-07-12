"use client";
import { useState } from "react";

interface ResponsiveShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

/** Collapses the sidebar into an off-canvas drawer below the md breakpoint. */
export default function ResponsiveShell({ sidebar, children }: ResponsiveShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="md:hidden fixed top-3 left-3 z-30 p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`
          w-64 shrink-0 fixed inset-y-0 left-0 z-50 h-screen overflow-y-auto flex flex-col
          bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transform transition-transform duration-200 ease-in-out
          md:sticky md:top-0 md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {sidebar}
      </div>

      <div className="flex-1 overflow-auto pt-14 md:pt-0">{children}</div>
    </div>
  );
}
