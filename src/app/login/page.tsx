import { redirect } from "next/navigation";
import { localUserCount } from "@/lib/server/auth";
import { getSessionUser } from "@/lib/server/session";
import { PasswordField } from "@/components/login/PasswordField";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  wrong: "Wrong password for this copy of the app.",
  taken: "Access is already set on this machine. Enter the password.",
  short_user: "Could not create access on this machine.",
  short_pass: "Password must be at least 6 characters.",
  fail: "Could not unlock. Try the password again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const existing = await getSessionUser();
  if (existing) redirect("/jarvis");

  const params = await searchParams;
  const firstVisit = localUserCount() === 0;
  const error = params.error ? ERRORS[params.error] || ERRORS.fail : "";

  return (
    <main className="relative grid h-screen place-items-center overflow-hidden px-6">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/login-bg.jpg)" }}
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/70" />

      <div className="relative flex w-full max-w-[760px] flex-col items-center text-center">
        <h1 className="flex w-full flex-col items-center text-white">
          <span className="block w-full text-center text-[clamp(42px,8.4vw,86px)] font-extrabold leading-none tracking-[-0.045em]">
            ORBIT PRISM
          </span>
          <span className="mt-3 block w-full text-center text-[clamp(11px,1.7vw,15px)] font-medium uppercase tracking-[0.22em] text-white">
            Operating System Command Center
          </span>
        </h1>

        <p className="mt-10 flex items-center justify-center gap-3 text-[9px] font-medium uppercase tracking-[0.38em] text-white/45">
          <span className="h-px w-8 bg-white/25" />
          Authenticate
          <span className="h-px w-8 bg-white/25" />
        </p>

        <form
          method="post"
          action={firstVisit ? "/api/auth/register" : "/api/auth/login"}
          className="mt-8 w-full max-w-[360px] space-y-3"
        >
          <PasswordField firstVisit={firstVisit} />

          {error ? (
            <p className="text-[12px] text-[#e0567a]">{error}</p>
          ) : firstVisit ? (
            <p className="text-[11px] text-white/40">Set a password for this machine (6+ characters).</p>
          ) : null}

          <button
            type="submit"
            className="h-12 w-full rounded-full bg-[#d9d9d9] text-[14px] font-medium text-black transition hover:bg-white"
          >
            Enter
          </button>
        </form>

        <p className="mt-10 text-[9px] font-medium uppercase tracking-[0.32em] text-white/40">
          A Orbit Prism System
        </p>
      </div>
    </main>
  );
}
