import LogoLoader from "@/components/LogoLoader";

export default function Loading() {
  return (
    <div className="h-full min-h-[60vh]">
      <LogoLoader fullScreen={false} background="transparent" />
    </div>
  );
}
