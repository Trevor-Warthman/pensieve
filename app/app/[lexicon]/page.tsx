import { notFound } from "next/navigation";
import Link from "next/link";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { listNotes } from "@/lib/content";

interface LexiconPageProps {
  params: Promise<{ lexicon: string }>;
}

export default async function LexiconPage({ params }: LexiconPageProps) {
  const { lexicon: slug } = await params;

  const lexicon = await getLexiconBySlug(slug);
  if (!lexicon) notFound();

  const notes = await listNotes(lexiconS3Prefix(lexicon));
  notes.sort((a, b) => a.slug.join("/").localeCompare(b.slug.join("/")));

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <div className="mb-10">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Lexicon</p>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{lexicon.title}</h1>
      </div>

      {notes.length === 0 ? (
        <p className="text-gray-500">No published notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.s3Key}>
              <Link
                href={`/${slug}/${note.slug.map((s) => encodeURIComponent(s)).join("/")}`}
                className="group flex flex-col gap-1 rounded-lg border border-gray-200 dark:border-gray-800 px-5 py-4 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <span className="text-gray-900 dark:text-white font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {note.title}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {note.slug.join("/")}
                  {note.tags.length > 0 && ` · ${note.tags.join(", ")}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
