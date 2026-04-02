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
      className="flex flex-col flex-1"
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
  const isActive = currentPath === item.href;

  return (
    <li>
      <a
        href={item.href}
        className={`
          flex items-center px-3 py-1.5 rounded text-sm transition-colors
          ${isActive
            ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50"
          }
        `}
        style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
      >
        {item.label}
      </a>
      {item.children && item.children.length > 0 && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
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
