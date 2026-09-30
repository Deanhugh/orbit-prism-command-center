"use client";

import { Download, FileSpreadsheet, FileText, Film, Presentation, X } from "lucide-react";
import type { ArtifactMeta } from "@/lib/artifacts";

const DOWNLOADS: { format: string; label: string; icon: typeof FileText }[] = [
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "doc", label: "Word", icon: FileText },
  { format: "csv", label: "Excel", icon: FileSpreadsheet },
  { format: "pptx", label: "Presentation", icon: Presentation },
];

export function ArtifactPane({
  artifact,
  onClose,
}: {
  artifact: ArtifactMeta;
  onClose: () => void;
}) {
  const preview = `/api/agents/artifacts?id=${encodeURIComponent(artifact.id)}&format=preview`;
  const href = (format: string) =>
    `/api/agents/artifacts?id=${encodeURIComponent(artifact.id)}&format=${format}`;

  return (
    <aside className="flex min-h-[50vh] w-full shrink-0 flex-col border-t border-line bg-panel lg:h-full lg:w-[420px] lg:border-l lg:border-t-0">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{artifact.title}</span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-soft hover:bg-canvas-2 hover:text-ink"
          title="Close preview"
        >
          <X size={14} />
        </button>
      </header>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2">
        {DOWNLOADS.map((d) => (
          <a
            key={d.format}
            href={href(d.format)}
            download
            className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink"
          >
            <d.icon size={11} />
            {d.label}
          </a>
        ))}
        {artifact.videoUrl && (
          <a
            href={artifact.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink"
          >
            <Film size={11} />
            Video
          </a>
        )}
        <a
          href={href("md")}
          download
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-ink-soft hover:text-ink"
        >
          <Download size={11} />
          Markdown
        </a>
      </div>
      <div className="min-h-0 flex-1 bg-canvas">
        {artifact.kind === "video" && artifact.videoUrl ? (
          <video src={artifact.videoUrl} controls className="h-full w-full object-contain" />
        ) : (
          <iframe title={artifact.title} src={preview} className="h-full w-full border-0 bg-white" />
        )}
      </div>
    </aside>
  );
}
