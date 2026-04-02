import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import matter from "gray-matter";
import { renderMarkdown } from "./markdown";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(process.env.AWS_S3_ENDPOINT && {
    endpoint: process.env.AWS_S3_ENDPOINT,
    forcePathStyle: true, // required for MinIO / local S3
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
  frontmatter: Record<string, unknown>;
}

export interface RenderedNote extends NoteMetadata {
  html: string;
  backlinks: string[];
}

async function fetchText(key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return await res.Body!.transformToString("utf-8");
}

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

/** List all published notes for a lexicon. publishDefault is the lexicon-level fallback. */
export async function listNotes(
  s3Prefix: string,
  publishDefault = true
): Promise<NoteMetadata[]> {
  const prefix = s3Prefix.endsWith("/") ? s3Prefix : `${s3Prefix}/`;
  const folderDefaults = new Map<string, boolean>();
  const rawNotes: Array<{ key: string; raw: string }> = [];
  let token: string | undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      })
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
      rawNotes.push({ key: obj.Key, raw: await fetchText(obj.Key) });
    }

    token = list.NextContinuationToken;
  } while (token);

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
        if (keyFolder.startsWith(fp) && fp.length > bestLen) {
          folderPub = def;
          bestLen = fp.length;
        }
      }
      publish = folderPub ?? publishDefault;
    }

    if (!publish) continue;

    const slug = keyToSlug(key, prefix);
    notes.push({
      slug,
      s3Key: key,
      title: (data.title as string) ?? slug.at(-1) ?? "Untitled",
      publish,
      tags: Array.isArray(data.tags) ? data.tags : [],
      frontmatter: data,
    });
  }

  return notes;
}

/** Build a map of targetSlug → [sourceSlug, ...] by parsing [[wikilinks]] across all notes. */
export async function buildBacklinksIndex(
  s3Prefix: string
): Promise<Map<string, string[]>> {
  const prefix = s3Prefix.endsWith("/") ? s3Prefix : `${s3Prefix}/`;
  const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const index = new Map<string, string[]>();
  let token: string | undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token })
    );

    for (const obj of list.Contents ?? []) {
      if (!obj.Key?.endsWith(".md")) continue;
      const raw = await fetchText(obj.Key);
      const { content } = matter(raw);
      const sourceSlug = keyToSlug(obj.Key, prefix).join("/");

      wikilinkRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = wikilinkRegex.exec(content)) !== null) {
        const target = match[1].trim().toLowerCase().replace(/\s+/g, "-");
        const existing = index.get(target) ?? [];
        if (!existing.includes(sourceSlug)) {
          existing.push(sourceSlug);
          index.set(target, existing);
        }
      }
    }

    token = list.NextContinuationToken;
  } while (token);

  return index;
}

/** Fetch and render a single note. Pass a backlinksIndex to populate backlinks. */
export async function getNote(
  s3Prefix: string,
  slugPath: string[],
  backlinksIndex?: Map<string, string[]>
): Promise<RenderedNote | null> {
  const prefix = s3Prefix.endsWith("/") ? s3Prefix : `${s3Prefix}/`;
  const key = `${prefix}${slugPath.join("/")}.md`;

  let raw: string;
  try {
    raw = await fetchText(key);
  } catch {
    return null;
  }

  const { data, content } = matter(raw);
  if (data.publish === false) return null;

  const html = await renderMarkdown(content, {
    cloudfrontUrl: CLOUDFRONT_URL,
    s3Prefix,
  });

  const slugStr = slugPath.join("/").toLowerCase();
  const backlinks = backlinksIndex?.get(slugStr) ?? [];

  return {
    slug: slugPath,
    s3Key: key,
    title: (data.title as string) ?? slugPath.at(-1) ?? "Untitled",
    publish: true,
    tags: Array.isArray(data.tags) ? data.tags : [],
    frontmatter: data,
    html,
    backlinks,
  };
}
