// @ts-check

import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import compress from "astro-compress";
import { rehypeMagazineBlocks } from "./src/lib/markdown-blocks.ts";
import { readerText, site } from "./src/lib/site.ts";

// Set SITE_URL in deployment so canonical URLs and the sitemap point at the
// publication, rather than this template placeholder.
const SITE = process.env.SITE_URL || "https://example.com";

export default defineConfig({
  site: SITE,
  // Astro/Vite already minifies the generated modules; astro-compress's
  // secondary Terser pass cannot parse the reader bundle and only emits a
  // misleading build error, so leave JavaScript compression to Vite.
  integrations: [mdx(), sitemap(), compress({ JavaScript: false })],
  output: "static",
  trailingSlash: "never",
  compressHTML: true,
  markdown: {
    // Upgrades plain Markdown images/blockquotes to the magazine's
    // floating figure/pullquote layout — see src/lib/markdown-blocks.ts.
    processor: unified({
      rehypePlugins: [rehypeMagazineBlocks],
      // Keep the static build's endnote label aligned with the starter UI.
      remarkRehype: {
        footnoteLabel: readerText(site.reader.defaultLanguage, "footnotes"),
        footnoteBackLabel: (
          /** @type {number} */ referenceIndex,
          /** @type {number} */ rereferenceIndex,
        ) =>
          `Back to reference ${referenceIndex + 1}${
            rereferenceIndex > 1 ? `-${rereferenceIndex}` : ""
          }`,
      },
    }),
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
