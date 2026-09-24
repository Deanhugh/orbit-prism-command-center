"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  firstVisit,
}: {
  firstVisit: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id="password"
        name="password"
        type={show ? "text" : "password"}
        autoComplete={firstVisit ? "new-password" : "current-password"}
        autoFocus
        required
        minLength={firstVisit ? 6 : 1}
        placeholder="Password"
        className="h-12 w-full rounded-full border border-white/10 bg-[#141414]/90 px-5 pr-12 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/80"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
