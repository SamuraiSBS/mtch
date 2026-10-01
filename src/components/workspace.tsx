"use client";
import { useEffect, useState } from "react";
import { api, send } from "./api";
import { SpecialistPanel } from "./workspace-specialist";
import { CompanyPanel } from "./workspace-company";
import { SearchPanel, FeedPanel } from "./workspace-search";
import { OffersPanel, MatchesPanel } from "./workspace-offers";
export type Item = { id: string; name: string };
export type Catalogs = { professions: Item[]; cities: Item[]; skills: Item[] };
export function Workspace() {
  const [me, setMe] = useState<any>(null), [catalogs, setCatalogs] = useState<Catalogs>({ professions: [], cities: [], skills: [] }), [tab, setTab] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const current = await api<any>("/auth/me"); setMe(current); setTab(current.role === "SPECIALIST" ? "profile" : "company"); const [professions,cities,skills] = await Promise.all([api<Item[]>("/catalogs/professions"),api<Item[]>("/catalogs/cities"),api<Item[]>("/catalogs/skills")]); setCatalogs({professions,cities,skills}); } catch (err) { setError((err as Error).message); } finally { setLoading(false); } })(); }, []);
  if (loading) return <p>Загрузка…</p>;
  if (!me) return <div className="card"><p>{error || "Нужен вход"}</p><a className="button" href="/login">Войти</a></div>;
  const tabs = me.role === "SPECIALIST" ? [["profile","Мой профиль"],["incoming","Предложения"],["matches","Match"]] : [["company","Компания"],["search","Профили поиска"],["feed","Лента"],["outgoing","Предложения"],["matches","Match"]];
  return <><div className="workspace-heading"><div><h1>Кабинет {me.role === "SPECIALIST" ? "специалиста" : "работодателя"}</h1><p>{me.email}</p></div><button className="secondary" onClick={async()=>{ await send("/auth/logout","POST"); window.location.href="/"; }}>Выйти</button></div><div className="tabs">{tabs.map(([key,label])=><button key={key} className={tab===key?"":"secondary"} onClick={()=>setTab(key)}>{label}</button>)}</div>{tab==="profile" && <SpecialistPanel catalogs={catalogs}/ >}{tab==="company" && <CompanyPanel/>}{tab==="search" && <SearchPanel catalogs={catalogs}/ >}{tab==="feed" && <FeedPanel catalogs={catalogs}/ >}{(tab==="incoming"||tab==="outgoing") && <OffersPanel side={tab as "incoming"|"outgoing"}/ >}{tab==="matches" && <MatchesPanel/>}</>;
}
