import { useRef, useEffect, useState } from "react";
import { cube3x3x3 } from "cubing/puzzles";
import { ExperimentalSVGAnimator } from "cubing/twisty";
import type { KPattern } from "cubing/kpuzzle";

interface CubeSvgViewerProps {
  pattern: KPattern | null;
}

export function CubeSvgViewer({ pattern }: CubeSvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<ExperimentalSVGAnimator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const kpuzzle = await cube3x3x3.kpuzzle();
      const svgSource = await cube3x3x3.svg();

      if (cancelled || !containerRef.current) return;

      const animator = new ExperimentalSVGAnimator(kpuzzle, svgSource);
      animatorRef.current = animator;
      containerRef.current.appendChild(animator.wrapperElement);
      animator.draw(pattern ?? kpuzzle.defaultPattern());
      setLoading(false);
    }

    void init();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
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
    <div ref={containerRef} className="inline-block">
      {loading && (
        <div className="text-gray-500 text-sm">Loading cube view...</div>
      )}
    </div>
  );
}
