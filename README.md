# Pensieve

> Pour your notes in. Let others walk through them.

A self-hosted, open-source alternative to [Obsidian Publish](https://obsidian.md/publish). Point Pensieve at a directory of markdown files and it becomes a navigable, beautiful blog or wiki — with full control over what's public and what stays hidden.

---

## Use Cases

- **DnD Campaign Blog** — Publish world lore, session recaps, NPCs, and locations for your players. Keep DM notes, future plot, and spoilers hidden with simple frontmatter flags.
- **Personal Blog / Digital Garden** — Publish a curated subset of your notes. If it's in the source directory with `publish: true`, it's live.

---

## Core Features (MVP)

- [ ] Render a directory of markdown files as a static site
- [ ] Obsidian-flavored markdown: wikilinks `[[Note]]`, callouts, image embeds
- [ ] Visibility control via frontmatter (`publish: true/false`)
- [ ] Folder-level visibility defaults with per-file overrides
- [ ] Navigation sidebar (folder tree)
- [ ] Backlinks panel
- [ ] Internal link resolution (`[[Page Title]]` → URL)
- [ ] Image and attachment handling
- [ ] Dark/light theme
- [ ] Client-side search
- [ ] Tag browsing

## Phase 2

- [ ] Multiple collections from one install (e.g. DnD blog + personal blog)
- [ ] Password protection for semi-private collections
- [ ] Interactive graph view (like Obsidian's)
- [ ] RSS feed
- [ ] Git-based auto-deploy (push notes → site rebuilds)

## Nice-to-Have

- [ ] Obsidian callout blocks
- [ ] Note transclusion (`![[Note]]`)
- [ ] Dataview-lite (frontmatter-driven tables)
- [ ] Mobile-responsive layout

---

## Architecture

**Stack**
- [Next.js](https://nextjs.org/) (App Router, SSG) — static output, fast, deployable anywhere
- [unified](https://unifiedjs.com/) / remark / rehype — markdown processing pipeline
  - `remark-wiki-link` for `[[wikilinks]]`
  - `remark-gfm` for tables, strikethrough
  - `rehype-highlight` for code blocks
- [Tailwind CSS](https://tailwindcss.com/) + CSS variables for theming
- [Pagefind](https://pagefind.app/) for zero-runtime static search

**Content model**

Pensieve is content-source agnostic. Point `pensieve.config.ts` at any local directory — how you get files there (git clone, rsync, cloud sync, manual copy) is up to you.

```
Markdown source directory
    ↓
Build-time ingestion (filters publish: true, resolves links)
    ↓
Next.js SSG → static HTML/JS
    ↓
Deploy anywhere (Vercel, Netlify, GitHub Pages, self-hosted)
```

**Visibility system**

```yaml
# Per-file frontmatter
publish: true    # explicitly public
publish: false   # explicitly hidden
# omitted = inherits folder default

# _folder.yaml (folder-level default)
publish: false   # hide entire folder unless overridden
```

**Planned repo structure**

```
pensieve/
├── app/                    # Next.js app router
│   ├── [slug]/             # Dynamic note pages
│   ├── tags/[tag]/         # Tag index pages
│   └── layout.tsx
├── components/             # Sidebar, Backlinks, SearchBar, GraphView...
├── lib/
│   ├── content.ts          # Source ingestion + publish filtering
│   ├── markdown.ts         # Remark/rehype pipeline
│   └── search.ts
├── content/                # Your markdown source (gitignored by default)
├── public/
└── pensieve.config.ts      # Source path, site title, collections config
```

---

## Open Questions

- [ ] Multi-collection support in MVP or Phase 2?
- [ ] SSG only, or SSR for live content updates?
- [ ] Auth for private pages — HTTP basic, simple password, or skip for now?

---

## Progress

- **2026-03-29** — Repo created. Stack and architecture decided. Starting scaffold.
