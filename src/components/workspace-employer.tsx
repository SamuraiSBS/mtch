"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Building2, BriefcaseBusiness, Check, Heart, MapPin, MessageCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { api, send } from "./api";
import { UiIcon } from "./ui-icon";
import type { Catalogs } from "./workspace";
import { EMPLOYMENT, EXPERIENCE, LEVEL, WORK } from "./fields";

export type EmployerSection = "search" | "favorites" | "match" | "company";

const navigation: { section: EmployerSection; href: string; label: string; icon: typeof Search }[] = [
  { section: "search", href: "/search", label: "Поиск исполнителей", icon: Search },
  { section: "favorites", href: "/favorites", label: "Избранное", icon: Heart },
  { section: "match", href: "/match", label: "Чаты", icon: MessageCircle },
  { section: "company", href: "/company", label: "Профиль компании", icon: Building2 },
];

export function EmployerSidebar({ active }: { active: EmployerSection }) {
  return <aside className="specialist-sidebar employer-sidebar" aria-label="Меню работодателя">
    <Link className="specialist-sidebar__logo" href="/search" aria-label="mtch — поиск исполнителей"><Image src="/logo-header.png" width={1462} height={462} priority alt="mtch." /></Link>
    <nav className="specialist-sidebar__main" aria-label="Разделы работодателя">
      {navigation.slice(0, 3).map(({ section, href, label, icon }) => <Link key={section} className={active === section ? "specialist-sidebar__link is-active" : "specialist-sidebar__link"} href={href} aria-label={label} title={label} aria-current={active === section ? "page" : undefined}>
        <UiIcon icon={icon} size={24} /><span className="sr-only">{label}</span>
      </Link>)}
    </nav>
    <div className="specialist-sidebar__bottom"><Link className={active === "company" ? "specialist-sidebar__link is-active" : "specialist-sidebar__link"} href="/company" aria-label="Профиль компании" title="Профиль компании" aria-current={active === "company" ? "page" : undefined}><UiIcon icon={navigation[3].icon} size={24} /><span className="sr-only">Профиль компании</span></Link></div>
  </aside>;
}

type Candidate = {
  userId: string;
  firstName: string;
  lastName: string;
  age: number | null;
  city: string | null;
  cityId?: string | null;
  profession: string;
  professionId?: string;
  level: string | null;
  experience: string | null;
  skills: { id: string; name: string }[];
  about: string | null;
  salaryMinRub: number | null;
  salaryMaxRub: number | null;
  workFormat: string | null;
  employmentType: string | null;
  employmentGoal: string;
  searchStatus: string;
  educationalInstitution?: string | null;
  educationProgram?: string | null;
  studyCourse?: number | null;
  practiceStartDate?: string | null;
  practiceEndDate?: string | null;
  desiredDirections?: string[] | null;
  practiceWorkFormats?: string[] | null;
  practiceInvitationStatus?: string | null;
  avatarFileId: string;
  avatarUrl: string;
  matchPercent?: number;
  isFavorite: boolean;
  interestStatus: "SENT" | "ACCEPTED" | null;
  interestOfferId: string | null;
};

type Filters = {
  professionId: string;
  level: string;
  minimumExperience: string;
  skillIds: string[];
  salaryMinRub: string;
  salaryMaxRub: string;
  ageMin: string;
  ageMax: string;
  workFormat: string;
  employmentType: string;
  cityId: string;
  employmentGoal: string;
};

const emptyFilters: Filters = {
  professionId: "", level: "", minimumExperience: "", skillIds: [], salaryMinRub: "", salaryMaxRub: "",
  ageMin: "", ageMax: "", workFormat: "", employmentType: "", cityId: "", employmentGoal: "",
};
const money = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const choice = (value: string | null, options: readonly (readonly string[])[]) => options.find(([key]) => key === value)?.[1] ?? "";
const experienceLabel = (value: string | null) => choice(value, EXPERIENCE);
const levelLabel = (value: string | null) => choice(value, LEVEL);
const workLabel = (value: string | null) => choice(value, WORK);
const employmentLabel = (value: string | null) => choice(value, EMPLOYMENT);
const practiceStatusLabel = (value: string | null | undefined) => ({ SENT: "Приглашение отправлено", VIEWED: "Приглашение просмотрено", ACCEPTED: "Приглашение принято", DECLINED: "Приглашение отклонено", INTERVIEW: "Назначено собеседование", HIRED: "Оформлен" }[value ?? ""] ?? "");
const practiceDateLabel = (value: string | null | undefined) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "Не указано";

function salaryLabel(candidate: Candidate) {
  if (!candidate.salaryMinRub || !candidate.salaryMaxRub) return "Зарплата не указана";
  return `${money(candidate.salaryMinRub)} — ${money(candidate.salaryMaxRub)} ₽`;
}

function CandidateInterestAction({ candidate, onInterest, onCancel, onPracticeInvite }: {
  candidate: Candidate;
  onInterest: () => void;
  onCancel: () => void;
  onPracticeInvite: () => void;
}) {
  if (candidate.employmentGoal === "PRACTICE") {
    if (candidate.practiceInvitationStatus) {
      return <span className="employer-candidate-card__practice">
        <button type="button" className="employer-candidate-card__interest is-practice is-practice-sent" disabled>{practiceStatusLabel(candidate.practiceInvitationStatus)}</button>
        <small className="employer-candidate-card__practice-note">Статус приглашения на производственную практику</small>
      </span>;
    }
    return <span className="employer-candidate-card__practice">
      <button type="button" className="employer-candidate-card__interest is-practice" onClick={onPracticeInvite}>Пригласить на практику <ArrowRight size={17} /></button>
      <small className="employer-candidate-card__practice-note">Учебная практика по выбранному набору</small>
    </span>;
  }
  if (candidate.interestStatus === "SENT") {
    return <button type="button" className="employer-candidate-card__interest is-sent" onClick={onCancel} aria-label="Отменить отправленную заявку">
      <Check size={17} />Заявка отправлена
    </button>;
  }
  if (candidate.interestStatus === "ACCEPTED") {
    return <Link className="employer-candidate-card__interest" href="/match">Открыть чат <ArrowRight size={17} /></Link>;
  }
  return <button type="button" className="employer-candidate-card__interest" onClick={onInterest}>Заинтересовал <ArrowRight size={17} /></button>;
}

function CancelInterestDialog({ candidate, busy, error, onClose, onConfirm }: {
  candidate: Candidate;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  return <div className="employer-confirm-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="employer-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cancel-interest-title" aria-describedby="cancel-interest-copy">
      <span className="employer-confirm-dialog__icon"><UiIcon icon={X} size={20} /></span>
      <h2 id="cancel-interest-title">Отменить заявку?</h2>
      <p id="cancel-interest-copy">Заявка для {candidate.firstName} {candidate.lastName} будет отозвана. Отправить её повторно можно будет позже.</p>
      {error && <p className="employer-confirm-dialog__error" role="alert">{error}</p>}
      <div className="employer-confirm-dialog__actions">
        <button type="button" className="specialist-secondary-button" disabled={busy} onClick={onClose}>Нет, оставить</button>
        <button type="button" disabled={busy} onClick={onConfirm}>{busy ? "Отменяем…" : "Да, отменить"}</button>
      </div>
    </section>
  </div>;
}

function CandidateCard({ candidate, layout, onFavorite, onInterest, onCancelInterest, onPracticeInvite, onOpen }: {
  candidate: Candidate;
  layout: "horizontal" | "vertical";
  onFavorite: (candidate: Candidate) => void;
  onInterest: (candidate: Candidate) => void;
  onCancelInterest: (candidate: Candidate) => void;
  onPracticeInvite: (candidate: Candidate) => void;
  onOpen: (candidate: Candidate) => void;
}) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`;
  return <article className={`employer-candidate-card employer-candidate-card--${layout}`}>
    <button className="employer-candidate-card__person" type="button" onClick={() => onOpen(candidate)} aria-label={`Открыть профиль ${fullName}`}>
      <span className="employer-candidate-card__photo"><span aria-hidden="true">{candidate.firstName.slice(0, 1)}{candidate.lastName.slice(0, 1)}</span><Image src={candidate.avatarUrl} width={240} height={240} unoptimized alt={`Фото ${fullName}`} /></span>
      <span className="employer-candidate-card__identity"><strong>{fullName}</strong><span>{candidate.profession}{candidate.level ? ` · ${levelLabel(candidate.level)}` : ""}</span><small>{experienceLabel(candidate.experience) || "Опыт не указан"}</small></span>
    </button>
    <div className="employer-candidate-card__summary">
      <p>{candidate.about || `${candidate.profession}. Открыт к предложениям и обсуждению интересных задач.`}</p>
      <div className="employer-candidate-card__skills">{candidate.skills.slice(0, 5).map(skill => <span key={skill.id}>{skill.name}</span>)}{candidate.skills.length > 5 && <span>+{candidate.skills.length - 5}</span>}</div>
    </div>
    <div className="employer-candidate-card__facts">
      <span><UiIcon icon={MapPin} size={16} />{candidate.city || "Город не указан"}</span>
      <span><UiIcon icon={BriefcaseBusiness} size={16} />{workLabel(candidate.workFormat) || "Формат не указан"}{candidate.employmentType ? ` · ${employmentLabel(candidate.employmentType)}` : ""}</span>
      <strong>{salaryLabel(candidate)}</strong>
      {candidate.age && <small>{candidate.age} лет</small>}
    </div>
    <div className="employer-candidate-card__actions">
      <button type="button" className={candidate.isFavorite ? "employer-candidate-card__favorite is-active" : "employer-candidate-card__favorite"} aria-label={candidate.isFavorite ? "Убрать из избранного" : "Добавить в избранное"} aria-pressed={candidate.isFavorite} onClick={() => onFavorite(candidate)}><UiIcon icon={Heart} size={20} /></button>
      <CandidateInterestAction candidate={candidate} onInterest={() => onInterest(candidate)} onCancel={() => onCancelInterest(candidate)} onPracticeInvite={() => onPracticeInvite(candidate)} />
    </div>
  </article>;
}

type PracticeRecruitment = {
  id: string;
  title: string;
  practiceStartDate: string;
  practiceEndDate: string;
  workFormats: string[];
  status: string;
  remaining: number;
};

function PracticeInviteDialog({ candidate, onClose, onSent }: {
  candidate: Candidate;
  onClose: () => void;
  onSent: (candidate: Candidate) => void;
}) {
  const [step, setStep] = useState<"confirm" | "form" | "empty">("confirm");
  const [emptyReason, setEmptyReason] = useState<"no-active" | "no-match" | "already-invited">("no-active");
  const [options, setOptions] = useState<PracticeRecruitment[]>([]);
  const [recruitmentId, setRecruitmentId] = useState("");
  const [message, setMessage] = useState(`Здравствуйте, ${candidate.firstName}! Предлагаем пройти производственную практику в нашей компании. Будем рады обсудить задачи и условия.`);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape" && !loading && !sending) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, sending, onClose]);

  async function prepareInvite() {
    setLoading(true);
    setError("");
    try {
      const [recruitments, invitations] = await Promise.all([
        api<{ items: PracticeRecruitment[] }>("/practice-recruitments?pageSize=100"),
        api<{ items: { candidateUserId: string; status: string }[] }>("/practice-invitations?pageSize=100"),
      ]);
      const active = recruitments.items.filter(item => item.status === "ACTIVE" && item.remaining > 0);
      if (active.length === 0) {
        setEmptyReason("no-active");
        setStep("empty");
        return;
      }
      const activeStatuses = ["SENT", "VIEWED", "ACCEPTED", "INTERVIEW", "HIRED"];
      if (invitations.items.some(item => item.candidateUserId === candidate.userId && activeStatuses.includes(item.status))) {
        setEmptyReason("already-invited");
        setStep("empty");
        return;
      }
      const compatible = await Promise.all(active.map(async recruitment => {
        const result = await api<{ items: { candidate: { userId: string } }[] }>(`/practice-recruitments/${recruitment.id}/matches?pageSize=100`);
        return result.items.some(item => item.candidate.userId === candidate.userId) ? recruitment : null;
      }));
      const eligible = compatible.filter((item): item is PracticeRecruitment => item !== null);
      if (eligible.length === 0) {
        setEmptyReason("no-match");
        setStep("empty");
        return;
      }
      setOptions(eligible);
      setRecruitmentId(eligible[0].id);
      setStep("form");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recruitmentId || !message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await send(`/practice-recruitments/${recruitmentId}/invitations`, "POST", { candidateUserId: candidate.userId, message: message.trim() });
      onSent(candidate);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSending(false);
    }
  }

  const emptyCopy = emptyReason === "no-active"
    ? "У компании пока нет активного набора на практику. Сначала создайте набор с датами, направлением и условиями."
    : emptyReason === "no-match"
      ? "Сейчас нет активного набора, который подходит этому исполнителю по направлению, датам и формату. Создайте подходящий набор."
      : "Вы уже отправили этому исполнителю приглашение на практику. Оно появится в списке приглашений.";

  return <div className="employer-confirm-overlay employer-practice-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !loading && !sending) onClose(); }}>
    <section className="employer-confirm-dialog employer-practice-dialog" role={step === "confirm" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="practice-invite-title">
      <span className="employer-confirm-dialog__icon"><UiIcon icon={BriefcaseBusiness} size={20} /></span>
      <h2 id="practice-invite-title">{step === "confirm" ? "Пригласить на практику?" : step === "form" ? `Приглашение для ${candidate.firstName}` : "Пока не получается отправить приглашение"}</h2>
      {step === "confirm" && <>
        <p>{candidate.firstName} {candidate.lastName} ищет производственную практику. Продолжить и выбрать подходящий набор компании?</p>
        {error && <p className="employer-confirm-dialog__error" role="alert">{error}</p>}
        <div className="employer-confirm-dialog__actions">
          <button type="button" className="specialist-secondary-button" disabled={loading} onClick={onClose}>Нет, позже</button>
          <button type="button" disabled={loading} onClick={() => void prepareInvite()}>{loading ? "Ищем подходящие наборы…" : "Да, продолжить"}</button>
        </div>
      </>}
      {step === "form" && <>
        <p>Выберите набор практики и проверьте сообщение перед отправкой.</p>
        <form className="employer-practice-dialog__form" onSubmit={sendInvite}>
          <label>Набор на практику<select value={recruitmentId} onChange={event => setRecruitmentId(event.target.value)} required>{options.map(item => <option key={item.id} value={item.id}>{item.title} · {practiceDateLabel(item.practiceStartDate)} — {practiceDateLabel(item.practiceEndDate)}</option>)}</select></label>
          <label>Сообщение исполнителю<textarea value={message} maxLength={3000} rows={4} onChange={event => setMessage(event.target.value)} required /></label>
          {error && <p className="employer-confirm-dialog__error" role="alert">{error}</p>}
          <div className="employer-confirm-dialog__actions">
            <button type="button" className="specialist-secondary-button" disabled={sending} onClick={onClose}>Отмена</button>
          <button type="submit" disabled={sending || !message.trim()}>{sending ? "Отправляем…" : "Отправить приглашение"}</button>
          </div>
        </form>
      </>}
      {step === "empty" && <>
        <p>{emptyCopy}</p>
        <div className="employer-confirm-dialog__actions">
          <button type="button" className="specialist-secondary-button" onClick={onClose}>Закрыть</button>
          {emptyReason !== "already-invited" && <Link className="employer-practice-dialog__manage" href="/practice">Создать набор на практику <ArrowRight size={16} /></Link>}
        </div>
      </>}
    </section>
  </div>;
}

function ProfileModal({ candidate, loading, error, onClose, onFavorite, onInterest, onCancelInterest, onPracticeInvite }: {
  candidate: (Candidate & Record<string, unknown>) | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onFavorite: () => void;
  onInterest: () => void;
  onCancelInterest: () => void;
  onPracticeInvite: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const name = candidate ? `${candidate.firstName} ${candidate.lastName}` : "Профиль исполнителя";
  const portfolioUrl = typeof candidate?.portfolioUrl === "string" ? candidate.portfolioUrl : "";
  const githubUrl = typeof candidate?.githubUrl === "string" ? candidate.githubUrl : "";
  const behanceGitlabUrl = typeof candidate?.behanceGitlabUrl === "string" ? candidate.behanceGitlabUrl : "";
  const telegram = typeof candidate?.telegram === "string" ? candidate.telegram : "";
  const hasResume = candidate?.resume === "ATTACHED";
  return <div className="employer-profile-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="employer-profile-modal" role="dialog" aria-modal="true" aria-label={name}>
      <button type="button" className="employer-profile-modal__close" onClick={onClose} aria-label="Закрыть профиль"><UiIcon icon={X} size={20} /></button>
      {loading && <p className="employer-profile-modal__state" role="status">Загружаем профиль…</p>}
      {error && <p className="specialist-dashboard__error" role="alert">{error}</p>}
      {candidate && !loading && <>
        <header className="employer-profile-modal__hero">
          <div className="employer-profile-modal__portrait"><span aria-hidden="true">{String(candidate.firstName).slice(0, 1)}{String(candidate.lastName).slice(0, 1)}</span><Image className="employer-profile-modal__photo" src={String(candidate.avatarUrl)} width={280} height={280} unoptimized alt={`Фото ${name}`} /></div>
          <div className="employer-profile-modal__intro">
            <span className="employer-profile-modal__eyebrow">ПРОФИЛЬ ИСПОЛНИТЕЛЯ</span>
            <h2>{name}</h2>
            <p>{candidate.profession}{candidate.level ? ` · ${levelLabel(candidate.level)}` : ""}</p>
            <div className="employer-profile-modal__quick-facts"><span><UiIcon icon={MapPin} size={16} />{candidate.city || "Город не указан"}</span><span><UiIcon icon={BriefcaseBusiness} size={16} />{experienceLabel(candidate.experience) || "Опыт не указан"}</span><strong>{salaryLabel(candidate)}</strong></div>
            <div className="employer-candidate-card__skills">{candidate.skills.map(skill => <span key={skill.id}>{skill.name}</span>)}</div>
            <div className="employer-profile-modal__actions">
              <button type="button" className={candidate.isFavorite ? "employer-candidate-card__favorite is-active" : "employer-candidate-card__favorite"} onClick={onFavorite} aria-pressed={candidate.isFavorite} aria-label={candidate.isFavorite ? "Убрать из избранного" : "Добавить в избранное"}><UiIcon icon={Heart} size={20} /></button>
              <CandidateInterestAction candidate={candidate} onInterest={onInterest} onCancel={onCancelInterest} onPracticeInvite={onPracticeInvite} />
            </div>
          </div>
        </header>
        <div className="employer-profile-modal__details">
          <section className="specialist-profile-card"><h3>О себе</h3><p>{candidate.about || "Описание пока не добавлено."}</p><dl className="specialist-profile-facts">
            <div><dt>Возраст</dt><dd>{candidate.age ? `${candidate.age} лет` : "Не указан"}</dd></div>
            <div><dt>Специализация</dt><dd>{candidate.profession}</dd></div>
            <div><dt>Уровень</dt><dd>{levelLabel(candidate.level) || "Не указан"}</dd></div>
            <div><dt>Опыт работы</dt><dd>{experienceLabel(candidate.experience) || "Не указан"}</dd></div>
            <div><dt>Желаемая зарплата</dt><dd>{salaryLabel(candidate)}</dd></div>
            <div><dt>Формат работы</dt><dd>{workLabel(candidate.workFormat) || "Не указан"}</dd></div>
            <div><dt>Занятость</dt><dd>{employmentLabel(candidate.employmentType) || "Не указана"}</dd></div>
            <div><dt>Статус</dt><dd>{candidate.searchStatus === "ACTIVE" ? "Активно ищет" : candidate.searchStatus === "OPEN_TO_OFFERS" ? "Открыт к предложениям" : "Не ищет"}</dd></div>
          </dl></section>
          {(candidate.educationalInstitution || candidate.educationProgram || candidate.studyCourse || candidate.employmentGoal === "PRACTICE") && <section className="specialist-profile-card employer-profile-modal__education"><h3>{candidate.employmentGoal === "PRACTICE" ? "Образование и практика" : "Образование"}</h3><dl className="specialist-profile-facts">
            {candidate.educationalInstitution && <div><dt>Учебное заведение</dt><dd>{candidate.educationalInstitution}</dd></div>}
            {candidate.educationProgram && <div><dt>Программа</dt><dd>{candidate.educationProgram}</dd></div>}
            {candidate.studyCourse && <div><dt>Курс</dt><dd>{candidate.studyCourse}</dd></div>}
            {candidate.employmentGoal === "PRACTICE" && candidate.desiredDirections?.length && <div><dt>Направление практики</dt><dd>{candidate.desiredDirections.join(", ")}</dd></div>}
            {candidate.employmentGoal === "PRACTICE" && candidate.practiceStartDate && <div><dt>Период</dt><dd>{practiceDateLabel(candidate.practiceStartDate)} — {practiceDateLabel(candidate.practiceEndDate)}</dd></div>}
            {candidate.employmentGoal === "PRACTICE" && candidate.practiceWorkFormats?.length && <div><dt>Формат практики</dt><dd>{candidate.practiceWorkFormats.map(format => workLabel(format) || format).join(", ")}</dd></div>}
          </dl></section>}
          <aside className="employer-profile-modal__side">
            <section className="specialist-profile-card"><h3>Ссылки и контакты</h3>
              {portfolioUrl && <a href={portfolioUrl} target="_blank" rel="noreferrer">Портфолио <span>{portfolioUrl.replace(/^https?:\/\//, "")}</span></a>}
              {githubUrl && <a href={githubUrl} target="_blank" rel="noreferrer">GitHub <span>{githubUrl.replace(/^https?:\/\//, "")}</span></a>}
              {behanceGitlabUrl && <a href={behanceGitlabUrl} target="_blank" rel="noreferrer">Behance / GitLab <span>{behanceGitlabUrl.replace(/^https?:\/\//, "")}</span></a>}
              {telegram && <a href={`https://t.me/${telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Telegram <span>{telegram}</span></a>}
              {hasResume && <p>Резюме PDF прикреплено к профилю</p>}
              {!portfolioUrl && !githubUrl && !behanceGitlabUrl && !telegram && !hasResume && <p>Исполнитель пока не добавил ссылки и резюме.</p>}
            </section>
          </aside>
        </div>
      </>}
    </section>
  </div>;
}

function SearchResults({ catalogs, favoritesOnly = false }: { catalogs: Catalogs; favoritesOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [layout, setLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [items, setItems] = useState<Candidate[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState<(Candidate & Record<string, unknown>) | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState("");
  const [cancelCandidate, setCancelCandidate] = useState<Candidate | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [practiceCandidate, setPracticeCandidate] = useState<Candidate | null>(null);

  async function load(nextPage = 1, nextQuery = query, nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      for (const key of ["professionId", "level", "minimumExperience", "salaryMinRub", "salaryMaxRub", "ageMin", "ageMax", "workFormat", "employmentType", "cityId", "employmentGoal"] as const) {
        if (nextFilters[key]) params.set(key, nextFilters[key]);
      }
      for (const skillId of nextFilters.skillIds) params.append("skillId", skillId);
      const path = favoritesOnly ? "/favorites" : `/feed/specialists?${params}`;
      const result = await api<{ items: Candidate[]; page?: number; pageSize?: number; total?: number }>(path);
      setItems(result.items);
      setPage(favoritesOnly ? 1 : result.page ?? 1);
      setTotal(favoritesOnly ? result.items.length : result.total ?? result.items.length);
      setPageSize(favoritesOnly ? Math.max(1, result.items.length) : result.pageSize ?? 12);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(1, "", emptyFilters); }, []);

  function updateItem(userId: string, patch: Partial<Candidate>) {
    setItems(current => current.map(item => item.userId === userId ? { ...item, ...patch } : item));
    setSelected(current => current?.userId === userId ? { ...current, ...patch } : current);
  }

  async function toggleFavorite(candidate: Candidate) {
    try {
      if (candidate.isFavorite) await send(`/favorites/${candidate.userId}`, "DELETE");
      else await send("/favorites", "POST", { specialistUserId: candidate.userId });
      if (favoritesOnly && candidate.isFavorite) setItems(current => current.filter(item => item.userId !== candidate.userId));
      else updateItem(candidate.userId, { isFavorite: !candidate.isFavorite });
    } catch (reason) { setError((reason as Error).message); }
  }

  async function sendInterest(candidate: Candidate) {
    try {
      const result = await send<{ offerId: string }>("/interests", "POST", { specialistUserId: candidate.userId });
      updateItem(candidate.userId, { interestStatus: "SENT", interestOfferId: result.offerId });
      setToast(`Заявка для ${candidate.firstName} ${candidate.lastName} отправлена`);
      window.setTimeout(() => setToast(""), 3600);
    } catch (reason) { setError((reason as Error).message); }
  }

  async function cancelInterest() {
    if (!cancelCandidate?.interestOfferId) {
      setCancelError("Не удалось найти отправленную заявку. Обновите страницу и попробуйте ещё раз.");
      return;
    }
    setCanceling(true);
    setCancelError("");
    try {
      await send(`/offers/${cancelCandidate.interestOfferId}/withdraw`, "POST");
      updateItem(cancelCandidate.userId, { interestStatus: null, interestOfferId: null });
      setToast(`Заявка для ${cancelCandidate.firstName} ${cancelCandidate.lastName} отменена`);
      window.setTimeout(() => setToast(""), 3600);
      setCancelCandidate(null);
    } catch (reason) { setCancelError((reason as Error).message); }
    finally { setCanceling(false); }
  }

  function practiceInviteSent(candidate: Candidate) {
    updateItem(candidate.userId, { practiceInvitationStatus: "SENT" });
    setPracticeCandidate(null);
    setToast(`Приглашение на практику для ${candidate.firstName} ${candidate.lastName} отправлено`);
    window.setTimeout(() => setToast(""), 4200);
  }

  async function openProfile(candidate: Candidate) {
    setSelected({ ...candidate });
    setSelectedLoading(true);
    setSelectedError("");
    try {
      const detail = await api<Record<string, unknown>>(`/specialists/${candidate.userId}`);
      setSelected(current => current?.userId === candidate.userId ? { ...current, ...detail } as Candidate & Record<string, unknown> : current);
    } catch (reason) { setSelectedError((reason as Error).message); }
    finally { setSelectedLoading(false); }
  }

  return <section className="specialist-content employer-search" aria-label={favoritesOnly ? "Избранные исполнители" : "Поиск исполнителей"}>
    <header className="specialist-content__heading"><div><h1>{favoritesOnly ? "Избранные исполнители" : "Кого вы ищете?"}</h1><p>{favoritesOnly ? "Профили, которые вы сохранили" : "Найдите специалиста по навыкам, опыту и условиям работы"}</p></div>{!favoritesOnly && <div className="employer-search-heading__actions"><Link href="/practice" className="employer-practice-entry">Наборы на практику <ArrowRight size={16} /></Link><span className="specialist-content__count">{total} {total === 1 ? "кандидат" : "кандидатов"}</span></div>}</header>
    {!favoritesOnly && <form className="employer-searchbar" onSubmit={event => { event.preventDefault(); void load(1); }}>
      <UiIcon icon={Search} size={22} />
      <input aria-label="Поиск исполнителя" value={query} onChange={event => setQuery(event.target.value)} placeholder="Например: Backend-разработчик, React, Москва" />
      <button type="button" className={filterOpen ? "employer-searchbar__filter is-active" : "employer-searchbar__filter"} aria-label="Открыть фильтры" aria-expanded={filterOpen} onClick={() => setFilterOpen(open => !open)}><UiIcon icon={SlidersHorizontal} size={18} /></button>
      <button type="submit" className="employer-searchbar__submit" aria-label="Найти исполнителей"><ArrowRight size={23} /></button>
    </form>}
    {!favoritesOnly && filterOpen && <section className="employer-filter-panel" aria-label="Фильтры поиска">
      <div className="employer-filter-panel__heading"><div><h2>Фильтры</h2><p>Сочетайте параметры для точного поиска</p></div><button type="button" className="employer-searchbar__filter" aria-label="Закрыть фильтры" onClick={() => setFilterOpen(false)}><UiIcon icon={X} size={18} /></button></div>
      <div className="employer-filter-grid">
        <label>Специализация<select value={filters.professionId} onChange={event => setFilters({ ...filters, professionId: event.target.value })}><option value="">Любая специализация</option>{catalogs.professions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Уровень<select value={filters.level} onChange={event => setFilters({ ...filters, level: event.target.value })}><option value="">Любой</option>{LEVEL.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Опыт<select value={filters.minimumExperience} onChange={event => setFilters({ ...filters, minimumExperience: event.target.value })}><option value="">Любой</option>{EXPERIENCE.map(([value, label]) => <option key={value} value={value}>От: {label}</option>)}</select></label>
        <label>Город<select value={filters.cityId} onChange={event => setFilters({ ...filters, cityId: event.target.value })}><option value="">Любой город</option>{catalogs.cities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Формат работы<select value={filters.workFormat} onChange={event => setFilters({ ...filters, workFormat: event.target.value })}><option value="">Любой формат</option>{WORK.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Занятость<select value={filters.employmentType} onChange={event => setFilters({ ...filters, employmentType: event.target.value })}><option value="">Любая</option>{EMPLOYMENT.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Возраст от<input type="number" min={1} max={120} value={filters.ageMin} onChange={event => setFilters({ ...filters, ageMin: event.target.value })} placeholder="18" /></label>
        <label>Возраст до<input type="number" min={1} max={120} value={filters.ageMax} onChange={event => setFilters({ ...filters, ageMax: event.target.value })} placeholder="50" /></label>
        <label>Зарплата от, ₽<input type="number" min={1} value={filters.salaryMinRub} onChange={event => setFilters({ ...filters, salaryMinRub: event.target.value })} placeholder="100 000" /></label>
        <label>Зарплата до, ₽<input type="number" min={1} value={filters.salaryMaxRub} onChange={event => setFilters({ ...filters, salaryMaxRub: event.target.value })} placeholder="300 000" /></label>
        <label>Цель поиска<select value={filters.employmentGoal} onChange={event => setFilters({ ...filters, employmentGoal: event.target.value })}><option value="">Работа и практика</option><option value="JOB">Работа</option><option value="INTERNSHIP">Стажировка</option><option value="PRACTICE">Практика</option><option value="OPEN_TO_OFFERS">Открыт к предложениям</option></select></label>
      </div>
      <fieldset className="employer-filter-skills"><legend>Навыки</legend><div>{catalogs.skills.map(skill => <label key={skill.id}><input type="checkbox" checked={filters.skillIds.includes(skill.id)} onChange={event => setFilters(current => ({ ...current, skillIds: event.target.checked ? [...current.skillIds, skill.id] : current.skillIds.filter(id => id !== skill.id) }))} />{skill.name}</label>)}</div></fieldset>
      <div className="employer-filter-panel__actions"><button type="button" className="specialist-secondary-button" onClick={() => setFilters(emptyFilters)}>Сбросить</button><button type="button" onClick={() => { setFilterOpen(false); void load(1); }}>Показать исполнителей <ArrowRight size={17} /></button></div>
    </section>}
    {toast && <div className="employer-toast" role="status"><span><Check size={16} /></span>{toast}</div>}
    {error && <p className="specialist-dashboard__error" role="alert">{error}</p>}
    <div className="employer-results-toolbar"><strong>Найдено {total} {total === 1 ? "исполнитель" : "исполнителей"}</strong>{!favoritesOnly && <div><span>Вид:</span><button type="button" className={layout === "vertical" ? "is-active" : ""} onClick={() => setLayout("vertical")} aria-pressed={layout === "vertical"}>Вертикально</button><button type="button" className={layout === "horizontal" ? "is-active" : ""} onClick={() => setLayout("horizontal")} aria-pressed={layout === "horizontal"}>Горизонтально</button></div>}</div>
    {loading ? <p className="specialist-dashboard__empty">Ищем подходящих исполнителей…</p> : items.length === 0 ? <div className="specialist-dashboard__empty-card"><span className="specialist-dashboard__empty-icon"><UiIcon icon={favoritesOnly ? Heart : Search} size={24} /></span><h2>{favoritesOnly ? "Здесь пока пусто" : "Подходящих профилей нет"}</h2><p>{favoritesOnly ? "Добавляйте интересных исполнителей в избранное — они останутся здесь." : "Измените запрос или снимите часть фильтров и попробуйте снова."}</p></div> : <div className={`employer-candidate-list employer-candidate-list--${layout}`}>
      {items.map(candidate => <CandidateCard key={candidate.userId} candidate={candidate} layout={layout} onFavorite={item => void toggleFavorite(item)} onInterest={item => void sendInterest(item)} onCancelInterest={item => { setCancelError(""); setCancelCandidate(item); }} onPracticeInvite={item => setPracticeCandidate(item)} onOpen={item => void openProfile(item)} />)}
    </div>}
    {!favoritesOnly && total > pageSize && <div className="employer-pagination"><button type="button" className="specialist-secondary-button" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>Назад</button><span>Страница {page}</span><button type="button" className="specialist-secondary-button" disabled={page * pageSize >= total || loading} onClick={() => void load(page + 1)}>Далее</button></div>}
    {selected && <ProfileModal candidate={selected} loading={selectedLoading} error={selectedError} onClose={() => setSelected(null)} onFavorite={() => void toggleFavorite(selected)} onInterest={() => void sendInterest(selected)} onCancelInterest={() => { setCancelError(""); setCancelCandidate(selected); }} onPracticeInvite={() => setPracticeCandidate(selected)} />}
    {cancelCandidate && <CancelInterestDialog candidate={cancelCandidate} busy={canceling} error={cancelError} onClose={() => setCancelCandidate(null)} onConfirm={() => void cancelInterest()} />}
    {practiceCandidate && <PracticeInviteDialog candidate={practiceCandidate} onClose={() => setPracticeCandidate(null)} onSent={practiceInviteSent} />}
  </section>;
}

export function EmployerSearchPanel({ catalogs }: { catalogs: Catalogs }) { return <SearchResults catalogs={catalogs} />; }
export function EmployerFavoritesPanel({ catalogs }: { catalogs: Catalogs }) { return <SearchResults catalogs={catalogs} favoritesOnly />; }
