import { notFound } from "next/navigation";
import { getLexiconBySlug, lexiconS3Prefix } from "@/lib/db";
import { buildGraphData } from "@/lib/content";
import GraphView from "@/components/GraphView";

interface GraphPageProps {
  params: Promise<{ lexicon: string }>;
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { lexicon: slug } = await params;

  const lexicon = await getLexiconBySlug(slug);
  if (!lexicon) notFound();

  const graphData = await buildGraphData(lexiconS3Prefix(lexicon), lexicon.publishDefault);

  return (
    <main className="flex flex-col" style={{ height: "100dvh" }}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Graph</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {graphData.nodes.length} notes · {graphData.edges.length} links
          </p>
        </div>
        <p className="text-xs text-gray-500">Drag to move · Scroll to zoom · Click to open</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <GraphView
          nodes={graphData.nodes}
          edges={graphData.edges}
          lexiconSlug={slug}
        />
      </div>
    </main>
  );
}
