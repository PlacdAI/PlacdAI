import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  before: string;
  after: string;
  alt?: string;
  className?: string;
}

export function BeforeAfterSlider({
  before,
  after,
  alt = "Before/After comparison",
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50); // percent
  const [dragging, setDragging] = useState(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const x =
        "touches" in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      if (typeof x === "number") setFromClientX(x);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, setFromClientX]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full select-none overflow-hidden ${className ?? ""}`}
      onMouseDown={(e) => {
        setDragging(true);
        setFromClientX(e.clientX);
      }}
      onTouchStart={(e) => {
        setDragging(true);
        const x = e.touches[0]?.clientX;
        if (typeof x === "number") setFromClientX(x);
      }}
    >
      {/* After (full) */}
      <img
        src={after}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/* Before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pos}%` }}
      >
        <div
          className="absolute inset-0 h-full"
          style={{
            width: containerRef.current?.getBoundingClientRect().width ?? "100%",
          }}
        >
          <img
            src={before}
            alt="Before"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>
      </div>

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
        After
      </span>

      {/* Divider + handle */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.4)]"
        style={{ left: `calc(${pos}% - 1px)` }}
      >
        <div className="pointer-events-auto absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-black shadow-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M8 6l-4 6 4 6M16 6l4 6-4 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
