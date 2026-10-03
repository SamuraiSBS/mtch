"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, GraduationCap, Heart, Inbox, MessageCircle, Search, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, send } from "./api";
import { UiIcon } from "./ui-icon";
import { SpecialistProfileWizard } from "./workspace-specialist-wizard";
import { CompanyPanel } from "./workspace-company";
import { OffersPanel } from "./workspace-offers";
import { EmployerPracticePanel, SpecialistPracticePanel } from "./workspace-practice";
import { SpecialistSidebar, SpecialistProfileScreen } from "./workspace-specialist-profile";
import { SpecialistFavoritesPanel, SpecialistOffersPanel } from "./workspace-specialist-offers";
import { ChatPanel } from "./workspace-chats";
import { EmployerCompanyProfile } from "./workspace-company-profile";
import { EmployerFavoritesPanel, EmployerSearchPanel, EmployerSidebar } from "./workspace-employer";
import type { EmployerSection } from "./workspace-employer";

export type Item = { id: string; name: string };
export type Catalogs = { professions: Item[]; cities: Item[]; skills: Item[] };
type Section = "home" | "profile" | "practice-invitations" | "offers" | "favorites" | "messages" | "match" | "company" | "search" | "feed" | "practice";
type User = { id: string; email: string; role: "SPECIALIST" | "EMPLOYER"; hasProfile: boolean; hasCompany: boolean };
const emptyCatalogs: Catalogs = { professions: [], cities: [], skills: [] };

const specialistPages: { section: Section; href: string; label: string; icon: LucideIcon }[] = [
  { section: "offers", href: "/offers", label: "Предложения", icon: Inbox },
  { section: "practice-invitations", href: "/practice-invitations", label: "Практика", icon: GraduationCap },
  { section: "favorites", href: "/favorites", label: "Избранное", icon: Heart },
  { section: "messages", href: "/messages", label: "Чаты", icon: MessageCircle },
  { section: "profile", href: "/profile", label: "Мой профиль", icon: UserRound },
];
const employerPages: { section: Section; href: string; label: string; icon: LucideIcon }[] = [
  { section: "search", href: "/search", label: "Поиск", icon: Search },
  { section: "practice", href: "/practice", label: "Наборы на практику", icon: GraduationCap },
  { section: "favorites", href: "/favorites", label: "Избранное", icon: Heart },
  { section: "match", href: "/match", label: "Чаты", icon: MessageCircle },
  { section: "company", href: "/company", label: "Профиль компании", icon: Building2 },
];

export function Workspace({ section }: { section: Section }) {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs>(emptyCatalogs);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyRevision, setCompanyRevision] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await api<User>("/auth/me");
        if (!active) return;
        setMe(current);

        if (current.role === "SPECIALIST" && !current.hasProfile && section !== "profile") {
          router.replace("/profile");
          return;
        }
        if (current.role === "EMPLOYER" && !current.hasCompany && section !== "company") {
          router.replace("/company");
          return;
        }

        if (section !== "home" && current.role === "SPECIALIST" && !specialistPages.some((page) => page.section === section)) {
          router.replace("/profile");
          return;
        }
        if (section !== "home" && current.role === "EMPLOYER" && !employerPages.some((page) => page.section === section)) {
          router.replace("/company");
          return;
        }
        if (section === "home") {
          router.replace(current.role === "SPECIALIST" ? current.hasProfile ? "/offers" : "/profile" : current.hasCompany ? "/search" : "/company");
          return;
        }

        const needsCatalogs = current.role === "SPECIALIST" && section === "profile"
          || current.role === "EMPLOYER" && (section === "search" || section === "practice");
        if (needsCatalogs) {
          const [professions, cities, skills] = await Promise.all([
            api<Item[]>("/catalogs/professions"),
            api<Item[]>("/catalogs/cities"),
            api<Item[]>("/catalogs/skills"),
          ]);
          if (active) setCatalogs({ professions, cities, skills });
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [router, section]);

  if (loading) return <p>Загрузка…</p>;
  if (!me) return <div className="card"><p>{error || "Нужен вход"}</p><Link className="button" href="/login">Войти</Link></div>;

  const pages = me.role === "SPECIALIST" ? specialistPages : employerPages;
  const title = pages.find((page) => page.section === section)?.label ?? "Кабинет";
  const profileSaved = me.role === "SPECIALIST" ? me.hasProfile : me.hasCompany;
  const specialistProfile = section === "profile" && me.role === "SPECIALIST";
  const specialistDashboard = me.role === "SPECIALIST" && me.hasProfile && !editingProfile
    && (section === "offers" || section === "practice-invitations" || section === "favorites" || section === "messages" || section === "profile");

  if (me.role === "EMPLOYER" && !me.hasCompany) return <div className="workspace workspace--profile">
    <CompanyPanel userId={me.id} email={me.email} onSaved={() => { setMe(old => old ? { ...old, hasCompany: true } : old); router.replace("/search"); }} onLogout={async () => { await send("/auth/logout", "POST"); router.replace("/"); }} />
  </div>;

  if (me.role === "EMPLOYER" && me.hasCompany && employerPages.some(page => page.section === section)) return <div className="specialist-dashboard employer-dashboard">
    <EmployerSidebar active={section === "practice" ? "search" : section as EmployerSection} />
    <div className="specialist-dashboard__main">
      {section === "search" && <EmployerSearchPanel catalogs={catalogs} />}
      {section === "practice" && <EmployerPracticePanel catalogs={catalogs} />}
      {section === "favorites" && <EmployerFavoritesPanel catalogs={catalogs} />}
      {section === "match" && <ChatPanel role="EMPLOYER" userId={me.id} />}
      {section === "company" && (editingCompany
        ? <CompanyPanel key={companyRevision} userId={me.id} email={me.email} onSaved={() => { setEditingCompany(false); setCompanyRevision(value => value + 1); }} onCancel={() => setEditingCompany(false)} onLogout={async () => { await send("/auth/logout", "POST"); router.replace("/"); }} />
        : <EmployerCompanyProfile key={companyRevision} onEdit={() => setEditingCompany(true)} onLogout={async () => { await send("/auth/logout", "POST"); router.replace("/"); }} />)}
    </div>
  </div>;

  if (specialistDashboard) return <div className="specialist-dashboard">
    <SpecialistSidebar active={section === "practice-invitations" ? "offers" : section as "offers" | "favorites" | "messages" | "profile"} />
    <div className="specialist-dashboard__main">
      {section === "offers" && <SpecialistOffersPanel onAccepted={(matchId) => router.replace(`/messages?match=${matchId}`)} />}
      {section === "practice-invitations" && <SpecialistPracticePanel />}
      {section === "favorites" && <SpecialistFavoritesPanel />}
      {section === "messages" && <ChatPanel role="SPECIALIST" userId={me.id} />}
      {section === "profile" && <SpecialistProfileScreen profileId={me.id} onEdit={() => setEditingProfile(true)} onLogout={async () => { await send("/auth/logout", "POST"); router.replace("/"); }} />}
    </div>
  </div>;

  return <div className={specialistProfile ? "workspace workspace--profile" : "workspace"}>
    {!specialistProfile && <div className="workspace-heading">
      <div><h1>{title}</h1><p>{me.email}</p></div>
      <button className="secondary" onClick={async () => { await send("/auth/logout", "POST"); router.replace("/"); }}>Выйти</button>
    </div>}
    {!specialistProfile && profileSaved && <nav className="workspace-nav" aria-label="Разделы кабинета">
      {pages.map((page) => <Link key={page.section} className={section === page.section ? "workspace-nav__link active" : "workspace-nav__link"} aria-current={section === page.section ? "page" : undefined} href={page.href}><UiIcon icon={page.icon} size={16} /><span>{page.label}</span></Link>)}
    </nav>}
    {(profileSaved || section === "profile") && <>
      {specialistProfile && (!me.hasProfile || editingProfile) && <SpecialistProfileWizard
        catalogs={catalogs}
        userId={me.id}
        onSaved={() => {
          setMe((old) => old ? { ...old, hasProfile: true } : old);
          if (me.hasProfile) setEditingProfile(false);
          else router.replace("/offers");
        }}
        onCancel={me.hasProfile ? () => {
          try { window.localStorage.removeItem(`mtch:specialist-profile-draft:${me.id}`); } catch { /* Closing the editor should still work when storage is unavailable. */ }
          setEditingProfile(false);
        } : undefined}
        onLogout={async () => { await send("/auth/logout", "POST"); router.replace("/"); }}
      />}
      {section === "practice-invitations" && me.role === "SPECIALIST" && <SpecialistPracticePanel />}
      {section === "offers" && <OffersPanel side={me.role === "SPECIALIST" ? "incoming" : "outgoing"} />}
    </>}
  </div>;
}
