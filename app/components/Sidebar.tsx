"use client";

import { useMemo, useState } from "react";
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

function collectFolderHrefs(items: SidebarItem[], acc: string[] = []): string[] {
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      acc.push(item.href);
      collectFolderHrefs(item.children, acc);
    }
  }
  return acc;
}

export default function Sidebar({ lexicon, items, currentPath }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const folderHrefs = useMemo(() => collectFolderHrefs(items), [items]);

  function toggleFolder(href: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  return (
    <nav
      className="flex flex-col flex-1 min-h-0"
      aria-label={`${lexicon} navigation`}
    >
      <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest truncate">
          {lexicon}
        </h2>
        {folderHrefs.length > 0 && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed(new Set())}
              title="Expand all folders"
              aria-label="Expand all folders"
              className="p-1 rounded text-gray-400 hover:text-amber-700 dark:text-gray-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v6m0 0l-3-3m3 3l3-3M12 20v-6m0 0l-3 3m3-3l3 3" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(new Set(folderHrefs))}
              title="Collapse all folders"
              aria-label="Collapse all folders"
              className="p-1 rounded text-gray-400 hover:text-amber-700 dark:text-gray-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7-7-7 7M19 20l-7-7-7 7" />
              </svg>
            </button>
          </div>
        )}
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
                collapsed={collapsed}
                onToggleFolder={toggleFolder}
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
  collapsed: Set<string>;
  onToggleFolder: (href: string) => void;
}

function SidebarNavItem({ item, currentPath, depth, collapsed, onToggleFolder }: SidebarNavItemProps) {
  const isFolder = !!item.children && item.children.length > 0;
  const isActive = currentPath === item.href;
  const expanded = !collapsed.has(item.href);
  const closeDrawer = useCloseDrawer();

  return (
    <li>
      {isFolder ? (
        <button
          type="button"
          onClick={() => onToggleFolder(item.href)}
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
            flex items-center px-3 py-1.5 rounded text-sm border-l-2 -ml-px transition-colors
            ${isActive
              ? "border-amber-500 bg-amber-50 text-amber-900 font-medium dark:border-amber-400 dark:bg-amber-950/30 dark:text-amber-200"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50"
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
              collapsed={collapsed}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
