import "./style.css";
import Link from "next/link";
export const metadata = { title: "mtch.", description: "Обратный найм для ИТ" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body><header><Link href="/">mtch.</Link><nav><Link href="/login">Вход</Link><Link href="/register">Регистрация</Link></nav></header><main>{children}</main></body></html>; }
