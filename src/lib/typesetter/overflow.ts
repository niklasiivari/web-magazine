/**
 * Rendered-page overflow repair.
 *
 * The solver reasons about the master flow's geometry, where a float wraps
 * against whatever text happens to sit beside it in one tall column. A page
 * re-lays that float against a different neighbourhood — the text above it may
 * have gone to the previous page, the mobile stylesheet unfloats it entirely —
 * so a page the model believed fit can render taller than its frame and get
 * clipped. Rather than teach the solver float geometry, each solved page is
 * rendered into a hidden probe and measured for real; anything that overflows
 * gives its trailing units back to the next page until it fits.
 */

import type { PageFrameData, PageMap, PlacedUnit } from "./box";
import { buildPageFrame } from "./renderer";

const MAX_REPAIRS_PER_PAGE = 12;

type PageSide = "left" | "right" | "single";

function pageSideFor(pageMap: PageMap, index: number, isSpread: boolean): PageSide {
  if (!isSpread) return "single";
  if (pageMap.pages[0]?.cover) {
    if (index === 0) return "right";
    return (index - 1) % 2 === 0 ? "left" : "right";
  }
  return index % 2 === 0 ? "left" : "right";
}

/** Bottom-most edge of everything the frame paints, floats included. */
function contentBottom(frame: HTMLElement): number {
  let bottom = Number.NEGATIVE_INFINITY;
  for (const el of frame.querySelectorAll<HTMLElement>(
    ".reader-page > *, .prose > *, .footnotes > ol > li",
  )) {
    bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
  }
  return bottom;
}

function frameOverflow(frame: HTMLElement): number {
  const bottom = contentBottom(frame);
  if (!Number.isFinite(bottom)) return 0;
  const style = getComputedStyle(frame);
  const limit = frame.getBoundingClientRect().bottom - (parseFloat(style.paddingBottom) || 0);
  return Math.round(bottom - limit);
}

function refreshFootnotes(page: PageFrameData): void {
  const footnotes: HTMLElement[] = [];
  for (const unit of page.units) {
    for (const footnote of unit.footnotes ?? []) {
      if (!footnotes.includes(footnote)) footnotes.push(footnote);
    }
  }
  page.footnotes = footnotes.length > 0 ? footnotes : undefined;
}

function startsNewSection(page: PageFrameData | undefined, previous: PageFrameData): boolean {
  if (!page) return true;
  if (page.cover || page.tocHeader || page.tocItems || page.header) return true;
  return page.articleId !== previous.articleId;
}

/**
 * Moves one unit from `page` onto the following page of the same article,
 * inserting a fresh page when the next one belongs to something else.
 */
function pushLastUnitForward(pageMap: PageMap, index: number): PlacedUnit | null {
  const page = pageMap.pages[index];
  if (page.units.length <= 1) return null;
  const unit = page.units.pop();
  if (!unit) return null;

  // A heading belongs with the first unit it introduces. Rendering can reveal
  // extra float/footnote height after solving, so move the heading along when
  // overflow repair has to hand that opening unit to the next page.
  const headings: PlacedUnit[] = [];
  const movesHeadingChain =
    unit.boxType === "paragraph" || unit.boxType === "list-item" || unit.boxType === "figure";
  if (movesHeadingChain) {
    while (page.units.at(-1)?.boxType === "heading") {
      const heading = page.units.pop();
      if (heading) headings.unshift(heading);
    }
  }

  let next = pageMap.pages[index + 1];
  if (startsNewSection(next, page)) {
    next = {
      units: [],
      contentHeight: 0,
      targetHeight: page.targetHeight,
      verticalSlack: 0,
      articleId: page.articleId,
      articleTitle: page.articleTitle,
      isCredits: page.isCredits,
      isArticleEnd: page.isArticleEnd,
    };
    page.isArticleEnd = false;
    pageMap.pages.splice(index + 1, 0, next);
  }

  next.units.unshift(...headings, unit);
  refreshFootnotes(page);
  refreshFootnotes(next);
  return unit;
}

function reindexArticles(pageMap: PageMap): void {
  const index: Record<string, number> = {};
  pageMap.pages.forEach((page, pageIdx) => {
    if (page.header && page.articleId) index[page.articleId] = pageIdx;
  });
  pageMap.articleIndex = index;
}

/**
 * Measures every solved page as it will actually render and hands trailing
 * units forward until nothing is clipped. Pages are repaired front to back so
 * the content a page gives up is accounted for when its successor is measured.
 */
export function repairOverflowingPages(
  track: HTMLElement,
  pageMap: PageMap,
  pageHeight: number,
  isSpread: boolean,
): void {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;top:0;left:0;height:100%;visibility:hidden;pointer-events:none";
  track.appendChild(probe);

  const measure = (index: number): number => {
    const page = pageMap.pages[index];
    const side = pageSideFor(pageMap, index, isSpread);
    const spread = document.createElement("div");
    spread.className = `reader-spread ${isSpread ? "is-pair" : "is-single"}`;
    if (page.cover) spread.classList.add("reader-cover-spread");
    const frame = buildPageFrame(page, pageHeight, side, index + 1);
    if (side === "left") frame.classList.add("reader-left-page");
    if (side === "right") frame.classList.add("reader-right-page");
    spread.appendChild(frame);
    if (isSpread) {
      const filler = document.createElement("div");
      filler.className = `reader-page-frame reader-blank-page ${
        side === "left" ? "reader-right-page" : "reader-left-page"
      }`;
      spread.appendChild(filler);
    }
    probe.replaceChildren(spread);
    const overflow = frameOverflow(frame);
    probe.replaceChildren();
    return overflow;
  };

  try {
    for (let index = 0; index < pageMap.pages.length; index++) {
      const page = pageMap.pages[index];
      if (page.cover || page.tocHeader || page.tocItems) continue;
      if (page.units.length <= 1) continue;

      for (let repair = 0; repair < MAX_REPAIRS_PER_PAGE; repair++) {
        if (measure(index) <= 0) break;
        if (!pushLastUnitForward(pageMap, index)) break;
      }
    }
  } finally {
    probe.remove();
  }

  reindexArticles(pageMap);
}
