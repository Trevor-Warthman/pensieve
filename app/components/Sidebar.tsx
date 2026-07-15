"use client";

import { useState } from "react";
import Link from "next/link";
import { useCloseDrawer } from "./DrawerContext";

export interface SidebarItem {
  label: string;
  href: string;
  children?: SidebarItem[];
}

export interface SidebarProps {
  lexicon: string;
  items: SidebarItem[];
  currentPath?: string;
}

export default function Sidebar({ lexicon, items, currentPath }: SidebarProps) {
  return (
    <nav
      className="flex flex-col flex-1 min-h-0"
      aria-label={`${lexicon} navigation`}
    >
      <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
          {lexicon}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {items.length === 0 ? (
          <p className="px-4 text-sm text-gray-400 dark:text-gray-600">No notes yet.</p>
        ) : (
          <ul className="space-y-0.5 px-2">
            {items.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                currentPath={currentPath}
                depth={0}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

interface SidebarNavItemProps {
  item: SidebarItem;
  currentPath?: string;
  depth: number;
}

function SidebarNavItem({ item, currentPath, depth }: SidebarNavItemProps) {
  const isFolder = !!item.children && item.children.length > 0;
  const isActive = currentPath === item.href;
  const [expanded, setExpanded] = useState(true);
  const closeDrawer = useCloseDrawer();

  return (
    <li>
      {isFolder ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex items-center w-full px-3 py-1.5 rounded text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
        >
          <svg
            className={`w-3 h-3 mr-1.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {item.label}
        </button>
      ) : (
        <Link
          href={item.href}
          prefetch={false}
          onClick={closeDrawer}
          className={`
            flex items-center px-3 py-1.5 rounded text-sm transition-colors
            ${isActive
              ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50"
            }
          `}
          style={{ paddingLeft: `${0.75 + depth * 1 + 1.125}rem` }}
        >
          {item.label}
        </Link>
      )}
      {isFolder && expanded && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children!.map((child) => (
            <SidebarNavItem
              key={child.href}
              item={child}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
