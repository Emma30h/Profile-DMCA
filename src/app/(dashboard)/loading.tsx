import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <Spinner size={40} className="text-[var(--c-blue)]" />
    </div>
  );
}
