"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { api } from "./api";

type Role = "SPECIALIST" | "EMPLOYER";
type CurrentUser = { role: Role };

export function SiteHeader() {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    let active = true;

    api<CurrentUser>("/auth/me")
      .then((current) => {
        if (active) setRole(current.role);
      })
      .catch(() => {
        if (active) setRole(null);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  const logoHref = role === "SPECIALIST"
    ? "/offers"
    : role === "EMPLOYER"
      ? "/feed"
      : "/";
  const logoLabel = role === "SPECIALIST"
    ? "mtch — предложения"
    : role === "EMPLOYER"
      ? "mtch — лента"
      : "mtch — на главную";

  async function handleLogoClick(event: MouseEvent<HTMLAnchorElement>) {
    if ((event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) || event.button !== 0) return;
    if (role !== null && pathname !== "/") return;

    event.preventDefault();
    try {
      const current = await api<CurrentUser>("/auth/me");
      setRole(current.role);
      router.push(current.role === "SPECIALIST" ? "/offers" : "/feed");
    } catch {
      setRole(null);
      router.push("/");
    }
  }

  return <header className={`site-header${isAuthPage ? " site-header--auth" : ""}`}>
    <Link className="site-header__logo" href={logoHref} aria-label={logoLabel} onClick={handleLogoClick}>
      <Image src="/logo-header.png" width={2924} height={924} alt="" priority />
    </Link>
    {pathname === "/" && <Link className="site-header__login" href="/login">Войти</Link>}
  </header>;
}
