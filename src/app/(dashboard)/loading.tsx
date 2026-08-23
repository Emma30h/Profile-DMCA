export default function Loading() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <span className="h-10 w-10 rounded-full border-2 border-[var(--c-line)] border-t-[var(--c-blue)] animate-spin" />
    </div>
  );
}
