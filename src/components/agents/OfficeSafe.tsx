"use client";

import { Component, type ReactNode } from "react";

export class OfficeSafe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="grid h-full place-items-center px-4 text-center text-[11px] text-ink-soft">
          Office scene is unavailable in this browser.
        </div>
      );
    }
    return this.props.children;
  }
}
