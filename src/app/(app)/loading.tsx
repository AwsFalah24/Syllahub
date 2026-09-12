export default function Loading() {
  return (
    <div className="animate-pulse-soft" aria-busy aria-label="Loading">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 rounded bg-surface-2" />
        <div className="h-8 w-64 rounded-lg bg-surface-2" />
        <div className="h-4 w-80 max-w-full rounded bg-surface-2" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="h-16 rounded-2xl bg-surface" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-surface" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
