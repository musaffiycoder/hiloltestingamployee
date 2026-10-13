export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-9 w-64 animate-pulse rounded-xl bg-soft" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-[18px] bg-soft" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[18px] bg-soft" />
    </div>
  );
}
