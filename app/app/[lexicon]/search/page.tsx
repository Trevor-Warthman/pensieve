import { notFound } from "next/navigation";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { buildSearchIndex } from "@/lib/content";
import SearchClient from "@/components/SearchClient";

interface SearchPageProps {
  params: Promise<{ lexicon: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { lexicon: slug } = await params;
  const { q } = await searchParams;

  const lexicon = await getLexiconBySlug(slug);
  if (!lexicon) notFound();

  const index = await buildSearchIndex(lexiconS3Prefix(lexicon), lexicon.publishDefault);

  const query = (Array.isArray(q) ? q[0] : q) ?? "";
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-6 border-b border-gray-200 pb-5 dark:border-gray-800">
        <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{lexicon.title}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-gray-900 dark:text-white">Search notes</h1>
      </header>
      <SearchClient key={query} index={index} lexiconSlug={slug} initialQuery={query} />
    </main>
  );
}
