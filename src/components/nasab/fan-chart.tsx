import { useMemo } from "react";
import { copy } from "@/lib/tree/copy";
import { fullName } from "@/lib/tree/format";
import { ahnentafel } from "@/lib/tree/graph";
import { useTreeStore } from "@/lib/tree/store";

const MAX_GEN = 3;

export function FanChart() {
  const people = useTreeStore((s) => s.people);
  const focusId = useTreeStore((s) => s.focusId);
  const selectedId = useTreeStore((s) => s.selectedId);
  const setSelected = useTreeStore((s) => s.setSelected);
  const setFocus = useTreeStore((s) => s.setFocus);
  const openFile = useTreeStore((s) => s.openFile);

  const map = useMemo(
    () => (focusId ? ahnentafel(people, focusId, MAX_GEN) : new Map()),
    [people, focusId],
  );

  const size = 720;
  const cx = size / 2;
  const cy = size / 2 + 40;
  const inner = 54;
  const ring = 92;
  const focus = focusId ? people[focusId] : null;

  const wedges: {
    n: number;
    d: string;
    fill: string;
    labelX: number;
    labelY: number;
    name: string;
    id: string | null;
  }[] = [];

  for (let gen = 1; gen <= MAX_GEN; gen++) {
    const count = 2 ** gen;
    const r0 = inner + (gen - 1) * ring;
    const r1 = inner + gen * ring;
    const startN = 2 ** gen;
    for (let i = 0; i < count; i++) {
      const n = startN + i;
      const person = map.get(n) ?? null;
      const a0 = Math.PI + (i * Math.PI) / count;
      const a1 = Math.PI + ((i + 1) * Math.PI) / count;
      const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
      const [x0, y0] = p(r0, a0);
      const [x1, y1] = p(r1, a0);
      const [x2, y2] = p(r1, a1);
      const [x3, y3] = p(r0, a1);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M ${x0} ${y0} L ${x1} ${y1} A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r0} ${r0} 0 ${large} 0 ${x0} ${y0}`;
      const mid = (a0 + a1) / 2;
      const rm = (r0 + r1) / 2;
      wedges.push({
        n,
        d,
        fill: person ? (person.gender === "male" ? "var(--color-male-fill)" : "var(--color-female-fill)") : "transparent",
        labelX: cx + rm * Math.cos(mid),
        labelY: cy + rm * Math.sin(mid),
        name: person ? fullName(person) : "",
        id: person?.id ?? null,
      });
    }
  }

  if (!focus) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">{copy.emptyTree}</div>;
  }

  return (
    <div className="tree-grid flex h-full items-center justify-center overflow-auto p-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-3xl" role="img">
        {wedges.map((w) => (
          <g key={w.n}>
            <path
              d={w.d}
              fill={w.fill}
              stroke="var(--color-line)"
              strokeWidth={1}
              className={w.id ? "cursor-pointer" : undefined}
              onClick={() => w.id && openFile(w.id)}
              onDoubleClick={() => {
                if (!w.id) return;
                setFocus(w.id);
                openFile(w.id);
              }}
              opacity={w.id && selectedId === w.id ? 1 : w.id ? 0.95 : 0.35}
            />
            {w.name ? (
              <text
                x={w.labelX}
                y={w.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none fill-ink"
                fontSize={11}
                fontWeight={600}
              >
                {w.name.split(" ")[0]}
              </text>
            ) : null}
          </g>
        ))}
        <circle
          cx={cx}
          cy={cy}
          r={inner - 6}
          fill={focus.gender === "male" ? "var(--color-male)" : "var(--color-female)"}
          className="cursor-pointer"
          onClick={() => setSelected(focus.id)}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="pointer-events-none fill-cream"
          fontSize={13}
          fontWeight={600}
        >
          {focus.givenName}
        </text>
      </svg>
    </div>
  );
}
