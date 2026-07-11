"use client";

import { useId, useState, type ReactNode } from "react";

type Tab = {
  id: "little-library" | "collection";
  label: string;
  badge?: ReactNode;
  content: ReactNode;
};

export function LibraryInventoryTabs({ tabs }: { tabs: Tab[] }) {
  const baseId = useId();
  const [active, setActive] = useState<Tab["id"]>("little-library");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Library inventory"
        className="mb-4 flex flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-stone-50/80 p-1"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={[
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
                selected
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:bg-white/70 hover:text-stone-900",
              ].join(" ")}
            >
              {tab.label}
              {tab.badge != null ? (
                <span
                  className={[
                    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    selected ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600",
                  ].join(" ")}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
