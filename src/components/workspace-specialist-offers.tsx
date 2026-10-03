"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Building2, BriefcaseBusiness, Heart, Wallet } from "lucide-react";
import { api, send } from "./api";
import { UiIcon } from "./ui-icon";
import { EMPLOYMENT, WORK } from "./fields";

type Offer = {
  id: string;
  companyId: string;
  companyNameSnapshot: string;
  companyLogoFileId: string;
  companyIndustry: string;
  positionTitle: string;
  description: string;
  message: string;
  workFormat: string;
  employmentType: string;
  salaryMinRub: number;
  salaryMaxRub: number;
  searchProfileSnapshot?: { skills?: { id: string; name: string }[] };
};
type Favorite = { companyId: string; name: string; description: string; industry: string; workFormat: string; logoFileId: string; websiteUrl: string | null };

const workLabel = (value: string) => WORK.find(([key]) => key === value)?.[1] ?? value;
const employmentLabel = (value: string) => EMPLOYMENT.find(([key]) => key === value)?.[1] ?? value;
const money = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const offerCount = (count: number) => {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14 ? "предложений" : last === 1 ? "предложение" : last >= 2 && last <= 4 ? "предложения" : "предложений";
  return `${count} ${noun}`;
};

export function SpecialistOffersPanel({ onAccepted }: { onAccepted: (matchId: string) => void }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const result = await api<{ items: Offer[] }>("/offers/incoming?page=1&pageSize=50&status=SENT");
    setOffers(result.items);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api<{ items: Favorite[] }>("/favorites"), api<{ items: Offer[] }>("/offers/incoming?page=1&pageSize=50&status=SENT")])
      .then(([favoriteResult, offerResult]) => {
        if (!active) return;
        setFavorites(new Set(favoriteResult.items.map((item) => item.companyId)));
        setOffers(offerResult.items);
      })
      .catch((reason) => { if (active) setError((reason as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function toggleFavorite(offer: Offer) {
    setBusy(offer.id);
    setError("");
    try {
      if (favorites.has(offer.companyId)) {
        await send(`/favorites/${offer.companyId}`, "DELETE");
        setFavorites((current) => { const next = new Set(current); next.delete(offer.companyId); return next; });
      } else {
        await send("/favorites", "POST", { companyId: offer.companyId });
        setFavorites((current) => new Set(current).add(offer.companyId));
      }
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(null); }
  }

  async function respond(offer: Offer, action: "accept" | "reject") {
    setBusy(offer.id);
    setError("");
    try {
      const result = await send<{ match?: { id: string } }>(`/offers/${offer.id}/${action}`, "POST");
      if (action === "accept" && result.match?.id) {
        onAccepted(result.match.id);
        return;
      }
      await refresh();
      setExpanded(null);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(null); }
  }

  return <section className="specialist-content" aria-label="Предложения работодателей">
    <header className="specialist-content__heading">
      <div><h1>Кто заинтересовался вами?</h1><p>Работодатели, которым понравился ваш профиль</p></div>
      <div className="specialist-offer-heading__actions"><Link href="/practice-invitations" className="specialist-practice-link">Приглашения на практику <ArrowRight size={15} /></Link><span className="specialist-content__count">{offerCount(offers.length)}</span></div>
    </header>
    {error && <p className="specialist-dashboard__error" role="alert">{error}</p>}
    {loading && <p className="specialist-dashboard__empty" role="status">Загружаем предложения…</p>}
    {!loading && offers.length === 0 && <div className="specialist-dashboard__empty-card"><span className="specialist-dashboard__empty-icon"><UiIcon icon={BriefcaseBusiness} size={22} /></span><h2>Пока новых предложений нет</h2><p>Когда работодатель заинтересуется вашим профилем, предложение появится здесь.</p></div>}
    <div className="specialist-offers-list">
      {offers.map((offer) => {
        const skills = offer.searchProfileSnapshot?.skills ?? [];
        const isExpanded = expanded === offer.id;
        const isFavorite = favorites.has(offer.companyId);
        return <article className="specialist-offer-card" key={offer.id}>
          <div className="specialist-offer-card__logo">
            {offer.companyLogoFileId
              ? <Image src={`/api/v1/media/${offer.companyLogoFileId}?size=256`} width={128} height={128} unoptimized alt="" />
              : <span aria-hidden="true">{offer.companyNameSnapshot.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="specialist-offer-card__company">
            <div className="specialist-offer-card__identity"><h2>{offer.companyNameSnapshot}</h2>{offer.companyIndustry && <span>{offer.companyIndustry}</span>}</div>
            <h3>{offer.positionTitle}</h3>
            <p className="specialist-offer-card__message">{offer.message}</p>
            {skills.length > 0 && <div className="specialist-offer-card__skills">{skills.slice(0, 5).map((skill) => <span key={skill.id}>{skill.name}</span>)}{skills.length > 5 && <span>+{skills.length - 5}</span>}</div>}
            {isExpanded && <div className="specialist-offer-card__details"><p>{offer.description}</p><p className="muted">Предложение отправлено напрямую работодателем. Условия сохранены на момент отправки.</p></div>}
          </div>
          <div className="specialist-offer-card__conditions">
            {offer.companyIndustry && <span><UiIcon icon={Building2} size={17} />{offer.companyIndustry}</span>}
            <span><UiIcon icon={BriefcaseBusiness} size={17} />{workLabel(offer.workFormat)}</span>
            <span><UiIcon icon={Wallet} size={17} />{money(offer.salaryMinRub)} – {money(offer.salaryMaxRub)} ₽</span>
            <span className="specialist-offer-card__employment">{employmentLabel(offer.employmentType)}</span>
          </div>
          <div className="specialist-offer-card__actions">
            <button type="button" className="specialist-offer-card__accept" disabled={busy === offer.id} onClick={() => void respond(offer, "accept")}>Принять предложение <UiIcon icon={ArrowRight} size={18} /></button>
            <button type="button" className={isFavorite ? "specialist-offer-card__favorite is-active" : "specialist-offer-card__favorite"} aria-pressed={isFavorite} aria-label={isFavorite ? "Убрать работодателя из избранного" : "Добавить работодателя в избранное"} disabled={busy === offer.id} onClick={() => void toggleFavorite(offer)}><UiIcon icon={Heart} size={22} /></button>
            <button type="button" className="specialist-offer-card__details-toggle" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : offer.id)}>{isExpanded ? "Свернуть" : "Подробнее"}</button>
            <button type="button" className="specialist-offer-card__reject" disabled={busy === offer.id} onClick={() => void respond(offer, "reject")}>Отклонить</button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}

export function SpecialistFavoritesPanel() {
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => api<{ items: Favorite[] }>("/favorites").then((result) => setItems(result.items)), []);
  useEffect(() => {
    refresh().catch((reason) => setError((reason as Error).message)).finally(() => setLoading(false));
  }, [refresh]);

  async function remove(companyId: string) {
    try {
      await send(`/favorites/${companyId}`, "DELETE");
      setItems((current) => current.filter((item) => item.companyId !== companyId));
    } catch (reason) { setError((reason as Error).message); }
  }

  return <section className="specialist-content" aria-label="Избранные работодатели">
    <header className="specialist-content__heading"><div><h1>Избранное</h1><p>Работодатели, к предложениям которых вы хотите вернуться</p></div><span className="specialist-content__count">{items.length}</span></header>
    {error && <p className="specialist-dashboard__error" role="alert">{error}</p>}
    {loading && <p className="specialist-dashboard__empty" role="status">Загружаем избранное…</p>}
    {!loading && items.length === 0 && <div className="specialist-dashboard__empty-card"><span className="specialist-dashboard__empty-icon"><UiIcon icon={Heart} size={22} /></span><h2>Здесь пока пусто</h2><p>Нажмите на сердечко у предложения, чтобы сохранить работодателя.</p></div>}
    <div className="specialist-favorites-list">
      {items.map((item) => <article className="specialist-favorite-card" key={item.companyId}>
        <div className="specialist-favorite-card__logo"><Image src={`/api/v1/media/${item.logoFileId}?size=256`} width={112} height={112} unoptimized alt="" /></div>
        <div className="specialist-favorite-card__body"><h2>{item.name}</h2><p>{item.industry}</p><p>{item.description}</p></div>
        <button type="button" className="specialist-offer-card__favorite is-active" aria-label={`Убрать ${item.name} из избранного`} onClick={() => void remove(item.companyId)}><UiIcon icon={Heart} size={22} /></button>
      </article>)}
    </div>
  </section>;
}
