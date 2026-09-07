import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const issues = defineCollection({
  loader: glob({ pattern: "*.json", base: "src/content/issues" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      publishDate: z.coerce.date(),
      cover: image().optional(),
      isDraft: z.boolean().default(false),
    }),
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/articles" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      author: z.string().optional(),
      issue: reference("issues"),
      order: z.number().default(0),
      cover: image().optional(),
      isDraft: z.boolean().default(false),
    }),
});

const credits = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "src/content/credits" }),
  schema: z.object({
    title: z.string().default("Credits"),
    issue: reference("issues"),
    isDraft: z.boolean().default(false),
  }),
});

export const collections = { issues, articles, credits };
