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
    <main className="flex min-h-screen flex-col px-6 py-16 max-w-4xl mx-auto">
      <div className="mb-10">
        <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">Lexicon</p>
        <h1 className="text-4xl font-bold text-white">{lexicon.title}</h1>
      </div>

      {notes.length === 0 ? (
        <p className="text-gray-500">No published notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.s3Key}>
              <Link
                href={`/${slug}/${note.slug.join("/")}`}
                className="group flex flex-col gap-1 rounded-lg border border-gray-800 px-5 py-4 hover:border-gray-600 transition-colors"
              >
                <span className="text-white font-medium group-hover:text-gray-100">
                  {note.title}
                </span>
                {note.tags.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {note.tags.join(", ")}
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
