"use client";
import { useEffect, useRef, useState } from "react";
import { DrawerContext } from "./DrawerContext";

interface ResponsiveShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

/** Collapses the sidebar into an off-canvas drawer below the md breakpoint. */
export default function ResponsiveShell({ sidebar, children }: ResponsiveShellProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dismiss = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    dismiss.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <DrawerContext.Provider value={() => setOpen(false)}>
    <div className="flex min-h-screen">
      <button
        type="button"
        onClick={() => setOpen(true)}
        ref={trigger}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="reader-navigation"
        className="md:hidden fixed top-3 left-3 z-30 p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => { setOpen(false); trigger.current?.focus(); }}
          aria-hidden="true"
        />
      )}

      <div id="reader-navigation"
        onClickCapture={(event) => {
          const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
          if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setOpen(false);
        }}
        className={`
          w-72 max-w-[85vw] shrink-0 fixed inset-y-0 left-0 z-50 h-dvh flex flex-col
          bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transform transition-transform duration-200 ease-in-out motion-reduce:transition-none
          md:sticky md:top-0 md:visible md:translate-x-0
          ${open ? "visible translate-x-0" : "invisible -translate-x-full"}
        `}
      >
        <button type="button" ref={dismiss} onClick={() => { setOpen(false); trigger.current?.focus(); }}
          className="md:hidden shrink-0 self-end px-4 py-2 text-sm text-gray-700 dark:text-gray-300" aria-label="Close navigation">Close <span aria-hidden="true">✕</span></button>
        {sidebar}
      </div>

      <div className="min-w-0 flex-1 overflow-auto pt-14 md:pt-0">{children}</div>
    </div>
    </DrawerContext.Provider>
  );
}
