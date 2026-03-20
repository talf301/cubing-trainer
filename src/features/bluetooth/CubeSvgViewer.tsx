import { useRef, useEffect, useState } from "react";
import { cube3x3x3 } from "cubing/puzzles";
import { ExperimentalSVGAnimator } from "cubing/twisty";
import type { KPattern } from "cubing/kpuzzle";

interface CubeSvgViewerProps {
  pattern: KPattern | null;
}

export function CubeSvgViewer({ pattern }: CubeSvgViewerProps) {
  // Separate ref for the imperatively-managed SVG container.
  // React must not touch this div's children.
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<ExperimentalSVGAnimator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const kpuzzle = await cube3x3x3.kpuzzle();
      const svgSource = await cube3x3x3.svg();

      if (cancelled || !svgContainerRef.current) return;

      const animator = new ExperimentalSVGAnimator(kpuzzle, svgSource);
      animatorRef.current = animator;
      svgContainerRef.current.appendChild(animator.wrapperElement);
      animator.draw(pattern ?? kpuzzle.defaultPattern());
      setLoading(false);
    }

    void init();

    return () => {
      cancelled = true;
      if (svgContainerRef.current) {
        svgContainerRef.current.innerHTML = "";
      }
      animatorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pattern && animatorRef.current) {
      animatorRef.current.draw(pattern);
    }
  }, [pattern]);

  return (
    <div className="inline-block">
      {loading && (
        <div className="text-gray-500 text-sm">Loading cube view...</div>
      )}
      <div ref={svgContainerRef} />
    </div>
  );
}
