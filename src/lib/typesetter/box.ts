/**
 * Typesetting Box & Glue Primitives.
 *
 * Implements TeX-inspired layout abstractions:
 * - Box: Atomic or splittable rectangular content unit.
 * - Glue: Elastic spacing with natural size, stretchability, and shrinkability.
 * - Penalties: Aesthetic costs applied to breaking at candidate positions.
 */

export type BoxType =
  | "cover"
  | "toc-header"
  | "toc-item"
  | "article-header"
  | "heading"
  | "paragraph"
  | "figure"
  | "pullquote"
  | "list-item"
  | "signature"
  | "generic";

export interface Glue {
  natural: number;
  stretch: number;
  shrink: number;
}

export interface Box {
  el: HTMLElement;
  type: BoxType;
  naturalHeight: number;
  top: number;
  bottom: number;
  marginTop: number;
  marginBottom: number;
  glue: Glue;
  breakPenaltyAfter: number;
  isSplittable: boolean;
  isCoverPage?: boolean;
  isTocHeader?: boolean;
  isTocItem?: boolean;
  articleStart?: string;
  listTag?: "UL" | "OL";
  footnotes?: HTMLElement[];
  isFloat?: boolean;
  floatSide?: "left" | "right";
  floatZoneBottom?: number;
  isMajorHeading?: boolean;
  isSubheading?: boolean;
  isSourcesHeading?: boolean;
}

export interface PlacedUnit {
  el: HTMLElement;
  listTag?: "UL" | "OL";
  footnotes?: HTMLElement[];
  boxType?: BoxType;
}

export interface PageFrameData {
  cover?: HTMLElement;
  tocHeader?: HTMLElement;
  tocItems?: HTMLElement[];
  header?: HTMLElement;
  articleId?: string;
  articleTitle?: string;
  isCredits?: boolean;
  isArticleEnd?: boolean;
  footnotes?: HTMLElement[];
  units: PlacedUnit[];
  contentHeight: number;
  targetHeight: number;
  verticalSlack: number;
}

export interface PageMap {
  pages: PageFrameData[];
  articleIndex: Record<string, number>;
}
