"use client";

import type { StoredBrief } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BriefBody({
  brief,
  compact = false,
}: {
  brief: StoredBrief;
  compact?: boolean;
}) {
  const evening = brief.kind === "evening";
  return (
    <div className={cn("space-y-6 text-[15px] leading-relaxed", compact && "space-y-4 text-[13px]")}>
      <p className={cn("text-ink-soft", compact && "text-[13px]")}>{brief.narrative}</p>
      <BriefSection title="Today" items={brief.sections.today} compact={compact} />
      <BriefSection title="Waiting on you" items={brief.sections.waitingOnYou} compact={compact} />
      {!compact ? <BriefSection title="Waiting on them" items={brief.sections.waitingOnThem} /> : null}
      {!compact ? <BriefSection title="Tomorrow" items={brief.sections.tomorrow} /> : null}
      {evening && brief.sections.doneToday.length ? (
        <BriefSection title="Done today" items={brief.sections.doneToday} compact={compact} />
      ) : null}
    </div>
  );
}

function BriefSection({
  title,
  items,
  compact,
}: {
  title: string;
  items: string[];
  compact?: boolean;
}) {
  return (
    <section>
      <h2 className={cn("serif font-bold", compact ? "text-[13px]" : "text-[18px]")}>{title}</h2>
      <ul className={cn("mt-2 list-disc space-y-1.5 pl-5", compact && "mt-1.5 text-[12px] leading-relaxed")}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
