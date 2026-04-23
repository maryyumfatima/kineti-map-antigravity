import { useRef, useState, type PointerEvent } from "react";
import { X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export type PainPoint = {
  id: string;
  view: "front" | "back";
  /** 0–1 normalized x within the SVG viewBox */
  x: number;
  /** 0–1 normalized y within the SVG viewBox */
  y: number;
  region: string;
  score: number;
};

export type PainData = Record<string, number>;

type Props = {
  value?: PainPoint[];
  onChange?: (points: PainPoint[], summary: PainData) => void;
};

const VIEW_W = 200;
const VIEW_H = 500;

function colorFor(score: number) {
  if (score <= 3) return "#D9B29C";
  if (score <= 6) return "#F5A623";
  return "#C0392B";
}

/** Rough region inference from normalized coords, used as the JSON key */
function inferRegion(view: "front" | "back", x: number, y: number): string {
  const side = x < 0.45 ? "right" : x > 0.55 ? "left" : "center";
  let zone = "torso";
  if (y < 0.12) zone = "head";
  else if (y < 0.2) zone = "neck";
  else if (y < 0.28) zone = view === "front" ? "shoulder" : "upper_back";
  else if (y < 0.45) zone = view === "front" ? "chest" : "mid_back";
  else if (y < 0.58) zone = view === "front" ? "abdomen" : "lower_back";
  else if (y < 0.7) zone = "hip";
  else if (y < 0.85) zone = "thigh";
  else if (y < 0.95) zone = "knee";
  else zone = "foot";

  if (zone === "head" || zone === "neck" || zone === "lower_back" || zone === "upper_back" || zone === "mid_back" || zone === "abdomen" || zone === "chest")
    return zone;
  return `${side}_${zone}`;
}

function summarize(points: PainPoint[]): PainData {
  const out: PainData = {};
  for (const p of points) {
    // keep the highest score per region
    if (out[p.region] === undefined || p.score > out[p.region]) out[p.region] = p.score;
  }
  return out;
}

/**
 * Simple human silhouette path (front and back share the same outline).
 * Drawn within a 200×500 viewBox.
 */
const SILHOUETTE_PATH =
  "M100 18 c14 0 24 12 24 26 c0 12 -6 22 -14 26 c12 4 22 12 28 24 l10 38 c4 14 -2 22 -10 22 l-8 0 l4 60 l8 70 c2 14 -4 20 -12 20 l-6 0 l-4 -50 l-4 50 l-2 90 c0 12 -6 18 -14 18 c-8 0 -14 -6 -14 -18 l-2 -90 l-4 -50 l-4 50 l-6 0 c-8 0 -14 -6 -12 -20 l8 -70 l4 -60 l-8 0 c-8 0 -14 -8 -10 -22 l10 -38 c6 -12 16 -20 28 -24 c-8 -4 -14 -14 -14 -26 c0 -14 10 -26 24 -26 z";

function Silhouette({
  view,
  points,
  activeId,
  onCreate,
  onSelect,
  onRemove,
}: {
  view: "front" | "back";
  points: PainPoint[];
  activeId: string | null;
  onCreate: (x: number, y: number) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleClick = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const target = e.target as Element;
    // ignore clicks on existing dots
    if (target.closest("[data-dot]")) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onCreate(x, y);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {view === "front" ? "Front" : "Back"}
      </span>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-[360px] w-auto cursor-crosshair touch-none select-none sm:h-[440px]"
        onPointerDown={handleClick}
        role="img"
        aria-label={`${view} body view, tap to mark pain`}
      >
        <path
          d={SILHOUETTE_PATH}
          fill="hsl(var(--muted))"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {points.map((p) => {
          const cx = p.x * VIEW_W;
          const cy = p.y * VIEW_H;
          const isActive = p.id === activeId;
          return (
            <g key={p.id} data-dot>
              <circle
                cx={cx}
                cy={cy}
                r={isActive ? 11 : 9}
                fill={colorFor(p.score)}
                stroke="#fff"
                strokeWidth={2}
                className="cursor-pointer drop-shadow"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(p.id);
                }}
              />
              <text
                x={cx}
                y={cy + 3}
                textAnchor="middle"
                fontSize={9}
                fontWeight={700}
                fill="#fff"
                pointerEvents="none"
              >
                {p.score}
              </text>
              {/* hover remove */}
              <g
                transform={`translate(${cx + 8} ${cy - 14})`}
                className="opacity-0 hover:opacity-100"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onRemove(p.id);
                }}
              >
                <circle r={7} fill="#fff" stroke="#C0392B" strokeWidth={1.5} className="cursor-pointer" />
                <line x1={-3} y1={-3} x2={3} y2={3} stroke="#C0392B" strokeWidth={1.5} />
                <line x1={3} y1={-3} x2={-3} y2={3} stroke="#C0392B" strokeWidth={1.5} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function BodyMap({ value, onChange }: Props) {
  const [internal, setInternal] = useState<PainPoint[]>(value ?? []);
  const points = value ?? internal;
  const [activeId, setActiveId] = useState<string | null>(null);

  const update = (next: PainPoint[]) => {
    if (!value) setInternal(next);
    onChange?.(next, summarize(next));
  };

  const addPoint = (view: "front" | "back", x: number, y: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newPoint: PainPoint = {
      id,
      view,
      x,
      y,
      region: inferRegion(view, x, y),
      score: 5,
    };
    update([...points, newPoint]);
    setActiveId(id);
  };

  const setScore = (id: string, score: number) => {
    update(points.map((p) => (p.id === id ? { ...p, score } : p)));
  };

  const remove = (id: string) => {
    update(points.filter((p) => p.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const active = points.find((p) => p.id === activeId) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-center text-sm font-medium text-foreground">
        Tap where it hurts. Rate the pain 1–10.
      </p>
      <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-border bg-card p-4 sm:flex-row sm:gap-10">
        <Silhouette
          view="front"
          points={points.filter((p) => p.view === "front")}
          activeId={activeId}
          onCreate={(x, y) => addPoint("front", x, y)}
          onSelect={setActiveId}
          onRemove={remove}
        />
        <Silhouette
          view="back"
          points={points.filter((p) => p.view === "back")}
          activeId={activeId}
          onCreate={(x, y) => addPoint("back", x, y)}
          onSelect={setActiveId}
          onRemove={remove}
        />
      </div>

      {active && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {active.view} · {active.region.replace(/_/g, " ")}
              </p>
              <p className="font-display text-lg font-semibold">
                Severity: <span style={{ color: colorFor(active.score) }}>{active.score}/10</span>
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(active.id)}
              aria-label="Remove marker"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Slider
            value={[active.score]}
            min={1}
            max={10}
            step={1}
            onValueChange={(v) => setScore(active.id, v[0] ?? 5)}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>1 mild</span>
            <span>10 severe</span>
          </div>
        </div>
      )}

      {points.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {points.length} pain {points.length === 1 ? "point" : "points"} marked
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => update([])}>
            Clear all
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: "#D9B29C" }} /> 1–3
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: "#F5A623" }} /> 4–6
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: "#C0392B" }} /> 7–10
        </span>
      </div>
    </div>
  );
}
