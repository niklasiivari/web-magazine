/**
 * Magazine typesetting and layout engine.
 *
 * A LaTeX-inspired typesetting system for digital editorial publishing.
 */

import type { PageMap } from "./box";
import { repairOverflowingPages } from "./overflow";
import { collectMasterBoxes, solvePages } from "./page-solver";
import { renderPageFrames } from "./renderer";

export * from "./box";
export * from "./overflow";
export * from "./page-solver";
export * from "./paragraph";
export * from "./penalties";
export * from "./renderer";

/**
 * Awaits complete loading of all images within the subtree before measurement begins.
 */
export async function waitForReaderImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
  // Yield to the event loop so style recalculation & paint settle
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Executes full typesetting pass on master document flow and outputs calculated PageMap.
 */
export function typesetMaster(masterFlow: HTMLElement, pageHeight: number): PageMap {
  const boxes = collectMasterBoxes(masterFlow);
  return solvePages(boxes, pageHeight);
}

/**
 * Typesets and mounts page frames into the visible track.
 */
export function typesetAndMount(
  masterFlow: HTMLElement,
  track: HTMLElement,
  pageHeight: number,
  isSpread = false,
): PageMap {
  const pageMap = typesetMaster(masterFlow, pageHeight);
  // The solver works from master-flow geometry, which a float can invalidate
  // once the page re-lays it. Measure the real thing before mounting.
  repairOverflowingPages(track, pageMap, pageHeight, isSpread);
  renderPageFrames(track, pageMap, pageHeight, isSpread);
  return pageMap;
}
