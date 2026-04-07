import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import type { Plugin } from "unified";
import type { Root, Blockquote, Paragraph, Text } from "mdast";
import { visit } from "unist-util-visit";

interface MarkdownOptions {
  cloudfrontUrl: string;
  s3Prefix: string;
  assets?: Record<string, string>; // lowercase basename → relative path
  lexiconSlug?: string;
  noteSlugMap?: Map<string, string>; // lowercase key → canonical full slug path
}

export interface Heading {
  id: string;
  text: string;
  level: number;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function extractHastText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type: string; value?: string; children?: unknown[] };
  if (n.type === "text") return n.value ?? "";
  if (n.children) return n.children.map(extractHastText).join("");
  return "";
}

function makeRehypeHeadingIds(collected: Heading[]) {
  return () => (tree: unknown) => {
    visit(tree as never, "element", (node: unknown) => {
      const el = node as { tagName: string; properties: Record<string, unknown>; children: unknown[] };
      if (!/^h[1-6]$/.test(el.tagName)) return;
      const level = parseInt(el.tagName[1], 10);
      const text = extractHastText(el);
      const id = slugifyHeading(text) || `heading-${collected.length + 1}`;
      el.properties = { ...el.properties, id };
      collected.push({ id, text, level });
    });
  };
}

const IMAGE_EXTS = /\.(png|jpe?g|gif|svg|webp|avif|mp4|pdf)$/i;
const AUDIO_EXTS = /\.(mp3|wav|m4a|ogg|flac|aac|weba|opus)$/i;

/** Remark plugin: convert [[Wikilinks]] → <a> and ![[image.ext]] → <img> */
const remarkWikilinks: Plugin<[MarkdownOptions], Root> = (options) => {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      // Matches both ![[...]] (image embed) and [[...]] (link)
      const wikilinkRegex = /(!?)\[\[([^\]]+)\]\]/g;
      const text = node.value;
      if (!wikilinkRegex.test(text)) return;

      wikilinkRegex.lastIndex = 0;
      const children: Array<{ type: string; value?: string; url?: string; alt?: string; children?: unknown[] }> = [];
      let last = 0;
      let match: RegExpExecArray | null;

      while ((match = wikilinkRegex.exec(text)) !== null) {
        if (match.index > last) {
          children.push({ type: "text", value: text.slice(last, match.index) });
        }

        const [, bang, inner] = match;
        const [target, alias] = inner.split("|");
        const trimmedTarget = target.trim();

        if (bang === "!" && (IMAGE_EXTS.test(trimmedTarget) || AUDIO_EXTS.test(trimmedTarget))) {
          // Obsidian embed: ![[filename.ext]] — resolve via asset map
          const basename = trimmedTarget.split("/").pop()!.toLowerCase();
          const resolvedPath = options.assets?.[basename] ?? trimmedTarget;
          const s3Prefix = options.s3Prefix.endsWith("/")
            ? options.s3Prefix
            : `${options.s3Prefix}/`;
          const cfBase = options.cloudfrontUrl.replace(/\/$/, "");
          const src = `${cfBase}/${s3Prefix}${resolvedPath.replace(/^\//, "")}`;

          if (AUDIO_EXTS.test(trimmedTarget)) {
            children.push({
              type: "html",
              value: `<audio src="${src}" controls style="width:100%" />`,
            } as never);
          } else {
            // alias may be a pixel width: ![[img.png|400]]
            const widthNum = alias && /^\d+$/.test(alias.trim()) ? alias.trim() : null;
            const altText = widthNum ? basename : (alias?.trim() ?? basename);
            children.push({
              type: "html",
              value: `<img src="${src}" alt="${altText}"${widthNum ? ` width="${widthNum}"` : ""} style="max-width:100%" />`,
            } as never);
          }
        } else {
          // Regular wikilink → anchor
          // Resolve to an absolute path using the note slug map when available,
          // so links work correctly regardless of how deeply nested the current page is.
          let href: string;
          const { lexiconSlug, noteSlugMap } = options;
          if (lexiconSlug && noteSlugMap) {
            const normalizedTarget = trimmedTarget.toLowerCase();
            const basename = normalizedTarget.split("/").pop()!;
            const resolved =
              noteSlugMap.get(normalizedTarget) ?? noteSlugMap.get(basename);
            if (resolved) {
              href =
                "/" +
                [lexiconSlug, ...resolved.split("/")]
                  .map((s) => encodeURIComponent(s))
                  .join("/");
            } else {
              // Unknown target — keep relative so broken links are at least navigable
              href = trimmedTarget.split("/").map((s) => encodeURIComponent(s.trim())).join("/");
            }
          } else {
            href = trimmedTarget.split("/").map((s) => encodeURIComponent(s.trim())).join("/");
          }
          children.push({
            type: "link",
            url: href,
            children: [{ type: "text", value: (alias ?? trimmedTarget).trim() }],
          });
        }

        last = match.index + match[0].length;
      }

      if (last < text.length) {
        children.push({ type: "text", value: text.slice(last) });
      }

      if (parent && index !== undefined) {
        parent.children.splice(index, 1, ...(children as never[]));
      }
    });
  };
};

/** Remark plugin: convert Obsidian callout blocks to styled HTML
 *  Syntax: > [!note], > [!warning], > [!tip], > [!important], > [!caution]
 */
const CALLOUT_TYPES = new Set(["note", "tip", "info", "warning", "caution", "important", "danger", "success", "question", "bug", "example", "quote"]);

const remarkCallouts: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "blockquote", (node: Blockquote, index, parent) => {
      const firstPara = node.children[0];
      if (firstPara?.type !== "paragraph") return;

      const firstChild = firstPara.children[0];
      if (firstChild?.type !== "text") return;

      const match = firstChild.value.match(/^\[!([\w-]+)\]([+-]?)\s*(.*)?$/);
      if (!match) return;

      const [, calloutType, , titleOverride] = match;
      const type = calloutType.toLowerCase();
      if (!CALLOUT_TYPES.has(type)) return;

      const title = titleOverride?.trim() || (calloutType.charAt(0).toUpperCase() + calloutType.slice(1).toLowerCase());

      // Remove the [!type] line from the first paragraph
      const remainingText = firstChild.value.replace(/^\[![\w-]+\][+-]?\s*.*\n?/, "").trimStart();
      if (remainingText) {
        (firstChild as Text).value = remainingText;
      } else {
        firstPara.children.shift();
        if (firstPara.children.length === 0) node.children.shift();
      }

      // Rebuild as raw HTML node
      const innerMd = node.children
        .map((child) => {
          if (child.type === "paragraph") {
            return (child.children as Array<{ value?: string }>)
              .map((c) => c.value ?? "")
              .join("");
          }
          return "";
        })
        .filter(Boolean)
        .join("\n\n");

      const htmlNode = {
        type: "html",
        value: `<div class="callout callout-${type}" data-callout="${type}"><div class="callout-title">${title}</div><div class="callout-body">${innerMd}</div></div>`,
      };

      if (parent && index !== undefined) {
        parent.children.splice(index, 1, htmlNode as never);
      }
    });
  };
};

/** Rehype plugin: replace <iframe> embeds with a styled external link card.
 *  Browsers enforce X-Frame-Options / CSP frame-src from the target site;
 *  Electron (Obsidian) ignores those headers, so iframes appear to work there
 *  but fail in a real browser.  We surface the URL as a clickable card instead.
 */
function rehypeIframeFallback() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: unknown, index, parent: unknown) => {
      const el = node as { tagName: string; properties: Record<string, unknown> };
      if (el.tagName !== "iframe") return;
      const src = el.properties.src as string | undefined;
      if (!src) return;
      let hostname = src;
      try { hostname = new URL(src).hostname; } catch { /* keep raw */ }
      const replacement = {
        type: "element",
        tagName: "a",
        properties: {
          href: src,
          target: "_blank",
          rel: "noopener noreferrer",
          class: "iframe-link-card",
          style: "display:flex;align-items:center;gap:0.5rem;padding:0.75rem 1rem;border:1px solid #e5e7eb;border-radius:0.5rem;text-decoration:none;color:inherit;font-size:0.875rem;",
        },
        children: [
          { type: "element", tagName: "span", properties: {}, children: [{ type: "text", value: "🔗" }] },
          { type: "element", tagName: "span", properties: {}, children: [{ type: "text", value: hostname }] },
        ],
      };
      const p = parent as { children: unknown[] } | null;
      if (p && index !== undefined) {
        p.children.splice(index as number, 1, replacement);
      }
    });
  };
}

/** Rehype plugin: add target="_blank" rel="noopener noreferrer" to external links */
function rehypeExternalLinks() {
  return (tree: unknown) => {
    visit(tree as never, "element", (node: unknown) => {
      const el = node as { tagName: string; properties: Record<string, unknown> };
      if (el.tagName !== "a") return;
      const href = el.properties.href as string | undefined;
      if (href?.startsWith("http://") || href?.startsWith("https://")) {
        el.properties.target = "_blank";
        el.properties.rel = "noopener noreferrer";
      }
    });
  };
}

/** Remark plugin: rewrite relative image/asset paths to CloudFront URLs */
const remarkRewriteAssets: Plugin<[MarkdownOptions], Root> = ({ cloudfrontUrl, s3Prefix }) => {
  return (tree) => {
    visit(tree, "image", (node) => {
      if (!node.url.startsWith("http")) {
        node.url = `${cloudfrontUrl.replace(/\/$/, "")}/${s3Prefix.replace(/\/$/, "")}/${node.url.replace(/^\//, "")}`;
      }
    });
  };
};

export async function renderMarkdown(
  content: string,
  options: MarkdownOptions
): Promise<{ html: string; headings: Heading[] }> {
  const headings: Heading[] = [];
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCallouts)
    .use(remarkWikilinks, options)
    .use(remarkRewriteAssets, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeIframeFallback)
    .use(makeRehypeHeadingIds(headings))
    .use(rehypeExternalLinks)
    .use(rehypeStringify)
    .process(content);

  return { html: String(result), headings };
}
