"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Building2, Globe2, Image as ImageIcon, LogOut, Mail, Pencil, Phone, Send, UsersRound } from "lucide-react";
import { api } from "./api";
import { UiIcon } from "./ui-icon";

type Company = {
  name: string;
  description: string;
  workFormat: string;
  foundedYear: number;
  sizeBand: string;
  industry: string;
  websiteUrl: string | null;
  logoFileId: string;
  logoUrl: string;
  contactEmail: string | null;
  ownerEmail: string;
  telegram: string | null;
  phone: string | null;
  socialLinks: { id: string; platform: string; value: string }[];
  photos: { id: string; fileId: string; category: string; url: string }[];
};

const workFormats: Record<string, string> = { REMOTE: "Удалённо", HYBRID: "Гибрид", OFFICE: "Офис" };
const sizeBands: Record<string, string> = { "1-10": "1–10", "11-50": "11–50", "51-200": "51–200", "201-1000": "201–1000", "1000+": "1000+" };
const socialNames: Record<string, string> = { TELEGRAM: "Telegram", VK: "VK", LINKEDIN: "LinkedIn", YOUTUBE: "YouTube", INSTAGRAM: "Instagram", TIKTOK: "TikTok", X: "X", OTHER: "Другая ссылка" };
const photoNames: Record<string, string> = { OFFICE: "Офис", TEAM: "Команда", WORKSPACE: "Рабочие места", PROCESSES: "Рабочие процессы", OTHER: "Другое" };

export function EmployerCompanyProfile({ onEdit, onLogout }: { onEdit: () => void; onLogout: () => void }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("О компании");

  useEffect(() => {
    let active = true;
    api<Company>("/companies/me")
      .then(value => { if (active) setCompany(value); })
      .catch(reason => { if (active) setError((reason as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <section className="specialist-content"><p className="specialist-dashboard__empty">Загружаем профиль компании…</p></section>;
  if (error || !company) return <section className="specialist-content"><p className="specialist-dashboard__error" role="alert">{error || "Профиль компании не найден"}</p><button className="specialist-secondary-button" onClick={onEdit}><UiIcon icon={Pencil} size={15} />Заполнить профиль</button></section>;

  const tabs = ["О компании", "Фотографии", "Контакты"];
  const groupedPhotos = company.photos.reduce<Record<string, Company["photos"]>>((groups, photo) => {
    (groups[photo.category] ??= []).push(photo);
    return groups;
  }, {});

  return <section className="specialist-content employer-company-profile" aria-label="Профиль компании">
    <header className="employer-company-profile__toolbar"><div><span>ПРОФИЛЬ РАБОТОДАТЕЛЯ</span><p>Так исполнители видят вашу компанию</p></div><div><button type="button" className="specialist-secondary-button" onClick={onEdit}><UiIcon icon={Pencil} size={16} />Редактировать</button><button type="button" className="specialist-secondary-button employer-company-profile__logout" onClick={onLogout}><UiIcon icon={LogOut} size={16} /><span>Выйти</span></button></div></header>
    <div className="employer-company-profile__hero">
      <div className="employer-company-profile__logo">{company.logoFileId ? <Image src={company.logoUrl || `/api/v1/media/${company.logoFileId}`} width={280} height={280} unoptimized alt={`Логотип ${company.name}`} /> : <UiIcon icon={Building2} size={32} />}</div>
      <div className="employer-company-profile__intro">
        <p className="employer-company-profile__industry">{company.industry} · Компания</p>
        <h1>{company.name}</h1>
        <p>{company.description}</p>
        <div className="employer-company-profile__tags"><span>{workFormats[company.workFormat] ?? company.workFormat}</span>{company.websiteUrl && <a href={company.websiteUrl} target="_blank" rel="noreferrer"><UiIcon icon={Globe2} size={15} />{company.websiteUrl.replace(/^https?:\/\//, "")}</a>}</div>
        <div className="employer-company-profile__facts"><span><Building2 size={17} />Основана в {company.foundedYear}</span><span><UsersRound size={17} />{sizeBands[company.sizeBand] ?? company.sizeBand} сотрудников</span>{company.photos.length > 0 && <span><ImageIcon size={17} />{company.photos.length} фото</span>}</div>
      </div>
    </div>
    <div className="employer-company-profile__tabs" role="tablist" aria-label="Информация о компании">
      {tabs.map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{item}{item === "Фотографии" && company.photos.length > 0 && <span>{company.photos.length}</span>}</button>)}
    </div>
    {tab === "О компании" && <div className="employer-company-profile__body">
      <section className="specialist-profile-card"><h2>О компании</h2><p className="employer-company-profile__description">{company.description}</p><dl className="specialist-profile-facts">
        <div><dt>Сфера деятельности</dt><dd>{company.industry}</dd></div>
        <div><dt>Формат работы</dt><dd>{workFormats[company.workFormat] ?? company.workFormat}</dd></div>
        <div><dt>Размер команды</dt><dd>{sizeBands[company.sizeBand] ?? company.sizeBand} сотрудников</dd></div>
        <div><dt>Год основания</dt><dd>{company.foundedYear}</dd></div>
        {company.websiteUrl && <div><dt>Сайт</dt><dd><a href={company.websiteUrl} target="_blank" rel="noreferrer">{company.websiteUrl.replace(/^https?:\/\//, "")}</a></dd></div>}
      </dl></section>
      <aside className="employer-company-profile__side">
        <section className="specialist-profile-card"><h2>Контакты</h2><p><UiIcon icon={Mail} size={16} />{company.contactEmail || company.ownerEmail}</p>{company.telegram && <p><UiIcon icon={Send} size={16} />{company.telegram}</p>}{company.phone && <p><UiIcon icon={Phone} size={16} />{company.phone}</p>}</section>
        {company.photos.length > 0 && <button type="button" className="employer-company-profile__gallery-preview" onClick={() => setTab("Фотографии")}><span>Фотографии компании <b>{company.photos.length}</b></span><span>{company.photos.slice(0, 3).map(photo => <Image key={photo.id} src={photo.url} width={112} height={80} unoptimized alt="" />)}</span></button>}
      </aside>
    </div>}
    {tab === "Фотографии" && <div className="employer-company-profile__gallery">
      {Object.entries(groupedPhotos).length === 0 ? <div className="specialist-dashboard__empty-card"><span className="specialist-dashboard__empty-icon"><UiIcon icon={ImageIcon} size={22} /></span><h2>Фотографий пока нет</h2><p>Добавьте снимки офиса, команды и рабочего пространства в редакторе профиля.</p><button type="button" className="specialist-secondary-button" onClick={onEdit}><UiIcon icon={Pencil} size={15} />Добавить фотографии</button></div> : Object.entries(groupedPhotos).map(([category, photos]) => <section key={category}><h2>{photoNames[category] ?? category}</h2><div>{photos.map(photo => <Image key={photo.id} src={photo.url} width={480} height={320} unoptimized alt={`${company.name} — ${photoNames[photo.category] ?? "фото"}`} />)}</div></section>)}
    </div>}
    {tab === "Контакты" && <div className="employer-company-profile__contacts">
      <section className="specialist-profile-card"><h2>Контактная информация</h2><p><UiIcon icon={Mail} size={17} />{company.contactEmail || company.ownerEmail}</p>{company.telegram && <p><UiIcon icon={Send} size={17} />{company.telegram}</p>}{company.phone && <p><UiIcon icon={Phone} size={17} />{company.phone}</p>}{company.websiteUrl && <p><UiIcon icon={Globe2} size={17} /><a href={company.websiteUrl} target="_blank" rel="noreferrer">{company.websiteUrl.replace(/^https?:\/\//, "")}</a></p>}</section>
      <section className="specialist-profile-card"><h2>Социальные сети</h2>{company.socialLinks.length === 0 && <p>Добавьте ссылки на страницы компании в редакторе профиля.</p>}{company.socialLinks.map(link => <p key={link.id}><UiIcon icon={link.platform === "TELEGRAM" ? Send : Globe2} size={17} />{socialNames[link.platform] ?? link.platform}<span>{link.value}</span></p>)}</section>
    </div>}
  </section>;
}
