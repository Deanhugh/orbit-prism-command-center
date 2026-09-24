import { APP_HOME } from "@/lib/home";

export function PageHead({ title }: { title: string }) {
  return (
    <div className="border-b border-line px-5 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">
        <a href={APP_HOME} className="hover:text-ink">
          Dashboard
        </a>
        <span className="px-2">/</span>
        {title}
      </p>
    </div>
  );
}
