import "./style.css";
import { Onest } from "next/font/google";
import { SiteHeader } from "@/components/site-header";

const onest = Onest({
  subsets: ["cyrillic", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-onest",
});

export const metadata = { title: "mtch.", description: "Обратный найм для ИТ" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru" className={onest.variable}><body><SiteHeader /><main>{children}</main></body></html>; }
