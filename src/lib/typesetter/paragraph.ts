/**
 * Paragraph Line-Level Decomposition & Slicing.
 *
 * Measures line boxes via DOM Ranges on the in-situ rendered paragraph.
 * Binary-searches word boundaries to find optimal cut points with classic
 * orphan (>= 2 lines at start) and widow (>= 2 lines at end) constraints.
 */

export interface ParagraphSplit {
  first: HTMLElement;
  second: HTMLElement;
  firstHeight: number;
  secondHeight: number;
}

function nodeOffsetAtTextOffset(root: Node, target: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();
  let lastTextNode: Text | null = null;

  while (node) {
    const text = node as Text;
    if (consumed + text.length >= target) {
      return { node: text, offset: target - consumed };
    }
    consumed += text.length;
    lastTextNode = text;
    node = walker.nextNode();
  }

  return lastTextNode
    ? { node: lastTextNode, offset: lastTextNode.length }
    : { node: root, offset: 0 };
}

function splitConnectedParagraph(p: HTMLElement, maxHeight: number): ParagraphSplit | null {
  const fullText = p.textContent ?? "";
  if (!fullText.trim()) return null;

  // Extract word boundary offsets
  const wordStarts: number[] = [0];
  const wsRe = /\s+/g;
  let match = wsRe.exec(fullText);
  while (match !== null) {
    wordStarts.push(match.index + match[0].length);
    match = wsRe.exec(fullText);
  }
  if (wordStarts.length < 2) return null;

  const marginBottom = Math.round(parseFloat(getComputedStyle(p).marginBottom) || 0);
  const contentBudget = maxHeight - marginBottom;
  if (contentBudget <= 0) return null;

  const pRect = p.getBoundingClientRect();
  const fullRange = document.createRange();
  fullRange.selectNodeContents(p);

  // Group line rects by distinct visual vertical offsets
  const rects = Array.from(fullRange.getClientRects());
  const lineTops = rects
    .map((r) => Math.round(r.top))
    .filter((top, idx, arr) => arr.indexOf(top) === idx)
    .sort((a, b) => a - b);

  // Paragraph is too short to split with orphan/widow guarantees (need >= 4 lines)
  if (lineTops.length < 4) return null;

  const lineBottoms = lineTops.map((_, idx) =>
    idx + 1 < lineTops.length ? lineTops[idx + 1] - pRect.top : pRect.height,
  );

  let linesHere = 0;
  for (let i = 0; i < lineBottoms.length; i++) {
    if (lineBottoms[i] <= contentBudget) {
      linesHere = i + 1;
    } else {
      break;
    }
  }

  // Already fits completely or not enough lines for orphan/widow rules
  if (linesHere >= lineBottoms.length) return null;
  if (linesHere < 2) return null; // Orphan rule: at least 2 lines on page 1
  if (lineBottoms.length - linesHere === 1) linesHere -= 1; // Widow rule: at least 2 lines on page 2
  if (linesHere < 2) return null;

  const targetHeight = lineBottoms[linesHere - 1];

  // Binary search for highest word offset fitting targetHeight
  const probeRange = document.createRange();
  const heightAt = (offset: number): number => {
    probeRange.setStart(p, 0);
    const pos = nodeOffsetAtTextOffset(p, offset);
    probeRange.setEnd(pos.node, pos.offset);
    return probeRange.getBoundingClientRect().bottom - pRect.top;
  };

  let lo = 1;
  let hi = wordStarts.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (heightAt(wordStarts[mid]) <= targetHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best === 0) return null;

  const splitOffset = wordStarts[best];
  if (splitOffset <= 0 || splitOffset >= fullText.length) return null;

  const splitPos = nodeOffsetAtTextOffset(p, splitOffset);

  // Build first slice
  const firstRange = document.createRange();
  firstRange.setStart(p, 0);
  firstRange.setEnd(splitPos.node, splitPos.offset);
  const firstHeight = Math.round(firstRange.getBoundingClientRect().height) + marginBottom;

  // Build second slice
  const secondRange = document.createRange();
  secondRange.setStart(splitPos.node, splitPos.offset);
  secondRange.setEnd(p, p.childNodes.length);
  const secondHeight = Math.round(secondRange.getBoundingClientRect().height) + marginBottom;

  const first = document.createElement("p");
  first.className = p.className;
  first.appendChild(firstRange.cloneContents());

  const second = document.createElement("p");
  second.className = p.className;
  second.appendChild(secondRange.cloneContents());

  return { first, second, firstHeight, secondHeight };
}

export function splitParagraph(p: HTMLElement, maxHeight: number): ParagraphSplit | null {
  if (p.isConnected) return splitConnectedParagraph(p, maxHeight);

  const master = document.querySelector<HTMLElement>(".reader-master");
  const host = document.createElement("div");
  host.className = "prose";
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.visibility = "hidden";
  host.style.width = `${master?.getBoundingClientRect().width || 280}px`;
  host.appendChild(p);
  document.body.appendChild(host);

  try {
    return splitConnectedParagraph(p, maxHeight);
  } finally {
    host.remove();
  }
}
