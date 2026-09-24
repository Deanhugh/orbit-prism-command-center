// Categories + colors for the 3D Brain, matching the AIS-OS /3d-brain palette.
// (Adapted from AIS-OS by Nate Herk, MIT — see README credits.)
export interface BrainCategory {
  id: string;
  label: string;
  color: string;
}

export const BRAIN_CATEGORIES: BrainCategory[] = [
  { id: "business", label: "Business knowledge", color: "#4ecdc4" },
  { id: "projects", label: "Projects", color: "#5fd39b" },
  { id: "skills", label: "Skills", color: "#ffa07a" },
  { id: "meetings", label: "Meetings", color: "#e0a94a" },
  { id: "video", label: "Video knowledge", color: "#ff6b6b" },
  { id: "memory", label: "Claude memory", color: "#b197fc" },
  // attachments (every file)
  { id: "images", label: "Images", color: "#f4a3c1" },
  { id: "documents", label: "PDFs & docs", color: "#d98c5f" },
  { id: "canvas", label: "Canvas", color: "#8ad4ff" },
  { id: "attachments", label: "Attachments", color: "#9aa7b5" },
];

export const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  BRAIN_CATEGORIES.map((c) => [c.id, c.color]),
);

export function categoryFor(rel: string, title: string): string {
  const p = (rel + " " + title).toLowerCase();
  if (p.includes("skill")) return "skills";
  if (rel.toLowerCase().startsWith("orbit prism operating system")) return "projects";
  if (p.includes("meeting")) return "meetings";
  if (p.includes("video")) return "video";
  if (p.includes("feedback") || p.includes("memory")) return "memory";
  return "business";
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"]);
const DOC_EXTS = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".key", ".pages"]);

/** Category for a non-text attachment, by file extension. */
export function categoryForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.has(e)) return "images";
  if (DOC_EXTS.has(e)) return "documents";
  if (e === ".canvas") return "canvas";
  return "attachments";
}
