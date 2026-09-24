import { Montserrat } from "next/font/google";

export const dynamic = "force-dynamic";

const lockup = Montserrat({
  subsets: ["latin"],
  weight: ["500", "800"],
  display: "swap",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={lockup.className}>{children}</div>;
}
