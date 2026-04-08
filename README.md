# Pensieve

> Pour your notes in. Let others walk through them.

A self-hosted markdown blog platform. Point Pensieve at a directory of markdown files and it becomes a navigable, beautiful blog or wiki — with full control over what's public and what stays hidden.

Source-agnostic: works with Obsidian, Bear, README wikis, or any folder of `.md` files.

---

## Installation

Install the CLI globally via npm:

```bash
npm install -g pensieve-markdown
```

### Requirements

- Node.js 18+
- A deployed Pensieve instance (see [infra/](infra/) for Terraform setup)

---

## CLI Usage

### First-time setup

Point the CLI at your Pensieve API and configure credentials:

```bash
# Load all settings automatically from Terraform outputs
pensieve config init --from-terraform ./infra

# Or set the API endpoint manually
pensieve config init --api-endpoint https://<api-gateway-id>.execute-api.us-east-1.amazonaws.com
```

### Authentication

```bash
pensieve register          # Create a new Pensieve account
pensieve login             # Log in to your Pensieve account
pensieve logout            # Clear stored credentials
```

### Syncing your vault

```bash
pensieve sync ./notes --lexicon my-blog   # Sync a local directory to a Lexicon
```

`sync` diffs your local files against what's already in S3 and only uploads changed files. It respects `publish: true/false` frontmatter and `pensieve.yaml` directory rules.

### Managing publish rules

```bash
pensieve publish notes/public             # Mark a directory as published in pensieve.yaml
pensieve unpublish notes/drafts           # Mark a directory as unpublished in pensieve.yaml
```

Changes take effect on the next `pensieve sync`.

### Config management

```bash
pensieve config show                      # Show the current saved config
pensieve config init --from-terraform     # Reload config from Terraform outputs
```

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
- [x] Pensieve CLI (`pensieve login`, `pensieve sync`)
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

## Future

Ideas beyond Phase 2, loosely prioritized.

### Content & Discovery
- [ ] Full-text search with Fuse.js *(MVP gap — Pagefind listed in MVP but not wired at runtime)*
- [ ] Table of contents sidebar for long notes
- [ ] Note changelog / revision history (last-updated timestamp surfaced in UI)
- [ ] Graph view — interactive backlink/link graph (D3) *(Phase 2)*
- [ ] RSS feed per Lexicon *(Phase 2)*

### Publishing & Authoring
- [ ] Web-based editor — edit notes in-browser, no local files required
- [ ] Drag-and-drop file upload in dashboard
- [ ] Publish toggle from the UI (flip `publish:` without editing frontmatter)
- [ ] Scheduled publishing (`publish_at` date in frontmatter)
- [ ] Draft preview links — shareable private URL before publishing

### Lexicon Customization
- [ ] Custom domains per Lexicon *(Phase 2 — see [Blog Spaces & Domains](#blog-spaces--domains))*
- [ ] Custom CSS / theme overrides
- [ ] Lexicon homepage with a pinned/featured note
- [ ] Custom navigation links (external links in sidebar)
- [ ] Per-Lexicon font/color scheme picker
- [ ] Password-protected Lexicons (shared secret, no reader account needed)

### Collaboration
- [ ] Comments on notes (Giscus/GitHub Discussions or native)
- [ ] Invite collaborators to a Lexicon (multiple syncing users)
- [ ] Reader accounts (private Lexicons visible only to specific users)

### Integrations
- [ ] Auto-rebuild trigger on S3 upload *(Phase 2)*
- [ ] GitHub Actions integration — auto-sync on push to a repo
- [ ] Obsidian plugin — sync directly from within Obsidian, no CLI
- [ ] Bear / Notion / Logseq import
- [ ] Webhook on publish (notify Slack, Discord, etc.)

### Analytics & Growth
- [ ] Per-Lexicon page view stats (privacy-respecting, no cookies)
- [ ] Popular notes / trending content widget
- [ ] Email newsletter integration (send new notes to subscribers)
- [ ] Sitemap + SEO metadata generation

### Developer / Power User
- [ ] `pensieve status` — show which files are unpublished, drifted, or missing
- [ ] `pensieve diff` — dry-run preview before syncing
- [ ] Bring-your-own S3 bucket (point at your own AWS account)
- [ ] Self-hosted mode — Docker Compose for the full stack, no AWS

---

## Blog Spaces & Domains

### URL structure

Three options for Lexicons hosted on Pensieve's own domain:

| Scheme | Example | Notes |
|---|---|---|
| `username.pensieve.app/lexicon-slug` | `trevor.pensieve.app/dnd-wiki` | Subdomain per user; multiple Lexicons via path. Clean separation. |
| `lexicon-slug.pensieve.app` | `dnd-wiki.pensieve.app` | Subdomain per Lexicon; slug must be globally unique. |
| `pensieve.app/username/lexicon-slug` | `pensieve.app/trevor/dnd-wiki` | GitHub-style paths; no subdomain wildcard needed. |

**Recommendation: `username.pensieve.app/lexicon-slug`**

Users can have many Lexicons (DnD wiki, personal blog, work notes). Scoping subdomains to the user lets them own a clean namespace (`trevor.pensieve.app`) while keeping multiple Lexicons at readable paths underneath it. It also maps cleanly to custom domains — a user with `myblog.com` CNAMEs it to their Pensieve subdomain and all their Lexicons follow.

### Custom domains

A user with `myblog.com` CNAMEs the domain to Pensieve's CloudFront distribution. Pensieve maps the `Host` header to the correct Lexicon. TLS is provisioned via ACM DNS validation (user adds one CNAME record). This is the "Custom domains per Lexicon" Phase 2 item.

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
