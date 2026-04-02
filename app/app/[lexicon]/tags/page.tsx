import { notFound } from "next/navigation";
import Link from "next/link";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { listNotes } from "@/lib/content";

interface TagsPageProps {
  params: Promise<{ lexicon: string }>;
}

export default async function TagsPage({ params }: TagsPageProps) {
  const { lexicon: slug } = await params;
  const lexicon = await getLexiconBySlug(slug);
  if (!lexicon) notFound();

  const notes = await listNotes(lexiconS3Prefix(lexicon), lexicon.publishDefault);

  const tagMap = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }
  const tags = [...tagMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <main className="px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-10">Tags</h1>
      {tags.length === 0 ? (
        <p className="text-gray-500">No tags yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {tags.map(([tag, count]) => (
            <li key={tag}>
              <Link
                href={`/${slug}/tags/${encodeURIComponent(tag)}`}
                className="inline-flex items-center gap-2 rounded-full border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
              >
                {tag}
                <span className="text-gray-500 text-xs">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
