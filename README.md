# Web Magazine Template

A static Astro/MDX magazine site with paginated and article reader modes.

## Configuration

- `src/lib/site.ts`: publication name, description, locale, reader languages, and reader UI copy.
- `SITE_URL`: canonical URL and sitemap origin.
- `src/content/`: issues, articles, credits, and local media.

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
```

## Content model

- `src/content/issues/<slug>.json` defines an issue.
- `src/content/articles/<issue>/<slug>.md` or `.mdx` defines an article. Its frontmatter
  links it to an issue and supplies its order.
- `src/content/credits/<issue>.md` is optional issue credits.

Issue metadata supports an optional local cover image. Place the cover beside
the issue JSON file and use a relative path:

```json
{
  "title": "Autumn 2026",
  "publishDate": "2026-09-07",
  "cover": "./autumn-2026-cover.jpg"
}
```

The cover is used in the issue archive and as the first page in Pages mode.
Use an A4-portrait image (`1:√2`; for example `1654 × 2339` pixels) so it
fills the reader page without letterboxing.

Articles use standard Markdown. Local images are placed beside the article and
referenced with a relative path. Image weights: `sm`, `md`, `lg`, `full`.

```markdown
---
title: A story title
subtitle: An optional deck.
author: Author name
issue: first-issue
order: 1
---

Article text.

![An accessible caption](./photo.jpg "lg")

> Pull quote.
>
> — Speaker
```

## MDX components

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

## Deployment

`pnpm build` writes the static site to `dist/`. The `Dockerfile` serves it on
port 8080.

```bash
docker build --build-arg SITE_URL=https://magazine.example -t magazine .
docker run --rm -p 8080:8080 magazine
```

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
