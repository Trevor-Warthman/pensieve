import { notFound } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import SidebarWrapper from "@/components/SidebarWrapper";
import { type SidebarItem } from "@/components/Sidebar";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { listNotes } from "@/lib/content";

interface LexiconLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lexicon: string }>;
}

function buildSidebarTree(
  notes: Array<{ slug: string[]; title: string }>,
  lexiconSlug: string
): SidebarItem[] {
  const root: SidebarItem[] = [];
  const folders = new Map<string, SidebarItem>();

  const sorted = [...notes].sort((a, b) =>
    a.slug.join("/").localeCompare(b.slug.join("/"))
  );

  for (const note of sorted) {
    const href = `/${lexiconSlug}/${note.slug.join("/")}`;
    const item: SidebarItem = { label: note.title, href };

    if (note.slug.length === 1) {
      root.push(item);
    } else {
      const folderParts = note.slug.slice(0, -1);
      const folderKey = folderParts.join("/");

      let parent = folders.get(folderKey);
      if (!parent) {
        parent = {
          label: folderParts.at(-1)!,
          href: `/${lexiconSlug}/${folderParts.join("/")}`,
          children: [],
        };
        folders.set(folderKey, parent);
        const grandparentKey = folderParts.slice(0, -1).join("/");
        const grandparent = folders.get(grandparentKey);
        if (grandparent) {
          grandparent.children!.push(parent);
        } else {
          root.push(parent);
        }
      }
      parent.children!.push(item);
    }
  }

  return root;
}

export default async function LexiconLayout({ children, params }: LexiconLayoutProps) {
  const { lexicon: slug } = await params;
  const lexicon = await getLexiconBySlug(slug);
  if (!lexicon) notFound();

  const notes = await listNotes(lexiconS3Prefix(lexicon), lexicon.publishDefault);
  const sidebarItems = buildSidebarTree(notes, slug);

  return (
    <div className="flex min-h-screen">
      <div className="w-64 shrink-0 sticky top-0 h-screen overflow-y-auto flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <SearchBar />
        </div>
        <SidebarWrapper lexicon={lexicon.title} items={sidebarItems} />
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
