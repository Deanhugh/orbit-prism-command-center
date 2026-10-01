"use client";

import { useCallback, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { DrawJsonElement } from "@/lib/draw-scene";

export function ExcalidrawCanvas({
  sceneId,
  elements,
  viewBackgroundColor,
  onPersist,
}: {
  sceneId: string;
  elements: DrawJsonElement[];
  viewBackgroundColor: string;
  onPersist: (elements: DrawJsonElement[], viewBackgroundColor: string) => void;
}) {
  const timer = useRef<number | null>(null);

  const persist = useCallback(
    (next: readonly unknown[], appState: { viewBackgroundColor?: string }) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        onPersist(next as DrawJsonElement[], appState.viewBackgroundColor || viewBackgroundColor);
      }, 700);
    },
    [onPersist, viewBackgroundColor],
  );

  return (
    <div className="h-full min-h-[320px] w-full [&_.excalidraw]:h-full">
      <Excalidraw
        key={sceneId}
        initialData={{
          elements: elements as never,
          appState: { viewBackgroundColor },
          scrollToContent: true,
        }}
        theme="light"
        UIOptions={{ canvasActions: { toggleTheme: true } }}
        onChange={(els, state) => persist(els, state)}
      />
    </div>
  );
}
