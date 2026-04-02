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

```
User's local notes directory (any markdown source)
    ↓
pensieve sync (CLI — diffs and uploads changed files)
    ↓
S3 bucket (per-Lexicon prefix, private)
    ↓
CloudFront (CDN layer — caches static assets)
    ↓
Lambda (API — auth, Lexicon config, publish filtering)
    ↓
Next.js frontend (renders public blog, no login to read)
```

### Services

| Service | Purpose |
|---|---|
| **AWS S3** | File storage — markdown, images, video, audio per Lexicon |
| **AWS CloudFront** | CDN — serves files cheaply, caches aggressively |
| **AWS Lambda** | API — serverless functions for all backend logic |
| **AWS DynamoDB** | Database — Lexicon metadata |
| **AWS Cognito** | Auth — user sign up / login, JWT tokens |
| **Next.js** | Frontend — renders Lexicons as public sites |
| **Pensieve CLI** | `pensieve sync ./dir --lexicon slug` — pushes local files to S3 |

### Data model

```
Lexicons  { lexiconId, userId, slug, title, publishDefault, createdAt }
Users     { userId, email, createdAt }   ← Cognito in prod, DynamoDB in local dev
```

### Visibility system

```yaml
# Per-file frontmatter
publish: true    # explicitly public
publish: false   # explicitly hidden
# omitted        # inherits folder default

# _folder.yaml (folder-level default)
publish: false   # hide entire folder unless a file overrides
```

### Repo structure

```
pensieve/
├── app/                  # Next.js frontend + local API routes
│   ├── app/
│   │   ├── [lexicon]/    # Public note pages
│   │   ├── dashboard/    # Manage Lexicons
│   │   ├── login/
│   │   ├── register/
│   │   └── api/          # Local dev API (auth + lexicons)
│   ├── lib/              # Content pipeline, DynamoDB, markdown
│   └── setup-local-db.mjs
├── lambda/               # Production Lambda handlers
│   └── src/
├── cli/                  # pensieve CLI
│   └── src/
├── infra/                # Terraform (AWS infra)
└── docker-compose.yml    # DynamoDB Local for dev
```

---

## Features

### MVP
- [ ] Pensieve CLI (`pensieve login`, `pensieve sync`)
- [ ] S3 upload with diffing (only changed files)
- [ ] User accounts via Cognito
- [ ] Create / manage Lexicons
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
- [ ] RSS feed per Lexicon
- [ ] Auto-rebuild trigger on S3 upload
- [ ] Lexicon custom domains

---

## Cost Estimate

Per Lexicon per month (~60GB: 10k markdown + 5k images + 1k videos/audio):

| Scenario | Storage | CloudFront egress | Other | **Total** |
|---|---|---|---|---|
| Low (100 visitors/mo) | $1.38 | ~$0.02 | ~$0 | **~$1.40** |
| Medium (1k visitors/mo) | $1.38 | ~$0.21 | ~$0 | **~$1.60** |
| High (10k visitors/mo) | $1.38 | ~$2.17 | ~$0 | **~$3.55** |

- Cognito: free up to 50k MAU
- DynamoDB + Lambda: effectively free at personal scale
- Tip: embed long-form video from YouTube/Vimeo — keeps egress near zero

---

## Docs

- [Local setup](local-setup.md) — install prerequisites, first-time machine setup
- [Development](development.md) — day-to-day workflow, running the app locally

---

## Progress

- **2026-03-29** — Repo created. Architecture decided.
- **2026-03-31** — Full implementation sprint: Next.js app, Terraform infra, Lambda API, CLI, content pipeline, core UI, search, Obsidian callouts, dashboard.
- **2026-04-01** — Local dev environment: DynamoDB Local, Next.js API routes replacing Lambda+Cognito, register page, environment-scoped Terraform resources.
