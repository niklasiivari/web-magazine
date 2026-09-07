---
title: Markdown rendering reference
subtitle: CommonMark and GFM features used by the magazine layout.
author: Example author
issue: first-issue
order: 1
---

This article is a rendering fixture. It uses the Markdown features supported by
the template.

## Inline text

Use **bold**, *italic*, ***bold italic***, ~~strikethrough~~, [links](https://example.com),
inline `code`, and escaped characters such as \*literal asterisks\*.

## Lists

- Unordered item
  - Nested item
  - Another nested item
- Final unordered item

<!-- list-group-break -->

- Separate unordered list group
- Final item

1. Ordered item
2. Second item
   1. Nested ordered item
   2. Another nested item

- [x] Completed task
- [ ] Incomplete task

## Figures

![Small figure with an explicit right-side float](./sample-figure.svg "sm right")

The quoted Markdown image title controls figure size and, for non-full figures,
the side: `sm`, `md`, `lg`, `full`, `left`, and `right`.

![Medium figure with an explicit left-side float](./sample-figure.svg "md left")

This paragraph wraps beside the medium figure. Explicit `left` and `right`
values keep an image on the requested side in both article and page views.
Use the smaller sizes when there is enough adjacent prose to make the float
useful; a figure placed between two other figures has nothing to wrap.

![Large figure with an explicit right-side float](./sample-figure.svg "lg right")

This paragraph wraps beside the large figure. Larger figures leave a narrower
text measure, so `lg` works best with a short, deliberate passage such as this
one rather than dense body copy.

![Full-width figure](./sample-figure.svg "full")

## Quotations and signatures

> A quotation is an ordinary blockquote. It may run to several paragraphs and
> ends with a dash line naming its source.
>
> Second paragraph in the quote.
>
> — Example source

~ Example signature

## Code and tables

```ts
const issue = { title: "First Issue", order: 1 };
console.log(issue.title);
```

| Field | Type | Required |
| :---- | :--- | :------: |
| title | text | yes |
| order | number | yes |

---

## Footnotes

Footnotes are supported in prose.[^fixture]

[^fixture]: This note is rendered at the end of the article and paginated with the text.

## Sources

### Documentation

[CommonMark](https://commonmark.org/) defines the base Markdown syntax.

#### Additional syntax

[GitHub Flavored Markdown](https://github.github.com/gfm/) defines tables and task lists.
