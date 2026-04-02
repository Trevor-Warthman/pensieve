"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import type { GraphNode, GraphEdge } from "@/lib/content";

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lexiconSlug: string;
}

type SimNode = GraphNode & d3.SimulationNodeDatum;
type SimLink = d3.SimulationLinkDatum<SimNode>;

export default function GraphView({ nodes, edges, lexiconSlug }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const width = el.clientWidth || 800;
    const height = el.clientHeight || 600;

    const svg = d3.select(el);
    svg.selectAll("*").remove();

    const isDark = document.documentElement.classList.contains("dark");
    const colorNode = isDark ? "#6366f1" : "#4f46e5";
    const colorLink = isDark ? "#374151" : "#d1d5db";
    const colorLabel = isDark ? "#9ca3af" : "#6b7280";
    const colorHover = "#a5b4fc";

    const g = svg.append("g");

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (e) => g.attr("transform", e.transform))
    );

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges.map((e) => ({
      source: simNodes.find((n) => n.id === e.source)!,
      target: simNodes.find((n) => n.id === e.target)!,
    })).filter((l) => l.source && l.target);

    const link = g.append("g")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", colorLink)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.7);

    const node = g.append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer");

    node.append("circle")
      .attr("r", (d) => Math.max(5, Math.min(18, 5 + d.linkCount * 1.5)))
      .attr("fill", colorNode)
      .attr("stroke", isDark ? "#1e1b4b" : "#e0e7ff")
      .attr("stroke-width", 1.5);

    node.append("text")
      .attr("dy", (d) => Math.max(5, Math.min(18, 5 + d.linkCount * 1.5)) + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", colorLabel)
      .attr("pointer-events", "none")
      .text((d) => d.title.length > 22 ? d.title.slice(0, 20) + "…" : d.title);

    node.append("title").text((d) => d.title);

    node
      .on("mouseenter", function () {
        d3.select(this).select("circle").attr("fill", colorHover);
      })
      .on("mouseleave", function () {
        d3.select(this).select("circle").attr("fill", colorNode);
      })
      .on("click", (_, d) => {
        router.push(`/${lexiconSlug}/${d.id}`);
      });

    let simulation: d3.Simulation<SimNode, SimLink>;

    node.call(
      d3.drag<SVGGElement, SimNode>()
        .on("start", (e, d) => {
          if (!e.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (e, d) => {
          d.fx = e.x;
          d.fy = e.y;
        })
        .on("end", (e, d) => {
          if (!e.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(24))
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);
        node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, lexiconSlug, router]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: "transparent" }}
    />
  );
}
