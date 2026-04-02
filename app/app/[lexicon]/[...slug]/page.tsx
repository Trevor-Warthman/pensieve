import { notFound } from "next/navigation";
import Link from "next/link";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { getNote, buildBacklinksIndex } from "@/lib/content";

interface NotePageProps {
  params: Promise<{ lexicon: string; slug: string[] }>;
}

export default async function NotePage({ params }: NotePageProps) {
  const { lexicon: lexiconSlug, slug } = await params;

  const lexicon = await getLexiconBySlug(lexiconSlug);
  if (!lexicon) notFound();

  const s3Prefix = lexiconS3Prefix(lexicon);
  const backlinksIndex = await buildBacklinksIndex(s3Prefix);
  const note = await getNote(s3Prefix, slug, backlinksIndex);
  if (!note) notFound();

  return (
    <main className="flex min-h-screen flex-col px-6 py-16 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-8 flex items-center gap-2">
        <Link href={`/${lexiconSlug}`} className="hover:text-gray-300 transition-colors">
          {lexicon.title}
        </Link>
        {slug.slice(0, -1).map((segment, i) => (
          <span key={i} className="flex items-center gap-2">
            <span>/</span>
            <Link
              href={`/${lexiconSlug}/${slug.slice(0, i + 1).join("/")}`}
              className="hover:text-gray-300 transition-colors"
            >
              {segment}
            </Link>
          </span>
        ))}
        <span>/</span>
        <span className="text-gray-300">{note.title}</span>
      </nav>

      <h1 className="text-4xl font-bold text-white mb-10">{note.title}</h1>

      {note.tags.length > 0 && (
        <div className="flex gap-2 mb-8">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Rendered markdown */}
      <article
        className="prose prose-invert prose-gray max-w-none"
        dangerouslySetInnerHTML={{ __html: note.html }}
      />

      {note.backlinks.length > 0 && (
        <aside className="mt-16 pt-8 border-t border-gray-800">
          <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Backlinks</h2>
          <ul className="space-y-2">
            {note.backlinks.map((bl) => (
              <li key={bl}>
                <Link
                  href={`/${lexiconSlug}/${bl}`}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {bl}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  );
}
