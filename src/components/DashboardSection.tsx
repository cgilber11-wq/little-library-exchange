import { type ReactNode } from "react";

export type DashboardSectionProps = {
  sectionId: string;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DashboardSection({
  sectionId,
  title,
  subtitle,
  headerRight,
  children,
  className = "",
  contentClassName = "",
}: DashboardSectionProps) {
  return (
    <section
      id={sectionId}
      className={["scroll-mt-28 cozy-card overflow-hidden", className].join(" ")}
    >
      <div className="cozy-panel flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="block font-serif text-lg font-semibold text-stone-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 block text-xs leading-relaxed text-stone-500">{subtitle}</p> : null}
        </div>
        {headerRight ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{headerRight}</div> : null}
      </div>
      <div className={["px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4", contentClassName].filter(Boolean).join(" ")}>
        {children}
      </div>
    </section>
  );
}
