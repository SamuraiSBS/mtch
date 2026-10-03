"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, CircleUserRound, Heart, LogOut, MapPin, MessageCircle, MoreHorizontal, Pencil, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, send } from "./api";
import { UiIcon } from "./ui-icon";
import { EMPLOYMENT, EXPERIENCE, LEVEL, WORK } from "./fields";

type DashboardSection = "offers" | "favorites" | "messages" | "profile";
type Profile = {
  firstName: string;
  lastName: string;
  age: number | null;
  city: string | null;
  profession: string;
  experience: string | null;
  level: string | null;
  cooperationType: string | null;
  skills: { id: string; name: string }[];
  about: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  behanceGitlabUrl: string | null;
  telegram: string | null;
  salaryMinRub: number | null;
  salaryMaxRub: number | null;
  workFormat: string | null;
  employmentType: string | null;
  searchStatus: string;
  avatarFileId: string;
  resume: string | null;
  resumeFileId?: string | null;
};

const labelFor = (value: string | null | undefined, options: readonly (readonly string[])[]) => options.find(([key]) => key === value)?.[1] ?? "";
const workLabels = WORK;
const employmentLabels = EMPLOYMENT;
const experienceLabels = EXPERIENCE;
const levelLabels = LEVEL;
const cooperationLabels = [["STAFF", "Штат"], ["PROJECT", "Проект"], ["FREELANCE", "Фриланс"], ["INTERNSHIP", "Стажировка"]] as const;
const statusLabels: Record<string, string> = { ACTIVE: "Активно ищу", OPEN_TO_OFFERS: "Открыт к предложениям", NOT_LOOKING: "Не ищу" };
const money = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const ageLabel = (age: number) => {
  const lastTwo = age % 100;
  const last = age % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14 ? "лет" : last === 1 ? "год" : last >= 2 && last <= 4 ? "года" : "лет";
  return `${age} ${noun}`;
};

const specialistNavigation: { section: Exclude<DashboardSection, "profile">; href: string; label: string; icon: LucideIcon }[] = [
  { section: "offers", href: "/offers", label: "Лента предложений", icon: BriefcaseBusiness },
  { section: "favorites", href: "/favorites", label: "Избранное", icon: Heart },
  { section: "messages", href: "/messages", label: "Чаты", icon: MessageCircle },
];

export function SpecialistSidebar({ active }: { active: DashboardSection }) {
  return <aside className="specialist-sidebar" aria-label="Меню исполнителя">
    <Link className="specialist-sidebar__logo" href="/offers" aria-label="mtch — лента предложений"><Image src="/logo-header.png" width={1462} height={462} priority alt="mtch." /></Link>
    <nav className="specialist-sidebar__main" aria-label="Разделы исполнителя">
      {specialistNavigation.map((item) => {
        const Icon = item.icon;
        return <Link key={item.section} className={active === item.section ? "specialist-sidebar__link is-active" : "specialist-sidebar__link"} href={item.href} aria-label={item.label} title={item.label} aria-current={active === item.section ? "page" : undefined}>
          <UiIcon icon={Icon} size={24} /><span className="sr-only">{item.label}</span>
        </Link>;
      })}
    </nav>
    <div className="specialist-sidebar__bottom">
      <Link className={active === "profile" ? "specialist-sidebar__link is-active" : "specialist-sidebar__link"} href="/profile" aria-label="Мой профиль" title="Мой профиль" aria-current={active === "profile" ? "page" : undefined}>
        <UiIcon icon={CircleUserRound} size={24} /><span className="sr-only">Мой профиль</span>
      </Link>
    </div>
  </aside>;
}

export function SpecialistProfileScreen({ profileId, onEdit, onLogout }: { profileId: string; onEdit?: () => void; onLogout?: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("О себе");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const tabs = ["О себе", "Опыт", "Навыки", "Ссылки"];

  useEffect(() => {
    let active = true;
    api<Profile>(`/specialists/${profileId}`).then((data) => { if (active) setProfile(data); })
      .catch((reason) => { if (active) setError((reason as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profileId]);

  async function shareProfile() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/specialists/${profileId}`);
      setShareMessage("Ссылка скопирована");
      window.setTimeout(() => setShareMessage(""), 2400);
    } catch { setShareMessage("Не удалось скопировать ссылку"); }
  }

  if (loading) return <section className="specialist-content"><p role="status">Загружаем профиль…</p></section>;
  if (error || !profile) return <section className="specialist-content"><p className="specialist-dashboard__error" role="alert">{error || "Профиль не найден"}</p>{onEdit && <button className="specialist-secondary-button" onClick={onEdit}><UiIcon icon={Pencil} size={16} />Редактировать анкету</button>}</section>;

  const workHistory = labelFor(profile.experience, experienceLabels);
  const level = labelFor(profile.level, levelLabels);
  const salary = profile.salaryMinRub && profile.salaryMaxRub ? `${money(profile.salaryMinRub)} — ${money(profile.salaryMaxRub)} ₽` : "Зарплата не указана";
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const links = [
    ["Портфолио", profile.portfolioUrl],
    ["GitHub", profile.githubUrl],
    ["Behance / GitLab", profile.behanceGitlabUrl],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return <section className="specialist-profile-screen" aria-label="Предварительный просмотр профиля">
    <header className="specialist-profile-screen__toolbar">
      <div><span>ПРОФИЛЬ ИСПОЛНИТЕЛЯ</span><p>Так ваш профиль видят работодатели</p></div>
      <div className="specialist-profile-screen__tools">
        {onEdit && <button className="specialist-profile-screen__edit" onClick={onEdit}><UiIcon icon={Pencil} size={16} />Редактировать</button>}
        {onEdit && <button className="specialist-profile-screen__icon-button" aria-label="Поделиться профилем" title="Скопировать ссылку" onClick={() => void shareProfile()}><UiIcon icon={Share2} size={18} /></button>}
        {onLogout && <div className="specialist-profile-screen__menu-wrap">
          <button className="specialist-profile-screen__icon-button" aria-label="Дополнительные действия" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><UiIcon icon={MoreHorizontal} size={18} /></button>
          {menuOpen && <div className="specialist-profile-screen__menu"><button onClick={onLogout}><UiIcon icon={LogOut} size={15} />Выйти из аккаунта</button></div>}
        </div>}
      </div>
    </header>
    {shareMessage && <p className="specialist-profile-screen__toast" role="status">{shareMessage}</p>}
    <div className="specialist-profile-hero">
      <div className="specialist-profile-hero__photo">
        {profile.avatarFileId && <Image src={`/api/v1/media/${profile.avatarFileId}?size=256`} width={360} height={360} unoptimized alt={`Фото ${name}`} />}
      </div>
      <div className="specialist-profile-hero__content">
        <h1>{name}</h1>
        <p className="specialist-profile-hero__profession">{profile.profession}{level ? ` · ${level}` : ""}</p>
        {profile.skills.length > 0 && <div className="specialist-profile-hero__skills">{profile.skills.slice(0, 6).map((skill) => <span key={skill.id}>{skill.name}</span>)}{profile.skills.length > 6 && <span>+{profile.skills.length - 6}</span>}</div>}
        <div className="specialist-profile-hero__meta">
          {workHistory && <span><UiIcon icon={BriefcaseBusiness} size={16} />{workHistory}</span>}
          {profile.city && <span><UiIcon icon={MapPin} size={16} />{profile.city}</span>}
          <span className={`specialist-profile-hero__status status-${profile.searchStatus.toLowerCase()}`}><i />{statusLabels[profile.searchStatus] ?? profile.searchStatus}</span>
        </div>
        {profile.age && <p className="specialist-profile-hero__age">{ageLabel(profile.age)}</p>}
        <strong className="specialist-profile-hero__salary">{salary}</strong>
        <div className="specialist-profile-hero__pills">
          {profile.workFormat && <span className="is-accent">{labelFor(profile.workFormat, workLabels)}</span>}
          {profile.employmentType && <span>{labelFor(profile.employmentType, employmentLabels)}</span>}
          {profile.cooperationType && <span>{labelFor(profile.cooperationType, cooperationLabels)}</span>}
        </div>
      </div>
    </div>
    <nav className="specialist-profile-tabs" aria-label="Разделы профиля">
      {tabs.map((tab) => <button type="button" key={tab} className={activeTab === tab ? "is-active" : ""} aria-current={activeTab === tab ? "page" : undefined} onClick={() => setActiveTab(tab)}>{tab}</button>)}
    </nav>
    <div className="specialist-profile-details">
      <section className="specialist-profile-details__main">
        {activeTab === "О себе" && <article className="specialist-profile-card"><h2>О себе</h2><p className="specialist-profile-card__about">{profile.about || "Описание пока не добавлено."}</p><dl className="specialist-profile-facts">
          <div><dt>Специализация</dt><dd>{profile.profession}</dd></div>
          <div><dt>Уровень</dt><dd>{level || "Не указан"}</dd></div>
          <div><dt>Опыт работы</dt><dd>{workHistory || "Не указан"}</dd></div>
          <div><dt>Желаемая зарплата</dt><dd>{salary}</dd></div>
          <div><dt>Формат работы</dt><dd>{labelFor(profile.workFormat, workLabels) || "Не указан"}</dd></div>
          <div><dt>Занятость</dt><dd>{labelFor(profile.employmentType, employmentLabels) || "Не указана"}</dd></div>
          <div><dt>Статус</dt><dd><span className="specialist-profile-facts__status"><i />{statusLabels[profile.searchStatus] ?? profile.searchStatus}</span></dd></div>
        </dl></article>}
        {activeTab === "Опыт" && <article className="specialist-profile-card"><h2>Профессия и опыт</h2><div className="specialist-profile-experience"><span><UiIcon icon={BriefcaseBusiness} size={18} /></span><div><strong>{profile.profession}</strong><p>{workHistory || "Опыт не указан"}{level ? ` · ${level}` : ""}</p></div></div><h3>Что ищу</h3><p>{labelFor(profile.cooperationType, cooperationLabels) || "Тип занятости не указан"} · {labelFor(profile.employmentType, employmentLabels) || "Занятость не указана"}</p></article>}
        {activeTab === "Навыки" && <article className="specialist-profile-card"><h2>Навыки</h2>{profile.skills.length ? <div className="specialist-profile-skill-grid">{profile.skills.map((skill) => <span key={skill.id}>{skill.name}</span>)}</div> : <p>Навыки пока не добавлены.</p>}</article>}
        {activeTab === "Ссылки" && <article className="specialist-profile-card"><h2>Ссылки и контакты</h2><div className="specialist-profile-links">{links.map(([label, href]) => <a href={href} target="_blank" rel="noreferrer" key={label}><span>{label}</span><strong>{href.replace(/^https?:\/\//, "")}</strong></a>)}{profile.telegram && <a href={`https://t.me/${profile.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><span>Telegram</span><strong>{profile.telegram}</strong></a>}{links.length === 0 && !profile.telegram && <p>Ссылки пока не добавлены.</p>}</div></article>}
      </section>
      <aside className="specialist-profile-details__side">
        <article className="specialist-profile-card"><h2>Контакты</h2>
          {profile.telegram && <a className="specialist-profile-contact" href={`https://t.me/${profile.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><span className="specialist-profile-contact__icon is-telegram">↗</span><span>{profile.telegram}</span></a>}
          {profile.city && <p className="specialist-profile-contact"><span className="specialist-profile-contact__icon"><UiIcon icon={MapPin} size={16} /></span><span>{profile.city}</span></p>}
          {!profile.telegram && !profile.city && <p className="muted">Контактные данные не добавлены.</p>}
        </article>
        <article className="specialist-profile-card"><h2>Ссылки</h2>
          {links.length ? links.map(([label, href]) => <a className="specialist-profile-side-link" href={href} target="_blank" rel="noreferrer" key={label}><span>{label}</span><strong>{href.replace(/^https?:\/\//, "")}</strong></a>) : <p className="muted">Ссылки не добавлены.</p>}
        </article>
        {profile.resume === "ATTACHED" && <article className="specialist-profile-card"><h2>Резюме</h2><div className="specialist-profile-resume"><span>PDF</span><div><strong>Резюме прикреплено</strong><small>Файл добавлен к анкете</small></div></div></article>}
      </aside>
    </div>
  </section>;
}
