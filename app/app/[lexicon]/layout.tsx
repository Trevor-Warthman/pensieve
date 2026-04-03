import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import SearchBar from "@/components/SearchBar";
import SidebarWrapper from "@/components/SidebarWrapper";
import PageSearch from "@/components/PageSearch";
import PageSearchTrigger from "@/components/PageSearchTrigger";
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

  // Password gate: check for valid access cookie
  if (lexicon.passwordHash) {
    const cookieStore = await cookies();
    const token = cookieStore.get(`lex_${slug}`)?.value;
    let valid = false;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { lexiconSlug: string };
        valid = payload.lexiconSlug === slug;
      } catch { /* invalid token */ }
    }
    if (!valid) redirect(`/auth/${slug}`);
  }

  const notes = await listNotes(lexiconS3Prefix(lexicon), lexicon.publishDefault);
  const sidebarItems = buildSidebarTree(notes, slug);
  const searchNotes = notes.map((n) => ({
    title: n.title,
    href: `/${slug}/${n.slug.join("/")}`,
  }));

  return (
    <div className="flex min-h-screen">
      <PageSearch notes={searchNotes} />
      <div className="w-64 shrink-0 sticky top-0 h-screen overflow-y-auto flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 space-y-2">
          <SearchBar />
          <PageSearchTrigger />
        </div>
        <SidebarWrapper lexicon={lexicon.title} items={sidebarItems} />
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 space-y-1 shrink-0">
          <Link
            href={`/${slug}/search`}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Full-text search
          </Link>
          <Link
            href={`/${slug}/graph`}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="5" cy="12" r="2" strokeWidth={2} />
              <circle cx="19" cy="5" r="2" strokeWidth={2} />
              <circle cx="19" cy="19" r="2" strokeWidth={2} />
              <line x1="7" y1="11" x2="17" y2="6" strokeWidth={2} />
              <line x1="7" y1="13" x2="17" y2="18" strokeWidth={2} />
            </svg>
            Graph view
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
