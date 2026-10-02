"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  return <header className={`site-header${isAuthPage ? " site-header--auth" : ""}`}>
    <Link className="site-header__logo" href="/" aria-label="mtch — на главную">
      <Image src="/logo-header.png" width={2924} height={924} alt="" priority />
    </Link>
    {pathname === "/" && <Link className="site-header__login" href="/login">Войти</Link>}
  </header>;
}
