"use client";
import { useEffect, useRef, useState } from "react";
import type { Heading } from "@/lib/markdown";

interface TableOfContentsProps {
  headings: Heading[];
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = headings.map((h) => h.id);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [headings]);

  return (
    <aside className="hidden xl:block w-56 shrink-0 sticky top-16 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-500 mb-3">
        On this page
      </p>
      <nav>
        <ul className="space-y-1">
          {headings.map((h) => (
            <li key={h.id} style={{ paddingLeft: `${(h.level - 2) * 0.75}rem` }}>
              <a
                href={`#${h.id}`}
                className={`block text-xs py-0.5 transition-colors leading-snug ${
                  activeId === h.id
                    ? "text-indigo-500 dark:text-indigo-400 font-medium"
                    : "text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
