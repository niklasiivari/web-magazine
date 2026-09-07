# Web Magazine Template

A static Astro/MDX magazine with a typeset reader: a paginated "Pages" view
with real page breaks, floats and footnotes, and an "Articles" view with one
scrolling panel per article. Everything that makes a deployment a particular
publication lives in one file and the content directory.

## Requirements

- Node 22.12 or newer. CI and the Dockerfile use Node 26.
- pnpm at the version pinned in `package.json` (`packageManager`). Node 26 no
  longer ships Corepack, so install it directly: `npm install --global pnpm@<version>`.

```bash
pnpm install
pnpm dev                  # http://localhost:4321
pnpm check                # astro check + biome
pnpm build                # static site in dist/
pnpm preview
pnpm exec playwright install chromium
pnpm test:e2e             # browser test of the reader
```

## Configuration

`src/lib/site.ts` is the only file to edit for a new publication:

| Field | Purpose |
|---|---|
| `site.name`, `site.description` | Page titles, header, metadata |
| `site.locale` | Date formatting on the issue archive |
| `site.url` | Canonical URLs and sitemap. The `SITE_URL` build argument overrides it. |
| `site.reader.languages`, `defaultLanguage` | Languages offered by the reader's toggle and the one the static HTML is rendered in |
| `site.reader.storageKey` | Prefix of the localStorage keys holding a reader's saved view and language |
| `readerTranslations`, `readerLanguageNames` | Every string the UI shows, per language |

To add a language, add its code to `readerLanguages`, a full block to
`readerTranslations`, and its display name to `readerLanguageNames`. The type
checker will not let a key go missing.

A logo is optional. If `src/assets/logo.svg` exists it is inlined in the header
(use `fill="currentColor"` so it takes the theme colour); otherwise the header
shows `site.name` as text.

## Content model

Draft entries (`isDraft: true`) are excluded from the build.

`src/content/issues/<slug>.json`

```json
{
  "title": "Autumn 2026",
  "publishDate": "2026-09-07",
  "cover": "./autumn-2026-cover.jpg",
  "isDraft": false
}
```

The cover is optional. It is shown on the issue archive and as the first page
in Pages view; an A4-portrait image (`1:√2`, for example `1654 × 2339` pixels)
fills the page without letterboxing.

`src/content/articles/<issue>/<slug>.md` (or `.mdx`)

```markdown
---
title: A story title
subtitle: An optional deck.
author: Author name
issue: autumn-2026
order: 1
---
```

`order` sets the position in the table of contents and the reading sequence.
An optional `cover` image is shown on the standalone article page. Local
images live beside the article and are referenced with a relative path.

`src/content/credits/<issue>.md` is an optional credits page for the issue.
Its `title` defaults to the "credits" string of the default language.

## Writing

Articles are standard Markdown (CommonMark plus GFM tables, task lists and
footnotes). The layout engine recognises a few shapes:

| You write | You get |
|---|---|
| `![Caption](./photo.jpg "lg left")` | A figure. The quoted title takes a size (`sm`, `md`, `lg`, `full`) and, except for `full`, a side (`left`, `right`). Without a side, figures alternate. |
| A blockquote ending in a line `— Name` | A full-width pull quote with `Name` as its citation |
| A paragraph starting with `~ ` | A signature line |
| `text[^note]` and `[^note]: …` | Footnotes, set at the foot of the page in Pages view |
| A level-2 heading "Sources" (in any configured language) | The rest of the article is styled as a source list |
| `<!-- list-group-break -->` between two lists | Keeps them as separate lists |

Tables and nested lists are styled. `src/content/articles/first-issue/` is a
rendering fixture that exercises all of this; open it in the dev server to see
each shape.

Use `.mdx` only when an article needs a component. `EventSchedule` renders
structured event sections:

```mdx
import EventSchedule from "../../../components/blocks/EventSchedule.astro";

<EventSchedule
  sections={[
    {
      title: "September",
      events: [{ date: "12 Sep", name: "Opening event" }],
      note: "Optional note.",
    },
  ]}
/>
```

## The reader

Readers switch between Articles and Pages views and between UI languages from
the toolbar; both choices persist in localStorage. Arrow keys, swipe and the
progress bar navigate. Pages view is typeset in the browser from a hidden copy
of the issue, so page breaks, floats and footnotes are decided against real
rendered text — see `src/lib/typesetter/`.

## Continuous integration

`.github/workflows/check.yml` runs on pushes to `main`, pull requests and
weekly:

- `check`: `pnpm check` and `pnpm build`.
- `browser`: the Playwright test against the production build.
- `go`: gofmt, `go vet` and govulncheck on the server.
- `audit`: `pnpm audit --prod` is blocking. The full-tree audit is advisory,
  because the dev dependencies (the Astro type checker, the compressor)
  routinely carry high-severity advisories in transitive packages that never
  ship and cannot be fixed from here. A fresh `pnpm audit` locally will show
  those; `pnpm audit --prod` is the one that matters.
- `container`: builds the image and smoke-tests it (index, styled 404,
  security headers, health check).

`.github/workflows/codeql.yml` analyses the TypeScript and Go weekly and on
every change. `renovate.json` configures dependency updates for
[Renovate](https://github.com/apps/renovate); install the app on your fork to
enable them.

## Deployment

`pnpm build` writes the static site to `dist/`. The `Dockerfile` builds it
and serves it with a small Go server on port 8080 from a `scratch` image: clean
URLs, the styled 404 page, immutable caching for hashed assets, and
`X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` headers.
`/app/server -healthcheck` exits non-zero when the server is not answering.

```bash
docker build --build-arg SITE_URL=https://magazine.example -t magazine .
docker run --rm -p 8080:8080 magazine
```

## License

MIT. See [LICENSE](LICENSE).
