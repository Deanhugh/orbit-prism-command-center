"use client";

import { useEffect } from "react";
import { useOffice } from "./store";

/** Connect to the event stream. Safe to call once per page. */
export function useOrbitInit() {
  const connect = useOffice((s) => s.connect);

  useEffect(() => {
    connect();
  }, [connect]);
}
