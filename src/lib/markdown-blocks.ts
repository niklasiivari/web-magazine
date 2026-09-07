/**
 * Semantic Markdown processor for the magazine.
 *
 * Converts standard Markdown shapes (images, blockquotes, signatures)
 * into semantic magazine AST nodes (figures, pullquotes, signatures).
 *
 * Layout decisions (positioning, page breaks, elastic spacing) are intentionally
 * decoupled from AST generation and handled by the LaTeX-inspired typesetting
 * engine at runtime where font metrics and viewport geometries are known.
 */

import { readerLanguages, readerText } from "./site";

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

const isWhitespace = (node: HastNode) => node.type === "text" && !node.value?.trim();

const IMAGE_WEIGHTS = new Set(["sm", "md", "lg", "full"]);
const SIGNATURE_MARKER = "~ ";

function isImageOnlyParagraph(node: HastNode): boolean {
  if (node.type !== "element" || node.tagName !== "p" || !node.children) return false;
  const meaningful = node.children.filter((c) => !isWhitespace(c));
  return (
    meaningful.length === 1 && meaningful[0].type === "element" && meaningful[0].tagName === "img"
  );
}

function parseWeightAndSide(title?: string): { weight: string; side?: "left" | "right" } {
  if (!title) return { weight: "md", side: undefined };
  const tokens = title.toLowerCase().split(/\s+/);
  const weight = tokens.find((t) => IMAGE_WEIGHTS.has(t)) ?? "md";
  const explicitSide = tokens.find((t) => t === "left" || t === "right") as
    | "left"
    | "right"
    | undefined;
  const side = weight === "full" ? undefined : explicitSide;
  return { weight, side };
}

function figureFromImageParagraph(node: HastNode): HastNode {
  const img = node.children?.find((c) => c.type === "element" && c.tagName === "img");
  if (!img) return node;

  const title = typeof img.properties?.title === "string" ? img.properties.title : undefined;
  const { weight, side } = parseWeightAndSide(title);

  img.properties = {
    ...img.properties,
    loading: "eager",
    decoding: "async",
  };
  delete img.properties.title;

  const alt = typeof img.properties.alt === "string" ? img.properties.alt : "";
  const children: HastNode[] = [img];
  if (alt) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: { className: ["typeset-caption"] },
      children: [{ type: "text", value: alt }],
    });
  }

  const properties: Record<string, unknown> = {
    className: ["typeset-figure", "block"],
    "data-weight": weight,
  };
  if (side) {
    properties["data-side"] = side;
  }

  return {
    type: "element",
    tagName: "figure",
    properties,
    children,
  };
}

function isSignatureLine(node: HastNode): boolean {
  return (
    node.type === "element" &&
    node.tagName === "p" &&
    node.children?.[0]?.type === "text" &&
    (node.children[0].value?.startsWith(SIGNATURE_MARKER) ?? false)
  );
}

function decorateSignatureLine(node: HastNode): HastNode {
  const children = [...(node.children ?? [])];
  const text = children[0].value ?? "";
  children[0] = { ...children[0], value: text.slice(SIGNATURE_MARKER.length) };
  return {
    ...node,
    properties: {
      ...node.properties,
      className: ["typeset-signature"],
      "data-signature": "true",
    },
    children,
  };
}

function isCitationLine(node: HastNode): boolean {
  return (
    node.type === "element" &&
    node.tagName === "p" &&
    node.children?.length === 1 &&
    node.children[0].type === "text" &&
    (node.children[0].value?.startsWith("— ") ?? false)
  );
}

function textContent(node: HastNode): string {
  return node.type === "text"
    ? (node.value ?? "")
    : (node.children ?? []).map(textContent).join("");
}

function decorateBlockquote(node: HastNode): HastNode {
  const children = [...(node.children ?? [])];
  const lastMeaningful = [...children].reverse().find((c) => !isWhitespace(c));

  if (lastMeaningful && isCitationLine(lastMeaningful)) {
    const index = children.indexOf(lastMeaningful);
    const text = lastMeaningful.children?.[0]?.value ?? "";
    children[index] = {
      type: "element",
      tagName: "cite",
      properties: { className: ["typeset-cite"] },
      children: [{ type: "text", value: text.replace(/^—\s*/, "") }],
    };
  }

  return {
    ...node,
    properties: {
      ...node.properties,
      className: ["typeset-pullquote", "block"],
      "data-weight": "full",
    },
    children,
  };
}

const sourceHeadings = new Set(
  readerLanguages.map((language) => readerText(language, "sources").toLowerCase()),
);

function decorateSourceStructure(nodes: HastNode[]): HastNode[] {
  let inSources = false;

  return nodes.map((node) => {
    if (node.type !== "element") return node;

    const text = textContent(node).replace(/\s+/g, " ").trim().toLowerCase();
    if (node.tagName === "h2" && sourceHeadings.has(text)) {
      inSources = true;
      return {
        ...node,
        properties: { ...node.properties, "data-sources-heading": "true" },
      };
    }

    if (!inSources) return node;
    if (node.tagName === "h2") {
      inSources = false;
      return node;
    }

    if (node.tagName === "h3") {
      return {
        ...node,
        properties: { ...node.properties, "data-source-category": "true" },
      };
    }

    if (node.tagName === "h4") {
      return {
        ...node,
        properties: { ...node.properties, "data-source-group": "true" },
      };
    }

    if (node.tagName === "p") {
      return {
        ...node,
        properties: { ...node.properties, "data-source-entry": "true" },
      };
    }

    return node;
  });
}

export function rehypeMagazineBlocks() {
  return (tree: HastNode) => {
    if (!tree.children) return;

    // A `<!-- list-group-break -->` comment splits one Markdown list into
    // consecutive lists. Turn that semantic break into spacing on the final
    // item because pagination may combine the lists but preserves and measures
    // individual list items.
    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i];
      if (node.tagName !== "ul" && node.tagName !== "ol") continue;
      const previous = tree.children
        .slice(0, i)
        .reverse()
        .find((n) => n.type === "element");
      if (previous?.tagName !== node.tagName) continue;
      const lastItem = previous?.children?.findLast((n) => n.tagName === "li");
      if (lastItem) {
        lastItem.properties = { ...lastItem.properties, "data-list-group-end": "true" };
      }
    }

    let floatCount = 0;

    tree.children = decorateSourceStructure(tree.children).map((node) => {
      if (isSignatureLine(node)) return decorateSignatureLine(node);
      if (isImageOnlyParagraph(node)) {
        const fig = figureFromImageParagraph(node);
        if (fig.properties?.["data-weight"] !== "full") {
          if (!fig.properties?.["data-side"]) {
            fig.properties = {
              ...fig.properties,
              "data-side": floatCount % 2 === 0 ? "right" : "left",
            };
          }
          floatCount += 1;
        }
        return fig;
      }
      if (node.type === "element" && node.tagName === "blockquote") {
        return decorateBlockquote(node);
      }
      return node;
    });
  };
}
