/** Page-turn overlay built from cloned page frames. */

type PageTurnOptions = {
  viewport: HTMLElement;
  /** The page that swings away — the source spread's inner half. */
  frontFrame: HTMLElement;
  /** What is printed on the leaf's reverse — the destination's inner half. */
  backFrame: HTMLElement;
  /** The source spread's other half, held in place for the whole turn. */
  stationaryFrame: HTMLElement | null;
  paired: boolean;
  forward: boolean;
  durationMs: number;
};

export type PageTurn = {
  stage: HTMLElement;
  /** Resolves once every cloned image has decoded, before anything moves. */
  ready: Promise<void>;
  play: () => Promise<void>;
  cancel: () => void;
};

const EASING = "cubic-bezier(0.45, 0.03, 0.5, 1)";

/** Must match `.reader-turn-cast-shadow`'s width so the gradient sits flush
 * against the hinge edge of the page being turned. */
const CAST_SHADOW_WIDTH = 110;

/** How dark a face gets when it is edge-on to the viewer. */
const SHADE_OPACITY = 0.42;

/** Clone frames with resolved image sources. */
const cloneFrame = (frame: HTMLElement) => {
  const clone = frame.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  for (const element of clone.querySelectorAll("[id]")) element.removeAttribute("id");
  clone.setAttribute("aria-hidden", "true");

  const sources = Array.from(frame.querySelectorAll<HTMLImageElement>("img"));
  const images = Array.from(clone.querySelectorAll<HTMLImageElement>("img"));
  images.forEach((image, index) => {
    const source = sources[index];
    if (!source) return;
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.loading = "eager";
    image.decoding = "async";
    image.src = source.currentSrc || source.src;
  });

  return { clone, images };
};

export function createPageTurn(options: PageTurnOptions): PageTurn {
  const { viewport, frontFrame, backFrame, stationaryFrame, paired, forward, durationMs } = options;

  const viewportRect = viewport.getBoundingClientRect();
  const frameRect = frontFrame.getBoundingClientRect();
  /** Where a page frame sits inside the viewport. Identical for every spread. */
  const frameInset = {
    left: frameRect.left - viewportRect.left,
    top: frameRect.top - viewportRect.top,
    width: frameRect.width,
    height: frameRect.height,
  };
  const pendingImages: HTMLImageElement[] = [];

  const leafBox = paired
    ? frameInset
    : { left: 0, top: 0, width: viewportRect.width, height: viewportRect.height };
  const hingeOnLeft = paired ? forward : true;
  const hingeX = hingeOnLeft ? leafBox.left : leafBox.left + leafBox.width;
  const [fromAngle, toAngle] = paired ? [0, forward ? -180 : 180] : forward ? [0, -180] : [-180, 0];

  const stage = document.createElement("div");
  stage.className = [
    "reader-turn-stage",
    "reader-spread",
    paired ? "is-pair" : "is-single",
    forward ? "is-forward" : "is-backward",
    hingeOnLeft ? "is-hinge-left" : "is-hinge-right",
  ].join(" ");
  stage.setAttribute("aria-hidden", "true");
  Object.assign(stage.style, {
    top: `${viewport.offsetTop}px`,
    width: `${viewportRect.width}px`,
    height: `${viewportRect.height}px`,
    perspective: `${Math.round(Math.max(2400, leafBox.width * 4.5))}px`,
    perspectiveOrigin: `${Math.round(hingeX)}px 50%`,
  });

  const getFrameInset = (frame: HTMLElement) => {
    const spread = frame.closest<HTMLElement>(".reader-spread");
    const fRect = frame.getBoundingClientRect();
    if (!spread) {
      return {
        left: fRect.left - viewportRect.left,
        top: fRect.top - viewportRect.top,
        width: fRect.width,
        height: fRect.height,
      };
    }
    const sRect = spread.getBoundingClientRect();
    return {
      left: fRect.left - sRect.left,
      top: fRect.top - sRect.top,
      width: fRect.width,
      height: fRect.height,
    };
  };

  const placeClone = (frame: HTMLElement) => {
    const { clone, images } = cloneFrame(frame);
    pendingImages.push(...images);
    if (!paired) {
      const inset = getFrameInset(frame);
      Object.assign(clone.style, {
        position: "absolute",
        left: `${inset.left}px`,
        top: `${inset.top}px`,
        width: `${inset.width}px`,
        height: `${inset.height}px`,
      });
    }
    return clone;
  };

  const stationarySource = paired ? stationaryFrame : forward ? null : frontFrame;
  if (stationarySource) {
    const holder = document.createElement("div");
    holder.className = "reader-turn-stationary";
    const box = paired ? getFrameInset(stationarySource) : leafBox;
    Object.assign(holder.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
    holder.appendChild(placeClone(stationarySource));
    stage.appendChild(holder);
  }

  const shadowRightOfHinge = !(paired && forward);
  const castShadow = document.createElement("div");
  castShadow.className = `reader-turn-cast-shadow ${
    shadowRightOfHinge ? "is-dark-left" : "is-dark-right"
  }`;
  Object.assign(castShadow.style, {
    left: `${shadowRightOfHinge ? hingeX : hingeX - CAST_SHADOW_WIDTH}px`,
    top: `${leafBox.top}px`,
    height: `${leafBox.height}px`,
  });
  stage.appendChild(castShadow);

  const leaf = document.createElement("div");
  leaf.className = "reader-turn-leaf";
  Object.assign(leaf.style, {
    left: `${leafBox.left}px`,
    top: `${leafBox.top}px`,
    width: `${leafBox.width}px`,
    height: `${leafBox.height}px`,
    transformOrigin: hingeOnLeft ? "left center" : "right center",
    transform: `rotateY(${fromAngle}deg)`,
  });

  const buildFace = (frame: HTMLElement | null, side: "front" | "back") => {
    const face = document.createElement("div");
    face.className = `reader-turn-face is-${side}`;
    if (frame) face.appendChild(placeClone(frame));
    const shade = document.createElement("div");
    shade.className = `reader-turn-shade is-${side}`;
    face.appendChild(shade);
    return { face, shade };
  };

  const front = buildFace(paired || forward ? frontFrame : backFrame, "front");
  const back = buildFace(paired ? backFrame : null, "back");
  leaf.append(front.face, back.face);
  stage.appendChild(leaf);

  const ready = Promise.allSettled(
    pendingImages.filter((img) => !img.complete).map((image) => image.decode()),
  ).then(() => undefined);

  const animations: Animation[] = [];
  let cancelled = false;

  const play = async () => {
    if (cancelled) return;
    const timing: KeyframeAnimationOptions = {
      duration: durationMs,
      easing: EASING,
      fill: "both",
    };
    const leafAnimation = leaf.animate(
      [{ transform: `rotateY(${fromAngle}deg)` }, { transform: `rotateY(${toAngle}deg)` }],
      timing,
    );
    // A face is unshaded when it lies flat and darkest edge-on, so the ramps run
    // towards whichever end of the motion is the flat one. They meet at 0.5 —
    // the angle where the faces swap — so the lighting is continuous.
    const startsFlat = fromAngle === 0;
    const lit = { opacity: 0 };
    const dim = { opacity: SHADE_OPACITY };
    const shadeFront = front.shade.animate(
      startsFlat
        ? [
            { ...lit, offset: 0 },
            { ...dim, offset: 0.5 },
            { ...dim, offset: 1 },
          ]
        : [
            { ...dim, offset: 0 },
            { ...dim, offset: 0.5 },
            { ...lit, offset: 1 },
          ],
      timing,
    );
    const shadeBack = back.shade.animate(
      startsFlat
        ? [
            { ...dim, offset: 0 },
            { ...dim, offset: 0.5 },
            { ...lit, offset: 1 },
          ]
        : [
            { ...dim, offset: 0 },
            { ...dim, offset: 0.5 },
            { ...lit, offset: 1 },
          ],
      timing,
    );
    const shadow = castShadow.animate(
      [
        { opacity: 0, transform: "scaleX(0.2)", offset: 0 },
        { opacity: 0.3, transform: "scaleX(1)", offset: 0.5 },
        { opacity: 0, transform: "scaleX(0.2)", offset: 1 },
      ],
      timing,
    );
    animations.push(leafAnimation, shadeFront, shadeBack, shadow);

    try {
      await leafAnimation.finished;
    } catch {
      // Cancelled mid-turn; the caller tears the stage down.
    }
  };

  const cancel = () => {
    cancelled = true;
    for (const animation of animations) animation.cancel();
    animations.length = 0;
    stage.remove();
  };

  return { stage, ready, play, cancel };
}
