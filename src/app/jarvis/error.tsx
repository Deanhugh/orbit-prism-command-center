"use client";

export default function JarvisError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="hud-label">Command Center</p>
        <h1 className="serif mt-3 text-[28px] font-medium tracking-tight">This page could not load.</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          The deck hit a snag. Reload Command Center to get back on the board.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              reset();
              window.location.assign("/jarvis");
            }}
            className="rounded-full bg-cyan px-5 py-2.5 text-[13px] font-semibold text-canvas"
          >
            Reload Command Center
          </button>
        </div>
      </div>
    </div>
  );
}
