import { notFound } from "next/navigation";
import Link from "next/link";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { listNotes } from "@/lib/content";

interface TagPageProps {
  params: Promise<{ lexicon: string; tag: string }>;
}

export default async function TagPage({ params }: TagPageProps) {
  const { lexicon: slug, tag: encodedTag } = await params;
  const tag = decodeURIComponent(encodedTag);

  const lexicon = await getLexiconBySlug(slug);
  if (!lexicon) notFound();

  const notes = await listNotes(lexiconS3Prefix(lexicon), lexicon.publishDefault);
  const filtered = notes.filter((n) => n.tags.includes(tag));

  return (
    <main className="px-6 py-16 max-w-4xl mx-auto">
      <nav className="text-sm text-gray-500 dark:text-gray-400 mb-8 flex items-center gap-2">
        <Link href={`/${slug}/tags`} className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
          Tags
        </Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300">{tag}</span>
      </nav>

      <h1 className="font-display text-3xl font-semibold text-gray-900 dark:text-white mb-10">
        <span className="text-amber-600 dark:text-amber-400">#</span>{tag}
        <span className="ml-3 text-lg font-sans font-normal text-gray-400 dark:text-gray-500">{filtered.length} notes</span>
      </h1>

      {filtered.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No notes with this tag.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((note) => (
            <li key={note.s3Key}>
              <Link
                href={`/${slug}/${note.slug.map((s) => encodeURIComponent(s)).join("/")}`}
                className="group flex flex-col gap-1 rounded-lg border border-gray-200 dark:border-gray-800 px-5 py-4 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
              >
                <span className="text-gray-900 dark:text-white font-medium">{note.title}</span>
                {note.tags.filter((t) => t !== tag).length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {note.tags.filter((t) => t !== tag).join(", ")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
