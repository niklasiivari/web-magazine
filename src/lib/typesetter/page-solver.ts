/**
 * LaTeX-Inspired Page Solver.
 *
 * Implements a badness-and-penalty optimization page-builder:
 * - Floating figures & pullquotes allow text to flow naturally beside them.
 * - Floats and their wrapping text are kept together on pages.
 * - Splittable paragraphs fill remaining page budget with orphan/widow guarantees.
 * - Underfull page badness prevents unwanted empty space at the bottom of pages.
 * - Enforces hard page breaks on article boundaries (\clearpage).
 */

import type { Box, BoxType, PageFrameData, PageMap } from "./box";
import { measurePageFootnotes } from "./footnotes";
import { type ParagraphSplit, splitParagraph } from "./paragraph";
import {
  BADNESS_SCALE,
  MAJOR_HEADING_FREE_BREAK_FILL,
  MAJOR_HEADING_MIN_ROOM,
  MAJOR_HEADING_MIN_ROOM_OPENING,
  ORPHAN_TAIL_MIN,
  PENALTY_AFTER_ARTICLE_HEADER,
  PENALTY_AFTER_FLOAT,
  PENALTY_AFTER_HEADING,
  PENALTY_INSIDE_SIGNATURE,
  PENALTY_ORPHAN_TAIL,
  PENALTY_PARAGRAPH_SPLIT,
  PENALTY_SPREAD_IMBALANCE,
  SUBHEADING_MIN_ROOM,
} from "./penalties";

const FOOTNOTE_METRICS = new WeakMap<HTMLElement, number>();
const DEFAULT_FOOTNOTE_CHROME = 24;
// Rule + padding above the page's footnote block, measured from the live
// stylesheet during collection so the reserve matches what gets rendered.
let footnoteChrome = DEFAULT_FOOTNOTE_CHROME;

function classifyElement(el: HTMLElement): BoxType {
  if (el.classList.contains("reader-cover-page")) return "cover";
  if (el.classList.contains("reader-toc-header")) return "toc-header";
  if (el.classList.contains("reader-article-header")) return "article-header";
  if (el.dataset.signature === "true" || el.classList.contains("typeset-signature"))
    return "signature";
  if (/^H[1-6]$/.test(el.tagName)) return "heading";
  if (el.tagName === "FIGURE") return "figure";
  if (el.tagName === "BLOCKQUOTE") return "pullquote";
  if (el.tagName === "P") return "paragraph";
  if (el.tagName === "LI") return "list-item";
  return "generic";
}

function footnoteReferences(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]"))
    .map((link) => link.getAttribute("href")?.slice(1))
    .filter((id): id is string => Boolean(id));
}

function footnotesForElement(
  el: HTMLElement,
  definitions: Map<string, HTMLElement>,
): HTMLElement[] {
  return footnoteReferences(el)
    .map((id) => definitions.get(id))
    .filter((definition): definition is HTMLElement => Boolean(definition));
}

function footnotesFromCandidates(el: HTMLElement, candidates: HTMLElement[]): HTMLElement[] {
  const references = new Set(footnoteReferences(el));
  return candidates.filter((candidate) => references.has(candidate.id));
}

function uniqueFootnotes(boxes: Box[], start: number, end: number): HTMLElement[] {
  const result: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (let index = start; index < end; index++) {
    for (const footnote of boxes[index].footnotes ?? []) {
      if (!seen.has(footnote)) {
        seen.add(footnote);
        result.push(footnote);
      }
    }
  }
  return result;
}

function footnoteHeight(footnotes: HTMLElement[]): number {
  if (footnotes.length === 0) return 0;
  return (
    footnoteChrome +
    footnotes.reduce((height, footnote) => {
      return height + (FOOTNOTE_METRICS.get(footnote) ?? footnote.getBoundingClientRect().height);
    }, 0)
  );
}

export function collectMasterBoxes(masterFlow: HTMLElement): Box[] {
  const boxes: Box[] = [];
  const flowRect = masterFlow.getBoundingClientRect();
  const flowTop = flowRect.top;

  const round = (n: number) => Math.round(n);
  const removedFootnoteSections: Array<{
    prose: HTMLElement;
    section: HTMLElement;
    nextSibling: ChildNode | null;
  }> = [];

  // 1. Cover Page
  const cover = masterFlow.querySelector<HTMLElement>(".reader-cover-page");
  if (cover) {
    const r = cover.getBoundingClientRect();
    boxes.push({
      el: cover,
      type: "cover",
      naturalHeight: round(r.height),
      top: round(r.top - flowTop),
      bottom: round(r.bottom - flowTop),
      marginTop: 0,
      marginBottom: 0,
      glue: { natural: 0, stretch: 0, shrink: 0 },
      breakPenaltyAfter: 0,
      isSplittable: false,
      isCoverPage: true,
    });
  }

  // 2. Table of Contents
  const tocPage = masterFlow.querySelector<HTMLElement>(".reader-toc-page");
  if (tocPage) {
    const tocHeader = tocPage.querySelector<HTMLElement>(".reader-toc-header");
    if (tocHeader) {
      const r = tocHeader.getBoundingClientRect();
      boxes.push({
        el: tocHeader,
        type: "toc-header",
        naturalHeight: round(r.height),
        top: round(r.top - flowTop),
        bottom: round(r.bottom - flowTop),
        marginTop: 0,
        marginBottom: 0,
        glue: { natural: 0, stretch: 0, shrink: 0 },
        breakPenaltyAfter: PENALTY_AFTER_HEADING,
        isSplittable: false,
        isTocHeader: true,
      });
    }

    const tocList = tocPage.querySelector<HTMLElement>(".toc");
    if (tocList) {
      for (const li of Array.from(tocList.children) as HTMLElement[]) {
        const r = li.getBoundingClientRect();
        boxes.push({
          el: li,
          type: "toc-item",
          naturalHeight: round(r.height),
          top: round(r.top - flowTop),
          bottom: round(r.bottom - flowTop),
          marginTop: 0,
          marginBottom: 0,
          glue: { natural: 0, stretch: 0, shrink: 0 },
          breakPenaltyAfter: 0,
          isSplittable: false,
          isTocItem: true,
        });
      }
    }
  }

  // 3. Articles
  try {
    for (const article of Array.from(masterFlow.querySelectorAll<HTMLElement>(".reader-article"))) {
      const header = article.querySelector<HTMLElement>(".reader-article-header");
      if (header) {
        const r = header.getBoundingClientRect();
        boxes.push({
          el: header,
          type: "article-header",
          naturalHeight: round(r.height),
          top: round(r.top - flowTop),
          bottom: round(r.bottom - flowTop),
          marginTop: 0,
          marginBottom: round(parseFloat(getComputedStyle(header).marginBottom) || 0),
          glue: { natural: 0, stretch: 10, shrink: 4 },
          breakPenaltyAfter: PENALTY_AFTER_ARTICLE_HEADER,
          isSplittable: false,
          articleStart: article.id,
        });
      }

      const prose = article.querySelector<HTMLElement>(".prose");
      if (!prose) continue;

      const footnoteSection = prose.querySelector<HTMLElement>(":scope > .footnotes");
      const footnoteDefinitions = new Map<string, HTMLElement>();
      const definitions = Array.from(
        footnoteSection?.querySelectorAll<HTMLElement>(":scope > ol > li") ?? [],
      ).filter((definition) => Boolean(definition.id));
      for (const definition of definitions) {
        footnoteDefinitions.set(definition.id, definition);
      }
      // Measure the page presentation, not the endnote list: the two differ in
      // font size, line height and indent, and reserving the endnote's height
      // left footnote pages a third empty.
      const measured = measurePageFootnotes(prose, definitions, DEFAULT_FOOTNOTE_CHROME);
      for (const [definition, height] of measured.heights) {
        FOOTNOTE_METRICS.set(definition, height);
      }
      if (definitions.length > 0) footnoteChrome = measured.chrome;
      // Keep the master DOM intact. The same article is measured again when the
      // reader changes mode or size, so removing definitions permanently loses
      // the references needed by later pagination passes. Keep each section out
      // of the master flow until every article has been measured as well.
      if (footnoteSection) {
        removedFootnoteSections.push({
          prose,
          section: footnoteSection,
          nextSibling: footnoteSection.nextSibling,
        });
        footnoteSection.remove();
      }

      for (const child of Array.from(prose.children) as HTMLElement[]) {
        if (child.classList.contains("footnotes")) {
          continue;
        }

        if (child.tagName === "UL" || child.tagName === "OL") {
          const listTag = child.tagName as "UL" | "OL";
          for (const li of Array.from(child.children) as HTMLElement[]) {
            const r = li.getBoundingClientRect();
            boxes.push({
              el: li,
              type: "list-item",
              naturalHeight: round(r.height),
              top: round(r.top - flowTop),
              bottom: round(r.bottom - flowTop),
              marginTop: 0,
              marginBottom: round(parseFloat(getComputedStyle(li).marginBottom) || 0),
              glue: { natural: 0, stretch: 2, shrink: 1 },
              breakPenaltyAfter: 0,
              isSplittable: false,
              listTag,
              footnotes: footnotesForElement(li, footnoteDefinitions),
            });
          }
          continue;
        }

        const type = classifyElement(child);
        const r = child.getBoundingClientRect();
        const style = getComputedStyle(child);
        const marginTop = round(parseFloat(style.marginTop) || 0);
        const marginBottom = round(parseFloat(style.marginBottom) || 0);

        const isFloat =
          child.dataset.weight !== "full" &&
          (child.dataset.side === "left" ||
            child.dataset.side === "right" ||
            child.tagName === "FIGURE" ||
            child.classList.contains("typeset-figure") ||
            child.classList.contains("typeset-pullquote"));
        const floatSide = isFloat
          ? ((child.dataset.side as "left" | "right") ?? "right")
          : undefined;

        let breakPenaltyAfter = 0;
        if (type === "heading") {
          breakPenaltyAfter = PENALTY_AFTER_HEADING;
        } else if (type === "article-header") {
          breakPenaltyAfter = PENALTY_AFTER_ARTICLE_HEADER;
        } else if (type === "signature") {
          const nextChild = child.nextElementSibling as HTMLElement | null;
          if (nextChild && classifyElement(nextChild) === "signature") {
            breakPenaltyAfter = PENALTY_INSIDE_SIGNATURE;
          }
        } else if (isFloat) {
          breakPenaltyAfter = PENALTY_AFTER_FLOAT;
        }

        const isSplittable = type === "paragraph" && !isFloat;

        const isMajorHeading = child.tagName === "H2";
        const isSubheading = child.tagName === "H3" && child.dataset.sourceCategory !== "true";
        const isSourcesHeading = child.dataset.sourcesHeading === "true";

        boxes.push({
          el: child,
          type,
          naturalHeight: round(r.height),
          top: round(r.top - flowTop),
          bottom: round(r.bottom - flowTop),
          marginTop,
          marginBottom,
          glue: {
            natural: marginBottom,
            stretch: type === "paragraph" ? 8 : 4,
            shrink: type === "paragraph" ? 4 : 2,
          },
          breakPenaltyAfter,
          isSplittable,
          isFloat,
          floatSide,
          isMajorHeading,
          isSubheading,
          isSourcesHeading,
          footnotes: footnotesForElement(child, footnoteDefinitions),
        });
      }
    }
  } finally {
    for (const { prose, section, nextSibling } of removedFootnoteSections) {
      prose.insertBefore(section, nextSibling);
    }
  }

  return boxes;
}

export function computeBadness(naturalHeight: number, targetHeight: number): number {
  if (naturalHeight > targetHeight) return Number.POSITIVE_INFINITY;
  if (targetHeight <= 0) return 0;
  const deficiency = (targetHeight - naturalHeight) / targetHeight;
  return deficiency * deficiency * BADNESS_SCALE;
}

export function solvePages(boxes: Box[], pageHeight: number): PageMap {
  const pages: PageFrameData[] = [];
  const articleIndex: Record<string, number> = {};

  const workBoxes = boxes.slice();
  const workTops = boxes.map((b) => b.top);
  const workBottoms = boxes.map((b) => b.bottom);

  let pageStartIdx = 0;
  const masterWidth =
    boxes[0]?.el.closest<HTMLElement>(".reader-master")?.getBoundingClientRect().width ?? 0;
  const SAFETY_MARGIN = masterWidth <= 280 ? 28 : 4;
  const FOLIO_OVERHEAD = 32;
  const footnotesForRange = (start: number, end: number) => uniqueFootnotes(workBoxes, start, end);

  while (pageStartIdx < workBoxes.length) {
    const pageTopY = workTops[pageStartIdx];
    const currentPageNumber = pages.length; // 0 = cover, 1 = toc, 2.. = spreads (2=left, 3=right)
    const isRightFacingPage = currentPageNumber >= 3 && currentPageNumber % 2 === 1;
    const firstBox = workBoxes[pageStartIdx];

    // Dedicated Table of Contents Partitioning:
    // Fits TOC on 1 page if possible, or balances it across 2 pages (facing spread)
    // with up to 20% elastic budget to prevent orphan 3rd pages.
    if (firstBox.isTocHeader) {
      let tocEnd = pageStartIdx + 1;
      while (tocEnd < workBoxes.length && workBoxes[tocEnd].isTocItem) {
        tocEnd++;
      }

      const tocHeaderBox = firstBox;
      const tocItemBoxes = workBoxes.slice(pageStartIdx + 1, tocEnd);
      const totalItemHeight = tocItemBoxes.reduce((sum, b) => sum + b.naturalHeight, 0);
      const CONT_HEADER_HEIGHT = 44;
      const targetBudget = pageHeight;

      const budget1 = targetBudget - SAFETY_MARGIN - tocHeaderBox.naturalHeight;
      const budget2 = targetBudget - SAFETY_MARGIN - CONT_HEADER_HEIGHT;

      // 1-page TOC
      if (totalItemHeight <= budget1) {
        pages.push({
          units: [],
          contentHeight: tocHeaderBox.naturalHeight + totalItemHeight,
          targetHeight: targetBudget,
          verticalSlack: 0,
          tocHeader: tocHeaderBox.el,
          tocItems: tocItemBoxes.map((b) => b.el),
        });
        pageStartIdx = tocEnd;
        continue;
      }

      // 2-page TOC
      const max2PageCapacity = (budget1 + budget2) * 1.2;
      if (totalItemHeight <= max2PageCapacity && tocItemBoxes.length >= 2) {
        let bestK = Math.ceil(tocItemBoxes.length / 2);
        let bestImbalance = Number.POSITIVE_INFINITY;

        let runningHeight = 0;
        const heights = tocItemBoxes.map((b) => b.naturalHeight);

        for (let k = 1; k < tocItemBoxes.length; k++) {
          runningHeight += heights[k - 1];
          const h1 = runningHeight;
          const h2 = totalItemHeight - runningHeight;

          const fitsP1 = h1 <= budget1 * 1.2;
          const fitsP2 = h2 <= budget2 * 1.2;

          if (fitsP1 && fitsP2) {
            const imbalance = Math.abs(tocHeaderBox.naturalHeight + h1 - (CONT_HEADER_HEIGHT + h2));
            if (imbalance < bestImbalance) {
              bestImbalance = imbalance;
              bestK = k;
            }
          }
        }

        const h1 = heights.slice(0, bestK).reduce((a, b) => a + b, 0);
        const h2 = heights.slice(bestK).reduce((a, b) => a + b, 0);

        pages.push({
          units: [],
          contentHeight: tocHeaderBox.naturalHeight + h1,
          targetHeight: targetBudget,
          verticalSlack: 0,
          tocHeader: tocHeaderBox.el,
          tocItems: tocItemBoxes.slice(0, bestK).map((b) => b.el),
        });

        pages.push({
          units: [],
          contentHeight: CONT_HEADER_HEIGHT + h2,
          targetHeight: targetBudget,
          verticalSlack: 0,
          tocItems: tocItemBoxes.slice(bestK).map((b) => b.el),
        });

        pageStartIdx = tocEnd;
        continue;
      }
    }

    const isCoverOrToc = firstBox.isCoverPage || firstBox.isTocHeader || firstBox.isTocItem;
    const targetBudget = isCoverOrToc ? pageHeight : pageHeight - FOLIO_OVERHEAD;

    const currentPage: PageFrameData = {
      units: [],
      contentHeight: 0,
      targetHeight: targetBudget,
      verticalSlack: 0,
    };
    pages.push(currentPage);

    let scanIdx = pageStartIdx;
    let bestBreakIdx = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    let splitResult: ParagraphSplit | null = null;
    let splitUnitIdx = -1;

    // Scan candidate breaks forward from pageStartIdx
    while (scanIdx < workBoxes.length) {
      const box = workBoxes[scanIdx];

      // Forced break (\clearpage) on new article or cover boundary
      if (scanIdx > pageStartIdx && (box.articleStart !== undefined || box.isCoverPage)) {
        bestBreakIdx = scanIdx;
        splitResult = null;
        break;
      }

      // Evaluate candidate break before scanIdx
      if (scanIdx > pageStartIdx) {
        const prevBox = workBoxes[scanIdx - 1];

        // Keep section headings with the content they introduce. Without this
        // guard, a paragraph that cannot begin in the remaining room can push
        // forward while leaving its heading stranded at the page bottom.
        const boxFitsHere =
          Math.max(workBottoms[scanIdx], ...workBottoms.slice(pageStartIdx, scanIdx)) -
            pageTopY +
            footnoteHeight(footnotesForRange(pageStartIdx, scanIdx + 1)) <=
          targetBudget - SAFETY_MARGIN;
        if (
          (prevBox.isMajorHeading || prevBox.isSubheading || prevBox.isSourcesHeading) &&
          !box.isSplittable &&
          !boxFitsHere
        ) {
          let headingStartIdx = scanIdx - 1;
          while (
            headingStartIdx > pageStartIdx &&
            (workBoxes[headingStartIdx - 1].isMajorHeading ||
              workBoxes[headingStartIdx - 1].isSubheading ||
              workBoxes[headingStartIdx - 1].isSourcesHeading)
          ) {
            headingStartIdx -= 1;
          }
          const followsOpeningHeader =
            workBoxes[pageStartIdx].articleStart !== undefined &&
            headingStartIdx === pageStartIdx + 1;
          if (headingStartIdx > pageStartIdx && !followsOpeningHeader) {
            bestBreakIdx = headingStartIdx;
            splitResult = null;
            break;
          }
        }

        let naturalBottom = 0;
        for (let m = pageStartIdx; m < scanIdx; m++) {
          naturalBottom = Math.max(naturalBottom, workBottoms[m]);
        }
        const natural =
          naturalBottom - pageTopY + footnoteHeight(footnotesForRange(pageStartIdx, scanIdx));
        const penalty = prevBox.breakPenaltyAfter;

        // Final page before a major section has 0 underfull badness, except
        // when that section is the first body content after an article header:
        // never choose a title-only opening page while the opening section can
        // still fit beneath it.
        const badness =
          box.isMajorHeading &&
          prevBox.type !== "article-header" &&
          natural >= targetBudget * MAJOR_HEADING_FREE_BREAK_FILL
            ? 0
            : computeBadness(natural, targetBudget);
        let cost = badness + penalty;

        // Widow control for the article's last page: a break that leaves only
        // a sliver of the article for the next page is discouraged, so the
        // solver pulls one more unit forward instead.
        let articleEndIdx = scanIdx;
        while (
          articleEndIdx < workBoxes.length &&
          workBoxes[articleEndIdx].articleStart === undefined &&
          !workBoxes[articleEndIdx].isCoverPage
        ) {
          articleEndIdx += 1;
        }
        if (articleEndIdx > scanIdx) {
          const tail = workBottoms[articleEndIdx - 1] - workTops[scanIdx];
          if (tail < targetBudget * ORPHAN_TAIL_MIN) cost += PENALTY_ORPHAN_TAIL;
        }

        // Facing-Page Spread Vertical Balancing:
        // If this is a right-hand page facing a left-hand page from the same article,
        // penalize height disparities so facing pages balance harmoniously.
        if (isRightFacingPage && pages.length >= 2) {
          const leftPage = pages[pages.length - 2];
          if (leftPage.contentHeight > 0) {
            const imbalance = Math.abs(leftPage.contentHeight - natural) / targetBudget;
            cost += imbalance * imbalance * PENALTY_SPREAD_IMBALANCE;
          }
        }

        if (cost <= bestCost) {
          bestCost = cost;
          bestBreakIdx = scanIdx;
          splitResult = null;
        }
      }

      // LaTeX \needspace rule for major headings (H2):
      // A major section heading requires at least 50% headroom on the current page;
      // otherwise, break cleanly before the heading so it starts fresh on the next page.
      if (box.isMajorHeading && scanIdx > pageStartIdx) {
        let placedBottom = pageTopY;
        for (let m = pageStartIdx; m < scanIdx; m++) {
          placedBottom = Math.max(placedBottom, workBottoms[m]);
        }
        const spaceLeft =
          targetBudget -
          (placedBottom - pageTopY + footnoteHeight(footnotesForRange(pageStartIdx, scanIdx)));
        const startsArticle = workBoxes
          .slice(pageStartIdx, scanIdx)
          .some((candidate) => candidate.articleStart !== undefined);
        const hasEarlierMajorHeading = workBoxes
          .slice(pageStartIdx, scanIdx)
          .some((candidate) => candidate.isMajorHeading);
        const requiredHeadroom =
          startsArticle && !hasEarlierMajorHeading
            ? MAJOR_HEADING_MIN_ROOM_OPENING
            : MAJOR_HEADING_MIN_ROOM;
        if (spaceLeft < targetBudget * requiredHeadroom) {
          bestBreakIdx = scanIdx;
          splitResult = null;
          break;
        }
      }

      // Keep a regular subheading from introducing a new profile or content
      // block at the foot of a page with only a sliver of room left. Source
      // category headings are excluded because source pages intentionally use
      // compact heading-to-entry transitions.
      if (box.isSubheading && scanIdx > pageStartIdx) {
        let placedBottom = pageTopY;
        for (let m = pageStartIdx; m < scanIdx; m++) {
          placedBottom = Math.max(placedBottom, workBottoms[m]);
        }
        const spaceLeft =
          targetBudget -
          (placedBottom - pageTopY + footnoteHeight(footnotesForRange(pageStartIdx, scanIdx)));
        if (spaceLeft < targetBudget * SUBHEADING_MIN_ROOM) {
          // If this subsection follows a top-level heading on the same page,
          // move both headings together. Otherwise the keep-with-next rule
          // would strand the H2 above a mostly empty page.
          const previousBox = workBoxes[scanIdx - 1];
          if (previousBox?.isMajorHeading) {
            if (scanIdx - 1 > pageStartIdx) {
              const pageStartsWithArticleHeader =
                workBoxes[pageStartIdx].articleStart !== undefined;
              // On an article opening, keeping the category H2 beneath the
              // title is preferable to producing a title-only page followed
              // by another page containing only that H2. The H3 can start the
              // actual profile on the following page if necessary.
              bestBreakIdx = pageStartsWithArticleHeader ? scanIdx : scanIdx - 1;
              splitResult = null;
              break;
            }
            // The H2 starts this page, so let its first subsection follow it.
          } else {
            bestBreakIdx = scanIdx;
            splitResult = null;
            break;
          }
        }
      }

      const bottom = workBottoms[scanIdx];
      let maxBottomWithBox = bottom;
      for (let m = pageStartIdx; m < scanIdx; m++) {
        maxBottomWithBox = Math.max(maxBottomWithBox, workBottoms[m]);
      }
      const fits =
        maxBottomWithBox -
          pageTopY +
          footnoteHeight(footnotesForRange(pageStartIdx, scanIdx + 1)) <=
        targetBudget - SAFETY_MARGIN;

      if (fits) {
        scanIdx += 1;
        continue;
      }

      // Candidate paragraph split if this box overflows the available page budget.
      // The footnotes already committed to this page — plus any the paragraph
      // itself would drag down with it — eat into the room a split can use.
      const pageFootnotes = footnotesForRange(pageStartIdx, scanIdx);
      const boxFootnotes = box.footnotes ?? [];
      const reserveWithBox = footnoteHeight(
        [...pageFootnotes, ...boxFootnotes].filter(
          (footnote, index, all) => all.indexOf(footnote) === index,
        ),
      );
      const roomLeft =
        targetBudget - SAFETY_MARGIN - (workTops[scanIdx] - pageTopY) - reserveWithBox;

      if (box.isSplittable && roomLeft > 36) {
        let split = splitParagraph(box.el, roomLeft);
        if (split && boxFootnotes.length > 0) {
          // Reserving for every reference in the paragraph is pessimistic when
          // the split leaves some of them on the next page. Retry with the room
          // those notes free up, keeping the wider split only if it doesn't pull
          // another reference above the break.
          const firstFootnotes = footnotesFromCandidates(split.first, boxFootnotes);
          if (firstFootnotes.length < boxFootnotes.length) {
            const reserveWithFirst = footnoteHeight(
              [...pageFootnotes, ...firstFootnotes].filter(
                (footnote, index, all) => all.indexOf(footnote) === index,
              ),
            );
            const relaxedRoom = roomLeft + (reserveWithBox - reserveWithFirst);
            const relaxed = splitParagraph(box.el, relaxedRoom);
            if (
              relaxed &&
              footnotesFromCandidates(relaxed.first, boxFootnotes).length === firstFootnotes.length
            ) {
              split = relaxed;
            }
          }
        }
        if (split) {
          const splitBottom = workTops[scanIdx] + split.firstHeight;
          let maxBottomWithSplit = splitBottom;
          for (let m = pageStartIdx; m < scanIdx; m++) {
            maxBottomWithSplit = Math.max(maxBottomWithSplit, workBottoms[m]);
          }
          const splitFootnotes = [
            ...footnotesForRange(pageStartIdx, scanIdx),
            ...footnotesFromCandidates(split.first, box.footnotes ?? []),
          ].filter((footnote, index, all) => all.indexOf(footnote) === index);
          const splitNatural = maxBottomWithSplit - pageTopY + footnoteHeight(splitFootnotes);
          let cost = computeBadness(splitNatural, targetBudget) + PENALTY_PARAGRAPH_SPLIT;

          // Apply facing spread balance to paragraph split candidate
          if (isRightFacingPage && pages.length >= 2) {
            const leftPage = pages[pages.length - 2];
            if (leftPage.contentHeight > 0) {
              const imbalance = Math.abs(leftPage.contentHeight - splitNatural) / targetBudget;
              cost += imbalance * imbalance * PENALTY_SPREAD_IMBALANCE;
            }
          }

          if (cost <= bestCost) {
            bestBreakIdx = scanIdx;
            splitResult = split;
            splitUnitIdx = scanIdx;
          }
        }
      }

      break;
    }

    // Reaching the end means every remaining box fit. There is no following
    // box at which the normal candidate evaluation can record this terminal
    // break, so accept the complete remainder explicitly instead of stranding
    // the final unit on a page of its own.
    if (scanIdx === workBoxes.length) {
      bestBreakIdx = scanIdx;
      splitResult = null;
    }

    // Fallback: single oversized element
    if (bestBreakIdx === -1) {
      bestBreakIdx = pageStartIdx + 1;
      splitResult = null;
    }

    // Apply chosen paragraph split
    if (splitResult !== null) {
      const originalBox = workBoxes[splitUnitIdx];
      const top = workTops[splitUnitIdx];
      const bottom = workBottoms[splitUnitIdx];

      const firstBox: Box = {
        ...originalBox,
        el: splitResult.first,
        footnotes: footnotesFromCandidates(splitResult.first, originalBox.footnotes ?? []),
        naturalHeight: splitResult.firstHeight,
        breakPenaltyAfter: 0,
        isSplittable: false,
      };

      const secondBox: Box = {
        ...originalBox,
        el: splitResult.second,
        footnotes: footnotesFromCandidates(splitResult.second, originalBox.footnotes ?? []),
        naturalHeight: splitResult.secondHeight,
        breakPenaltyAfter: originalBox.breakPenaltyAfter,
        isSplittable: originalBox.isSplittable,
      };

      const firstBottom = top + splitResult.firstHeight;
      const secondBottom = firstBottom + splitResult.secondHeight;

      workBoxes.splice(splitUnitIdx, 1, firstBox, secondBox);
      workTops.splice(splitUnitIdx, 1, top, firstBottom);
      workBottoms.splice(splitUnitIdx, 1, firstBottom, secondBottom);

      const delta = secondBottom - bottom;
      if (delta !== 0) {
        for (let k = splitUnitIdx + 2; k < workTops.length; k++) {
          workTops[k] += delta;
          workBottoms[k] += delta;
        }
      }

      bestBreakIdx = splitUnitIdx + 1;
    }

    // Package units onto page
    let maxBottomOnPage = pageTopY;
    for (let k = pageStartIdx; k < bestBreakIdx; k++) {
      const u = workBoxes[k];
      if (u.isCoverPage) {
        currentPage.cover = u.el;
      } else if (u.isTocHeader) {
        currentPage.tocHeader = u.el;
      } else if (u.isTocItem) {
        if (!currentPage.tocItems) currentPage.tocItems = [];
        currentPage.tocItems.push(u.el);
      } else if (u.articleStart !== undefined) {
        currentPage.header = u.el;
        currentPage.articleId = u.articleStart;
        currentPage.articleTitle = u.el.querySelector("h2")?.textContent?.trim() || "";
        currentPage.isCredits = u.el.classList.contains("reader-credits-header");
        articleIndex[u.articleStart] = pages.length - 1;
      } else {
        currentPage.units.push({
          el: u.el,
          listTag: u.listTag,
          footnotes: u.footnotes,
          boxType: u.type,
        });
      }

      for (const footnote of u.footnotes ?? []) {
        if (!currentPage.footnotes) currentPage.footnotes = [];
        if (!currentPage.footnotes.includes(footnote)) currentPage.footnotes.push(footnote);
      }

      maxBottomOnPage = Math.max(maxBottomOnPage, workBottoms[k]);
    }

    // Inherit active article title and ID on continuation pages
    if (
      !currentPage.cover &&
      !currentPage.tocHeader &&
      !currentPage.tocItems &&
      !currentPage.articleId &&
      pages.length >= 2
    ) {
      const prevPage = pages[pages.length - 2];
      currentPage.articleId = prevPage.articleId;
      currentPage.articleTitle = prevPage.articleTitle;
      currentPage.isCredits = prevPage.isCredits;
    }

    // Check if the current page concludes an article
    const nextBox = bestBreakIdx < workBoxes.length ? workBoxes[bestBreakIdx] : null;
    if (currentPage.articleId && (!nextBox || nextBox.articleStart !== undefined)) {
      currentPage.isArticleEnd = true;
    }

    currentPage.contentHeight =
      maxBottomOnPage - pageTopY + footnoteHeight(currentPage.footnotes ?? []);
    currentPage.verticalSlack = Math.max(0, pageHeight - currentPage.contentHeight);

    pageStartIdx = bestBreakIdx;
  }

  return { pages, articleIndex };
}
