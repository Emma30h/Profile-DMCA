"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function VerLegajoBtn() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => router.push("/mi-legajo"));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="shrink-0 min-w-[112px] inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-80 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
    >
      {pending ? <Spinner /> : "Ver mi legajo"}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="spinner h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
