# Pensieve

> Pour your notes in. Let others walk through them.

A self-hosted markdown blog platform. Point Pensieve at a directory of markdown files and it becomes a navigable, beautiful blog or wiki — with full control over what's public and what stays hidden.

Source-agnostic: works with Obsidian, Bear, README wikis, or any folder of `.md` files.

---

## Concepts

- **Lexicon** — a user's collection of published notes (a blog, a wiki, a DnD campaign site). One user can have many Lexicons.
- **Publish flag** — frontmatter field (`publish: true/false`) controlling per-file visibility. Folders have defaults, files can override.

## Use Cases

- **DnD Campaign Blog** — publish world lore, session recaps, NPCs, locations for players. Keep DM notes and spoilers hidden.
- **Personal Blog / Digital Garden** — publish a curated subset of your notes.

---

## Architecture

### Services

| Service | Purpose |
|---|---|
| **AWS S3** | File storage — markdown, images, video, audio per Lexicon |
| **AWS CloudFront** | CDN — serves files cheaply, caches aggressively |
| **AWS Lambda** | API — serverless functions for all backend logic |
| **AWS DynamoDB** | Database — user accounts, Lexicon metadata, configs |
| **AWS Cognito** | Auth — user sign up / login, JWT tokens |
| **Next.js** | Frontend — renders Lexicons as public static sites |
| **Pensieve CLI** | `pensieve sync ./dir --lexicon slug` — pushes local files to S3 |

### How it works

```
User's local notes directory (any markdown source)
    ↓
pensieve sync (CLI — diffs and uploads changed files)
    ↓
S3 bucket (Pensieve-managed, private, per-Lexicon prefix)
    ↓
CloudFront (CDN layer — caches static assets)
    ↓
Lambda (API — handles auth, Lexicon config, publish filtering)
    ↓
Next.js frontend (renders public blog, no login to read)
```

### Data model (DynamoDB)

```
Users         { userId, email, createdAt }
Lexicons      { lexiconId, userId, slug, title, publish_default, createdAt }
```

### Visibility system

```yaml
# Per-file frontmatter
publish: true    # explicitly public
publish: false   # explicitly hidden
# omitted = inherits folder default

# _folder.yaml (folder-level default)
publish: false   # hide entire folder unless overridden per-file
```

### Repo structure (planned)

```
pensieve/
├── app/                        # Next.js frontend
│   ├── [lexicon]/[slug]/       # Public note pages
│   ├── dashboard/              # User dashboard (manage Lexicons)
│   └── layout.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── Backlinks.tsx
│   ├── SearchBar.tsx
│   └── GraphView.tsx
├── lib/
│   ├── content.ts              # S3 ingestion + publish filtering
│   ├── markdown.ts             # Remark/rehype pipeline
│   └── links.ts                # Wikilink resolution + backlink index
├── lambda/                     # Lambda function handlers
│   ├── auth.ts
│   ├── lexicons.ts
│   └── sync.ts
├── cli/                        # pensieve CLI tool
│   └── index.ts
├── infra/                      # IaC (CDK or SAM)
└── pensieve.config.ts
```

---

## Features

### MVP
- [ ] Pensieve CLI (`pensieve login`, `pensieve sync`)
- [ ] S3 upload with diffing (only changed files)
- [ ] User accounts via Cognito
- [ ] Create / manage Lexicons (DynamoDB)
- [ ] Next.js frontend rendering a Lexicon as a public site
- [ ] Obsidian-flavored markdown: wikilinks `[[Note]]`, callouts, embeds
- [ ] `publish: true/false` frontmatter filtering
- [ ] Folder-level visibility defaults
- [ ] Navigation sidebar (folder tree)
- [ ] Backlinks panel
- [ ] Internal link resolution
- [ ] Image + attachment serving via CloudFront
- [ ] Dark/light theme
- [ ] Client-side search (Pagefind)
- [ ] Tag browsing

### Phase 2
- [ ] Graph view (interactive backlink graph)
- [ ] Multiple Lexicons per user
- [ ] RSS feed per Lexicon
- [ ] Auto-rebuild trigger on S3 upload
- [ ] Lexicon custom domains

### Nice-to-have
- [ ] Note transclusion (`![[Note]]`)
- [ ] Dataview-lite (frontmatter-driven tables)
- [ ] Obsidian callout blocks
- [ ] Mobile-responsive layout
- [ ] Obsidian plugin for one-click sync

---

## Cost Estimate

Per Lexicon per month (assuming ~60GB: 10k markdown + 5k images + 1k videos/audio):

| Scenario | Storage | CloudFront egress | Other | **Total** |
|---|---|---|---|---|
| Low (100 visitors/mo) | $1.38 | ~$0.02 | ~$0 | **~$1.40** |
| Medium (1k visitors/mo) | $1.38 | ~$0.21 | ~$0 | **~$1.60** |
| High (10k visitors/mo) | $1.38 | ~$2.17 | ~$0 | **~$3.55** |

- **Cognito**: free up to 50k MAU
- **DynamoDB**: free tier covers personal-scale easily
- **Lambda**: 1M free requests/month, ~$0 for personal use
- **Tip**: offload long-form video to YouTube/Vimeo and embed — keeps egress costs near zero

---

## Open Questions

- [ ] SSG (rebuild on sync) vs SSR (always fresh)? — leaning SSG + rebuild trigger
- [ ] IaC tool — CDK or SAM?
- [ ] CLI distribution — npm package or standalone binary?

---

## Next Steps

- [ ] **1. Scaffold Next.js app** — basic app router setup, Tailwind, placeholder pages
- [ ] **2. AWS infra setup** — S3 bucket, CloudFront distribution, DynamoDB tables, Cognito user pool (CDK stack)
- [ ] **3. Lambda API** — Cognito auth endpoints, Lexicon CRUD
- [ ] **4. CLI skeleton** — `pensieve login` + `pensieve sync` wired to Lambda + S3
- [ ] **5. Content pipeline** — S3 ingestion → remark/rehype → rendered pages
- [ ] **6. Publish filtering** — frontmatter parsing, folder defaults
- [ ] **7. Core UI** — sidebar, note page, backlinks
- [ ] **8. Search** — Pagefind integration
- [ ] **9. End-to-end test** — sync a real vault, browse the result

---

## Progress

- **2026-03-29** — Repo created (was "Lantern", renamed Pensieve). Architecture decided. README written.
