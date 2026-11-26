import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { cache } from "react";
import matter from "gray-matter";
import { renderMarkdown, type Heading } from "./markdown";
import type { SearchEntry } from "./reader-search";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(process.env.AWS_S3_ENDPOINT && {
    endpoint: process.env.AWS_S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
    },
  }),
});
const BUCKET = process.env.AWS_S3_BUCKET!;
const CLOUDFRONT_URL = process.env.NEXT_PUBLIC_CLOUDFRONT_URL ?? "";

export interface NoteMetadata {
  slug: string[];
  s3Key: string;
  title: string;
  publish: boolean;
  tags: string[];
  pin: boolean;
  pinOrder: number | null;
  bookmark: boolean;
  bookmarkFolder: string | null;
  frontmatter: Record<string, unknown>;
}

export interface RenderedNote extends NoteMetadata {
  html: string;
  headings: Heading[];
  backlinks: string[];
}

/** Hidden from reader discovery, but still reachable directly when published. */
export function isReaderVisible(note: { slug: string[] }): boolean {
  return !note.slug.some((segment) => /^(clade|claude)$/i.test(segment));
}

export interface GraphNode {
  id: string;
  title: string;
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface Manifest {
  version: number;
  notes: Array<{ slug: string; title: string; tags: string[]; content?: string; pin?: boolean; pinOrder?: number; bookmark?: boolean; bookmarkFolder?: string }>;
  backlinks: Record<string, string[]>;
  assets?: Record<string, string>; // lowercase basename → relative path
}

/** `bookmark: true` marks a note; `bookmark-folder` only applies when bookmark is true. */
function bookmarkFields(data: Record<string, unknown>): { bookmark: boolean; bookmarkFolder: string | null } {
  const bookmark = data.bookmark === true;
  const folder = data["bookmark-folder"];
  return { bookmark, bookmarkFolder: bookmark && typeof folder === "string" && folder.trim() ? folder.trim() : null };
}

const fetchText = cache(async (key: string): Promise<string> => {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return await res.Body!.transformToString("utf-8");
});


function keyToSlug(key: string, prefix: string): string[] {
  return key
    .slice(prefix.length)
    .replace(/\.md$/, "")
    .split("/")
    .filter(Boolean);
}

function parseYamlPublish(raw: string): boolean | undefined {
  const match = raw.match(/^\s*publish\s*:\s*(true|false)\s*$/m);
  if (!match) return undefined;
  return match[1] === "true";
}

/** Fetch and cache the manifest for a lexicon prefix (per-request deduplication via React cache). */
const fetchManifest = cache(async (prefix: string): Promise<Manifest | null> => {
  try {
    const key = `${prefix}_manifest.json`;
    const raw = await fetchText(key);
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
});

/** List all published notes. Uses manifest if available (1 S3 request), otherwise falls back to full scan. */
export const listNotes = cache(async (
  s3Prefix: string,
  publishDefault = true
): Promise<NoteMetadata[]> => {
  const prefix = s3Prefix.endsWith("/") ? s3Prefix : `${s3Prefix}/`;
  const manifest = await fetchManifest(prefix);

  if (manifest) {
    return manifest.notes.map((n) => ({
      slug: n.slug.split("/"),
      s3Key: `${prefix}${n.slug}.md`,
      title: n.title,
      publish: true,
      tags: n.tags,
      pin: n.pin ?? false,
      pinOrder: n.pinOrder ?? null,
      bookmark: n.bookmark ?? false,
      bookmarkFolder: n.bookmark ? n.bookmarkFolder ?? null : null,
      frontmatter: {},
    }));
  }

  // Legacy slow path: fetch every file to read frontmatter
  const folderDefaults = new Map<string, boolean>();
  const noteKeys: string[] = [];
  let token: string | undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token })
    );

    for (const obj of list.Contents ?? []) {
      if (!obj.Key) continue;
      if (obj.Key.endsWith("_folder.yaml")) {
        const raw = await fetchText(obj.Key);
        const pub = parseYamlPublish(raw);
        if (pub !== undefined) {
          const folderPrefix = obj.Key.slice(0, obj.Key.length - "_folder.yaml".length);
          folderDefaults.set(folderPrefix, pub);
        }
        continue;
      }
      if (!obj.Key.endsWith(".md")) continue;
      noteKeys.push(obj.Key);
    }

    token = list.NextContinuationToken;
  } while (token);

  const rawNotes = await mapWithConcurrency(noteKeys, 20, async (key) => ({ key, raw: await fetchText(key) }));
  const notes: NoteMetadata[] = [];
  for (const { key, raw } of rawNotes) {
    const { data } = matter(raw);
    let publish: boolean;
    if (data.publish !== undefined) {
      publish = data.publish !== false;
    } else {
      const keyFolder = key.slice(0, key.lastIndexOf("/") + 1);
      let folderPub: boolean | undefined;
      let bestLen = 0;
      for (const [fp, def] of folderDefaults) {
        if (keyFolder.startsWith(fp) && fp.length > bestLen) { folderPub = def; bestLen = fp.length; }
      }
      publish = folderPub ?? publishDefault;
    }
    if (!publish) continue;
    const slug = keyToSlug(key, prefix);
    notes.push({
      slug, s3Key: key,
      title: (data.title as string) ?? slug.at(-1) ?? "Untitled",
      publish, tags: Array.isArray(data.tags) ? data.tags : [],
      pin: data.pin === true,
      pinOrder: typeof data.pinOrder === "number" ? data.pinOrder : null,
      ...bookmarkFields(data),
      frontmatter: data,
    });
  }

  return notes;
});

/** Build backlinks index. Uses manifest if available (1 S3 request). */
const buildBacklinksIndex = cache(async (
  s3Prefix: string,
  publishDefault: boolean,
): Promise<Map<string, string[]>> => {
  const prefix = s3Prefix.endsWith("/") ? s3Prefix : `${s3Prefix}/`;
  const manifest = await fetchManifest(prefix);

  if (manifest) {
    const index = new Map<string, string[]>();
    for (const [target, sources] of Object.entries(manifest.backlinks)) {
      index.set(target, sources);
    }
    return index;
  }

  // Legacy slow path: fetch every file to scan wikilinks
  const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const index = new Map<string, string[]>();
  for (const note of await listNotes(s3Prefix, publishDefault)) {
    const { content } = matter(await fetchText(note.s3Key));
    const sourceSlug = note.slug.join("/");
    for (const match of content.matchAll(wikilinkRegex)) {
      const target = match[1].trim().toLowerCase();
      const existing = index.get(target) ?? [];
      if (!existing.includes(sourceSlug)) { existing.push(sourceSlug); index.set(target, existing); }
    }
  }

  return index;
});

/** Fetch and render a single note. */
export async function getNote(
  s3Prefix: string,
  slugPath: string[],
  publishDefault: boolean,
  lexiconSlug: string,
  readerId: Promise<string | null>,
  ownerId: string,
): Promise<RenderedNote | null> {
  const prefix = s3Prefix.endsWith("/") ? s3Prefix : `${s3Prefix}/`;
  let key = `${prefix}${slugPath.join("/")}.md`;
  const [direct, manifest] = await Promise.all([
    fetchText(key).catch((error: unknown) => {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
      throw error;
    }),
    fetchManifest(prefix),
  ]);
  let raw = direct;
  let notes: NoteMetadata[];
  if (raw === null) {
    notes = await listNotes(s3Prefix, publishDefault);
    // Next can pass encoded segments during client transitions, even when a
    // direct request supplies decoded segments. Try the canonical note path.
    const decoded = slugPath.map((segment) => {
      try { return decodeURIComponent(segment); } catch { return segment; }
    }).join("/");
    const safe = (slug: string) => slug.toLowerCase().replace(/[?#]/g, "");
    const matched = notes.find((note) => note.slug.join("/") === decoded) ??
      notes.find((note) => safe(note.slug.join("/")) === safe(decoded));
    if (!matched || matched.s3Key === key) return null;
    slugPath = matched.slug;
    key = matched.s3Key;
    try { raw = await fetchText(key); } catch { return null; }
  } else {
    notes = await listNotes(s3Prefix, publishDefault);
    if (!notes.some((note) => note.s3Key === key)) return null;
  }

  const { data, content } = matter(raw);
  if (data.publish === false) return null;

  const noteSlugMap = new Map<string, string>();
  for (const note of notes) {
    const slug = note.slug.join("/");
    const lowerSlug = slug.toLowerCase();
    const basename = lowerSlug.split("/").pop()!;
    noteSlugMap.set(lowerSlug, slug);
    if (!noteSlugMap.has(basename)) noteSlugMap.set(basename, slug);
  }

  const [backlinksIndex, userId] = await Promise.all([buildBacklinksIndex(s3Prefix, publishDefault), readerId]);
  const { html, headings } = await renderMarkdown(
    content,
    {
      cloudfrontUrl: CLOUDFRONT_URL,
      s3Prefix,
      assets: manifest?.assets,
      lexiconSlug,
      noteSlugMap,
    },
    { revealSecrets: userId === ownerId }
  );

  const slugStr = slugPath.join("/").toLowerCase();
  const backlinks = backlinksIndex.get(slugStr) ?? [];

  return {
    slug: slugPath,
    s3Key: key,
    title: (data.title as string) ?? slugPath.at(-1) ?? "Untitled",
    publish: true,
    tags: Array.isArray(data.tags) ? data.tags : [],
    pin: data.pin === true,
    pinOrder: typeof data.pinOrder === "number" ? data.pinOrder : null,
    ...bookmarkFields(data),
    frontmatter: data,
    html,
    headings,
    backlinks,
  };
}

/** Run `fn` over `items` with at most `limit` in flight at once.
 *  Unbounded Promise.all over hundreds of notes can overwhelm S3/MinIO
 *  connection pools and is actually slower than a modest batch size.
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/[*_~`]{1,3}/g, "")
    .replace(/>\s+/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

export async function buildSearchIndex(
  s3Prefix: string,
  publishDefault = true
): Promise<SearchEntry[]> {
  const prefix = s3Prefix.endsWith("/") ? s3Prefix : `${s3Prefix}/`;
  const notes = (await listNotes(s3Prefix, publishDefault)).filter(isReaderVisible);

  // Manifest (when present) already carries a stripped content excerpt per
  // note, computed once at sync time — avoids an S3 GET per note on every
  // /search request, which was the dominant cost on vaults with hundreds
  // of notes (~800 notes took 10-20s to render search with no caching).
  const manifest = await fetchManifest(prefix);
  const manifestContent = new Map<string, string>();
  if (manifest) {
    for (const n of manifest.notes) {
      if (n.content !== undefined) manifestContent.set(n.slug, n.content.replace(/%%[\s\S]*?(?:%%|$)/g, " ").trim());
    }
  }

  return mapWithConcurrency(notes, 20, async (note) => {
    const slugStr = note.slug.join("/");
    const cached = manifestContent.get(slugStr);
    if (cached !== undefined) {
      return { title: note.title, slug: slugStr, content: cached, tags: note.tags };
    }

    let rawContent = "";
    try {
      const raw = await fetchText(note.s3Key);
      const { content } = matter(raw);
      rawContent = stripMarkdown(content.replace(/%%[\s\S]*?(?:%%|$)/g, " ")).slice(0, 500);
    } catch { /* fall back to empty */ }

    return { title: note.title, slug: slugStr, content: rawContent, tags: note.tags };
  });
}

export async function buildGraphData(
  s3Prefix: string,
  publishDefault = true
): Promise<GraphData> {
  const prefix = s3Prefix.endsWith("/") ? s3Prefix : `${s3Prefix}/`;
  const notes = await listNotes(s3Prefix, publishDefault);

  // Backlink/wikilink targets are lowercased (case-insensitive matching per
  // Obsidian convention), but node ids must stay in canonical case since
  // GraphView navigates via `/${lexiconSlug}/${node.id}`. Resolve through
  // this lookup before touching nodeMap/edges.
  const canonicalSlug = new Map<string, string>();
  for (const n of notes) canonicalSlug.set(n.slug.join("/").toLowerCase(), n.slug.join("/"));

  const nodeMap = new Map<string, GraphNode>(
    notes.map((n) => [n.slug.join("/"), { id: n.slug.join("/"), title: n.title, linkCount: 0 }])
  );

  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  function addEdge(sourceRaw: string, targetRaw: string) {
    const sourceId = canonicalSlug.get(sourceRaw.toLowerCase());
    const target = canonicalSlug.get(targetRaw.toLowerCase());
    if (!sourceId || !target || target === sourceId) return;
    const key = `${sourceId}→${target}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ source: sourceId, target });
    nodeMap.get(sourceId)!.linkCount++;
    nodeMap.get(target)!.linkCount++;
  }

  const manifest = await fetchManifest(prefix);
  if (manifest) {
    // Manifest already encodes backlinks (target -> sources); no per-note S3 fetch needed.
    for (const [target, sources] of Object.entries(manifest.backlinks)) {
      for (const source of sources) addEdge(source, target);
    }
    return { nodes: Array.from(nodeMap.values()), edges };
  }

  // Legacy slow path: no manifest, scan every note's raw content for wikilinks.
  const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const noteContents = await mapWithConcurrency(notes, 20, async (note) => ({
    sourceId: note.slug.join("/"),
    content: (matter(await fetchText(note.s3Key))).content,
  }));

  for (const { sourceId, content } of noteContents) {
    wikilinkRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = wikilinkRegex.exec(content)) !== null) {
      addEdge(sourceId, match[1].trim());
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges };
}
