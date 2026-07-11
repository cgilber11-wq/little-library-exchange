import Link from "next/link";
import { Emblem } from "./Emblem";

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={["group flex items-center gap-2.5", className ?? ""].join(" ")}
    >
      <Emblem className="h-8 w-8 shrink-0 transition-transform group-hover:scale-105" />
      <span className="flex items-center gap-2 leading-tight">
        <span className="font-serif text-[1.05rem] font-semibold tracking-tight text-stone-900 sm:text-lg">
          Little Library Exchange
        </span>
        <span
          className="hidden rounded-full border border-amber-200/80 bg-amber-50/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800/90 sm:inline-flex"
          title="This is an early alpha release — expect rough edges."
        >
          Alpha
        </span>
      </span>
    </Link>
  );
}
