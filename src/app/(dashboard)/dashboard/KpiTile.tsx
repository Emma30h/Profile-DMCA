"use client";

import { useRouter } from "next/navigation";

export default function KpiTile({
  label,
  value,
  sub,
  subClass,
  icon,
  badgeClass,
  href,
}: {
  label: string;
  value: number;
  sub: string;
  subClass?: string;
  icon: string;
  badgeClass: string;
  /** Si se pasa, doble click lleva a /personal con el filtro correspondiente. */
  href?: string;
}) {
  const router = useRouter();

  return (
    <div
      onDoubleClick={href ? () => router.push(href) : undefined}
      title={href ? "Doble click para ver en Personal" : undefined}
      className={`bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4 flex flex-col gap-2.5 transition-colors ${
        href ? "cursor-pointer hover:border-[var(--c-line-strong)] select-none" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--c-text-muted)]">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[13px] ${badgeClass}`}>
          {icon}
        </span>
      </div>
      <div className="text-[27px] font-semibold tracking-tight text-[var(--c-text)] tabular-nums">{value}</div>
      <div className={`text-[11.5px] ${subClass ?? "text-[var(--c-text-faint)]"}`}>{sub}</div>
    </div>
  );
}
