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
  const maxCount = Math.max(1, ...tags.map(([, count]) => count));

  // Scale text size by frequency -- the tag cloud's own shape becomes the
  // at-a-glance summary of what this lexicon is actually about.
  function sizeClass(count: number): string {
    const ratio = count / maxCount;
    if (ratio > 0.66) return "text-lg";
    if (ratio > 0.33) return "text-base";
    return "text-sm";
  }

  return (
    <main className="px-6 py-16 max-w-4xl mx-auto">
      <h1 className="font-display text-3xl font-semibold text-gray-900 dark:text-white mb-10">Tags</h1>
      {tags.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No tags yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2.5 items-baseline">
          {tags.map(([tag, count]) => (
            <li key={tag}>
              <Link
                href={`/${slug}/tags/${encodeURIComponent(tag)}`}
                className={`tag-pill ${sizeClass(count)}`}
              >
                {tag}
                <span className="text-amber-600/70 dark:text-amber-400/60 text-[0.7em]">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
