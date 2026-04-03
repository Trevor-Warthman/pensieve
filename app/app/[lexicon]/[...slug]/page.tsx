import { notFound } from "next/navigation";
import Link from "next/link";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { getNote, buildBacklinksIndex } from "@/lib/content";
import TableOfContents from "@/components/TableOfContents";

interface NotePageProps {
  params: Promise<{ lexicon: string; slug: string[] }>;
}

export default async function NotePage({ params }: NotePageProps) {
  const { lexicon: lexiconSlug, slug } = await params;

  const lexicon = await getLexiconBySlug(lexiconSlug);
  if (!lexicon) notFound();

  const s3Prefix = lexiconS3Prefix(lexicon);
  const decodedSlug = slug.map((s) => decodeURIComponent(s));
  const backlinksIndex = await buildBacklinksIndex(s3Prefix);
  const note = await getNote(s3Prefix, decodedSlug, backlinksIndex);
  if (!note) notFound();

  const showToc = note.headings.filter((h) => h.level <= 3).length >= 3;

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 dark:text-gray-500 mb-8 flex items-center gap-1.5 flex-wrap">
        <Link href={`/${lexiconSlug}`} className="hover:text-gray-900 dark:hover:text-gray-300 transition-colors">
          {lexicon.title}
        </Link>
        {decodedSlug.slice(0, -1).map((segment, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span>/</span>
            <Link
              href={`/${lexiconSlug}/${decodedSlug.slice(0, i + 1).join("/")}`}
              className="hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
            >
              {segment}
            </Link>
          </span>
        ))}
        <span>/</span>
        <span className="text-gray-400 dark:text-gray-400">{note.title}</span>
      </nav>

      {/* Content row: article + TOC */}
      <div className="flex gap-12 items-start">
        <div className="flex-1 min-w-0">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{note.title}</h1>

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <article
            className="prose prose-gray dark:prose-invert max-w-none
              prose-headings:font-semibold
              prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
              prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-800
              prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400
              prose-table:text-sm
              prose-th:text-gray-900 dark:prose-th:text-white prose-th:bg-gray-50 dark:prose-th:bg-gray-800
              prose-td:border-gray-200 dark:prose-td:border-gray-700"
            dangerouslySetInnerHTML={{ __html: note.html }}
          />

          {note.backlinks.length > 0 && (
            <aside className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Backlinks</h2>
              <ul className="space-y-2">
                {note.backlinks.map((bl) => (
                  <li key={bl}>
                    <Link
                      href={`/${lexiconSlug}/${bl}`}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {bl}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>

        {showToc && <TableOfContents headings={note.headings.filter((h) => h.level <= 3)} />}
      </div>
    </div>
  );
}
