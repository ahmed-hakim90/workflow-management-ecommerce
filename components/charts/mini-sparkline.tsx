"use client";

export function MiniSparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length === 0) return <div className={className} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 36;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x =
        pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        vectorEffect="non-scaling-stroke"
        className="text-[color:var(--color-primary)]"
      />
    </svg>
  );
}
