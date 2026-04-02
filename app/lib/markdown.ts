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

function makeRehypeHeadingIds(collected: Heading[]): Plugin<[], never> {
  return () => (tree) => {
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

/** Remark plugin: convert [[Wikilinks]] → <a> tags */
const remarkWikilinks: Plugin<[MarkdownOptions], Root> = (options) => {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
      const text = node.value;
      if (!wikilinkRegex.test(text)) return;

      wikilinkRegex.lastIndex = 0;
      const children: Array<{ type: string; value?: string; url?: string; children?: unknown[] }> = [];
      let last = 0;
      let match: RegExpExecArray | null;

      while ((match = wikilinkRegex.exec(text)) !== null) {
        if (match.index > last) {
          children.push({ type: "text", value: text.slice(last, match.index) });
        }

        const [, inner] = match;
        const [target, alias] = inner.split("|");
        const href = target.trim().toLowerCase().replace(/\s+/g, "-");

        children.push({
          type: "link",
          url: href,
          children: [{ type: "text", value: (alias ?? target).trim() }],
        });

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

/** Remark plugin: rewrite relative image/asset paths to CloudFront URLs */
const remarkRewriteAssets: Plugin<[MarkdownOptions], Root> = ({ cloudfrontUrl, s3Prefix }) => {
  return (tree) => {
    visit(tree, "image", (node) => {
      if (!node.url.startsWith("http")) {
        node.url = `${cloudfrontUrl}/${s3Prefix.replace(/\/$/, "")}/${node.url.replace(/^\//, "")}`;
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
    .use(makeRehypeHeadingIds(headings))
    .use(rehypeStringify)
    .process(content);

  return { html: String(result), headings };
}
