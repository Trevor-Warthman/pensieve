import type { SidebarItem } from "../components/Sidebar";

interface BookmarkNote {
  slug: string[];
  title: string;
  bookmark: boolean;
  bookmarkFolder: string | null;
}

/**
 * Build the nested Bookmarks tree from notes with `bookmark: true`.
 * `bookmark-folder` ("Dinner/Chicken") nests folders; notes without a folder sit at the root.
 * Folders sort first, then notes, alphabetically.
 */
export function buildBookmarkTree(notes: BookmarkNote[], lexiconSlug: string): SidebarItem[] {
  const root: SidebarItem[] = [];
  const folders = new Map<string, SidebarItem>();

  const sortItems = (items: SidebarItem[]) => {
    items.sort((a, b) => {
      const af = a.children ? 0 : 1;
      const bf = b.children ? 0 : 1;
      return af - bf || a.label.localeCompare(b.label);
    });
    for (const i of items) if (i.children) sortItems(i.children);
  };

  for (const note of notes.filter((n) => n.bookmark)) {
    const item: SidebarItem = {
      label: note.title,
      href: `/${lexiconSlug}/${note.slug.map((s) => encodeURIComponent(s)).join("/")}`,
    };
    const parts = (note.bookmarkFolder ?? "").split("/").map((p) => p.trim()).filter(Boolean);
    let siblings = root;
    let key = "";
    for (const part of parts) {
      key += `/${part}`;
      let folder = folders.get(key);
      if (!folder) {
        folder = { label: part, href: `#bookmarks${key}`, children: [] };
        folders.set(key, folder);
        siblings.push(folder);
      }
      siblings = folder.children!;
    }
    siblings.push(item);
  }
  sortItems(root);
  return root;
}
