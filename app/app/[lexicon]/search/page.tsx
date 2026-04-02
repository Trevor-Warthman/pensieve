import { notFound } from "next/navigation";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { buildSearchIndex } from "@/lib/content";
import SearchClient from "@/components/SearchClient";

interface SearchPageProps {
  params: Promise<{ lexicon: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { lexicon: slug } = await params;
  const { q } = await searchParams;

  const lexicon = await getLexiconBySlug(slug);
  if (!lexicon) notFound();

  const index = await buildSearchIndex(lexiconS3Prefix(lexicon), lexicon.publishDefault);

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Search</h1>
        <p className="text-sm text-gray-500 mt-1">{lexicon.title}</p>
      </div>
      <SearchClient index={index} lexiconSlug={slug} initialQuery={q ?? ""} />
    </main>
  );
}
