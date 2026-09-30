export type ArtifactKind = "document" | "slides" | "sheet" | "video";

export interface ArtifactMeta {
  id: string;
  title: string;
  kind: ArtifactKind;
  markdown: string;
  videoUrl?: string;
  createdAt: number;
  convId?: string;
}

const VIDEO_RE = /https?:\/\/[^\s)]+\.(?:mp4|webm|mov)(?:\?[^\s)]*)?/i;
const GENERIC_VIDEO_RE = /https?:\/\/[^\s)]+/i;

export function extractVideoUrl(text: string): string | undefined {
  const direct = text.match(VIDEO_RE);
  if (direct) return direct[0];
  if (/\b(video|mp4|webm|higgsfield|krea)\b/i.test(text)) {
    const any = text.match(GENERIC_VIDEO_RE);
    if (any && /krea|higgsfield|youtube|vimeo|railway|blob/i.test(any[0])) return any[0];
  }
  return undefined;
}

export function titleFromMarkdown(md: string, fallback = "Deliverable"): string {
  const h = md.match(/^#{1,3}\s+(.+)$/m);
  if (h) return h[1].trim().slice(0, 80);
  const line = md.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("```"));
  return (line || fallback).replace(/^[#>*\-\d.\s]+/, "").slice(0, 80) || fallback;
}

export function inferArtifactKind(userText: string, assistantText: string): ArtifactKind | null {
  const u = userText.toLowerCase();
  const a = assistantText.toLowerCase();
  const both = `${u} ${a}`;
  if (extractVideoUrl(assistantText) || /\b(video download|mp4|webm)\b/.test(u)) return "video";
  if (/\b(slide|deck|powerpoint|presentation|pptx)\b/.test(both)) return "slides";
  if (/\b(excel|spreadsheet|xlsx|csv|workbook)\b/.test(both)) return "sheet";
  if (/\b(pdf|word|docx|playbook|document|brief|report|whitepaper|download)\b/.test(u)) return "document";
  if (/^#{1,3}\s/m.test(assistantText) && assistantText.trim().length > 400) return "document";
  return null;
}

export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function estimateTokens(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return Math.max(1, Math.ceil(t.length / 4));
}
