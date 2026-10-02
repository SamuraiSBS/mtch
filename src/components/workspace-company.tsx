"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Building2, Check, ImagePlus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError, api, send } from "./api";
import { UiIcon } from "./ui-icon";

type WorkFormat = "REMOTE" | "HYBRID" | "OFFICE";
type SocialPlatform = "TELEGRAM" | "VK" | "LINKEDIN" | "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "X" | "OTHER";
type PhotoCategory = "OFFICE" | "TEAM" | "WORKSPACE" | "PROCESSES" | "OTHER";
type SocialDraft = { key: string; platform: SocialPlatform | ""; value: string };
type CompanyPhotoDraft = { fileId: string; category: PhotoCategory; sortOrder: number };
type CompanyDraft = {
  name: string;
  description: string;
  workFormat: WorkFormat | "";
  foundedYear: string;
  sizeBand: string;
  industry: string;
  industryOther: string;
  websiteUrl: string;
  logoFileId: string;
  contactEmail: string;
  telegram: string;
  phone: string;
  socialLinks: SocialDraft[];
  photos: CompanyPhotoDraft[];
};
type WizardErrors = Record<string, string>;
type Props = { userId: string; email: string; onSaved: () => void; onLogout: () => void };

const STEP_TITLES = ["Основное", "Информация о компании", "Контакты и соцсети", "Фотографии"];
const SOCIAL_PLATFORMS: [SocialPlatform, string][] = [
  ["TELEGRAM", "Telegram"], ["VK", "VK"], ["LINKEDIN", "LinkedIn"], ["YOUTUBE", "YouTube"],
  ["INSTAGRAM", "Instagram"], ["TIKTOK", "TikTok"], ["X", "X"], ["OTHER", "Другая"],
];
const PHOTO_CATEGORIES: [PhotoCategory, string][] = [
  ["OFFICE", "Офис"], ["TEAM", "Команда"], ["WORKSPACE", "Рабочие места"], ["PROCESSES", "Рабочие процессы"], ["OTHER", "Другое"],
];
const INDUSTRIES = [
  "Разработка ПО", "Веб-разработка", "Мобильная разработка", "Игры", "AI/ML и данные", "Кибербезопасность",
  "Облака и инфраструктура", "Системная интеграция", "IT-консалтинг", "Телеком",
];
const OTHER_INDUSTRY = "__OTHER__";
const WORK_FORMATS: [WorkFormat, string][] = [["REMOTE", "Удалённо"], ["HYBRID", "Гибрид"], ["OFFICE", "Офис"]];
const SIZE_BANDS: [string, string][] = [["1-10", "1–10"], ["11-50", "11–50"], ["51-200", "51–200"], ["201-1000", "201–1000"], ["1000+", "1000+"]];
const EMPTY_DRAFT: CompanyDraft = {
  name: "", description: "", workFormat: "", foundedYear: "", sizeBand: "", industry: "", industryOther: "",
  websiteUrl: "", logoFileId: "", contactEmail: "", telegram: "", phone: "", socialLinks: [], photos: [],
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function asString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && SOCIAL_PLATFORMS.some(([platform]) => platform === value);
}

function isPhotoCategory(value: unknown): value is PhotoCategory {
  return typeof value === "string" && PHOTO_CATEGORIES.some(([category]) => category === value);
}

function draftKey(userId: string) {
  return `mtch:company-wizard:draft:v1:${encodeURIComponent(userId)}`;
}

function newRowKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeForm(source: Record<string, unknown>): CompanyDraft {
  const rawIndustry = asString(source.industry);
  const isKnownIndustry = INDUSTRIES.includes(rawIndustry);
  const isOtherSentinel = rawIndustry === OTHER_INDUSTRY;
  const photos = Array.isArray(source.photos) ? source.photos.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const photo = item as Record<string, unknown>;
    const fileId = asString(photo.fileId);
    if (!fileId) return [];
    return [{ fileId, category: isPhotoCategory(photo.category) ? photo.category : "OTHER" as const, sortOrder: Number.isInteger(photo.sortOrder) ? Number(photo.sortOrder) : index }];
  }).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 20) : [];
  const socialLinks = Array.isArray(source.socialLinks) ? source.socialLinks.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const link = item as Record<string, unknown>;
    return [{ key: asString(link.key) || newRowKey(), platform: isSocialPlatform(link.platform) ? link.platform : "" as const, value: asString(link.value) }];
  }) : [];
  const rawWorkFormat = asString(source.workFormat);
  return {
    ...EMPTY_DRAFT,
    name: asString(source.name),
    description: asString(source.description),
    workFormat: WORK_FORMATS.some(([format]) => format === rawWorkFormat) ? rawWorkFormat as WorkFormat : "",
    foundedYear: asString(source.foundedYear),
    sizeBand: SIZE_BANDS.some(([band]) => band === asString(source.sizeBand)) ? asString(source.sizeBand) : "",
    industry: isKnownIndustry ? rawIndustry : rawIndustry ? OTHER_INDUSTRY : "",
    industryOther: asString(source.industryOther) || (!isKnownIndustry && !isOtherSentinel ? rawIndustry : ""),
    websiteUrl: asString(source.websiteUrl),
    logoFileId: asString(source.logoFileId),
    contactEmail: asString(source.contactEmail),
    telegram: asString(source.telegram),
    phone: asString(source.phone),
    socialLinks,
    photos,
  };
}

function fieldStep(key: string): number {
  if (key.startsWith("socialLinks.") || ["contactEmail", "telegram", "phone"].includes(key)) return 3;
  if (key.startsWith("photos")) return 4;
  if (["foundedYear", "sizeBand", "industry", "industryOther", "websiteUrl"].includes(key)) return 2;
  return 1;
}

function validWebsite(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizedSocial(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ru-RU");
}

function validateStep(step: number, form: CompanyDraft): WizardErrors {
  const errors: WizardErrors = {};
  const issue = (key: string, message: string) => { errors[key] = message; };

  if (step === 1) {
    if (!form.name.trim()) issue("name", "Укажите название компании");
    else if (form.name.trim().length > 160) issue("name", "Не больше 160 символов");
    if (!form.logoFileId) issue("logoFileId", "Загрузите логотип компании");
    if (!form.description.trim()) issue("description", "Добавьте краткое описание компании");
    else if (form.description.trim().length > 500) issue("description", "Не больше 500 символов");
    if (!form.workFormat) issue("workFormat", "Выберите один формат работы");
  }

  if (step === 2) {
    const year = Number(form.foundedYear);
    if (!form.foundedYear || !Number.isInteger(year) || year < 1800 || year > new Date().getFullYear()) issue("foundedYear", `Введите год от 1800 до ${new Date().getFullYear()}`);
    if (!SIZE_BANDS.some(([value]) => value === form.sizeBand)) issue("sizeBand", "Выберите размер компании");
    if (!form.industry) issue("industry", "Выберите сферу деятельности");
    if (form.industry === OTHER_INDUSTRY && !form.industryOther.trim()) issue("industryOther", "Уточните сферу деятельности");
    if (form.industry === OTHER_INDUSTRY && form.industryOther.trim().length > 120) issue("industryOther", "Не больше 120 символов");
    if (!validWebsite(form.websiteUrl)) issue("websiteUrl", "Укажите полный адрес сайта, начиная с http:// или https://");
  }

  if (step === 3) {
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) issue("contactEmail", "Проверьте адрес электронной почты");
    if (form.telegram.length > 100) issue("telegram", "Не больше 100 символов");
    if (form.phone.length > 50) issue("phone", "Не больше 50 символов");
    const seen = new Set<string>();
    for (const link of form.socialLinks) {
      const platformKey = `socialLinks.${link.key}.platform`;
      const valueKey = `socialLinks.${link.key}.value`;
      const platform = link.platform.trim();
      const value = link.value.trim();
      if (!platform && !value) continue;
      if (!platform) issue(platformKey, "Выберите соцсеть");
      if (!value) issue(valueKey, "Добавьте ссылку или username");
      else if (value.length > 500) issue(valueKey, "Не больше 500 символов");
      if (platform && value) {
        const key = `${platform}:${normalizedSocial(value)}`;
        if (seen.has(key)) issue(valueKey, "Эта запись уже добавлена");
        seen.add(key);
      }
    }
  }

  if (step === 4 && form.photos.length > 20) issue("photos", "Можно добавить не больше 20 фотографий");
  return errors;
}

function ErrorText({ id, children }: { id: string; children?: string }) {
  return children ? <span id={id} className="profile-field__error" role="alert">{children}</span> : null;
}

function TextField({
  field, label, value, onChange, error, type = "text", required = false, maxLength, min, max, placeholder, autoComplete,
}: {
  field: string; label: string; value: string; onChange: (value: string) => void; error?: string; type?: string;
  required?: boolean; maxLength?: number; min?: number; max?: number; placeholder?: string; autoComplete?: string;
}) {
  const id = `company-${field.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const errorId = `${id}-error`;
  return <label className="profile-field" htmlFor={id}>
    <span className="profile-field__label">{label}</span>
    <input id={id} data-company-field={field} type={type} value={value} required={required} maxLength={maxLength} min={min} max={max} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={event => onChange(event.target.value)} />
    <ErrorText id={errorId}>{error}</ErrorText>
  </label>;
}

function SelectField({
  field, label, value, options, onChange, error, required = false,
}: {
  field: string; label: string; value: string; options: [string, string][]; onChange: (value: string) => void; error?: string; required?: boolean;
}) {
  const id = `company-${field.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const errorId = `${id}-error`;
  return <label className="profile-field" htmlFor={id}>
    <span className="profile-field__label">{label}</span>
    <select id={id} data-company-field={field} value={value} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={event => onChange(event.target.value)}>
      <option value="">Выберите вариант</option>
      {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
    </select>
    <ErrorText id={errorId}>{error}</ErrorText>
  </label>;
}

function CompanyPanel({ userId, email, onSaved, onLogout }: Props) {
  const key = useMemo(() => draftKey(userId), [userId]);
  const [form, setForm] = useState<CompanyDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(1);
  const [exists, setExists] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadingError, setLoadingError] = useState("");
  const [errors, setErrors] = useState<WizardErrors>({});
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState("");
  const [photoUploadErrors, setPhotoUploadErrors] = useState<Record<string, string>>({});
  const totalSteps = STEP_TITLES.length;
  const progressPercent = Math.round(step / totalSteps * 100);
  const currentTitle = STEP_TITLES[step - 1];
  const isBusy = saving || uploadCount > 0;

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let published: Record<string, unknown> | null = null;
        try {
          published = await api<Record<string, unknown>>("/companies/me");
        } catch (reason) {
          if (!(reason instanceof ApiError) || reason.code !== "COMPANY_NOT_FOUND") throw reason;
        }
        if (!active) return;

        let savedDraft: { form?: unknown; step?: unknown } | null = null;
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const candidate = JSON.parse(raw) as { version?: unknown; form?: unknown; step?: unknown };
            if (candidate.version === 1 && candidate.form && typeof candidate.form === "object") savedDraft = candidate;
          }
        } catch {
          savedDraft = null;
        }

        const initial = savedDraft?.form as Record<string, unknown> | undefined;
        setForm(normalizeForm(initial ?? published ?? {}));
        const restoredStep = Number(savedDraft?.step);
        setStep(Number.isInteger(restoredStep) && restoredStep >= 1 && restoredStep <= totalSteps ? restoredStep : 1);
        setExists(Boolean(published));
        setReady(true);
      } catch (reason) {
        if (active) {
          setLoadingError((reason as Error).message || "Попробуйте обновить страницу");
          setReady(true);
        }
      }
    }
    void load();
    return () => { active = false; };
  }, [key, totalSteps]);

  useEffect(() => {
    if (!ready || loadingError) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({ version: 1, step, form }));
    } catch {
      console.warn("Company form draft could not be saved in browser storage");
    }
  }, [form, key, loadingError, ready, step]);

  function update<K extends keyof CompanyDraft>(field: K, value: CompanyDraft[K]) {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => { const next = { ...current }; delete next[field as string]; if (field === "industry") delete next.industryOther; return next; });
    setMessage("");
  }

  function updateSocial(keyToUpdate: string, field: "platform" | "value", value: string) {
    setForm(current => ({ ...current, socialLinks: current.socialLinks.map(link => link.key === keyToUpdate ? { ...link, [field]: value } : link) }));
    setErrors(current => { const next = { ...current }; delete next[`socialLinks.${keyToUpdate}.${field}`]; return next; });
    setMessage("");
  }

  function focusFirstError(nextErrors: WizardErrors) {
    const firstKey = Object.keys(nextErrors)[0];
    if (!firstKey) return;
    window.requestAnimationFrame(() => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-company-field]"));
      const wrapper = elements.find(element => element.dataset.companyField === firstKey);
      const target = wrapper?.matches("input,select,textarea,button") ? wrapper : wrapper?.querySelector<HTMLElement>("input,select,textarea,button");
      target?.focus({ preventScroll: true });
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      target?.scrollIntoView({ block: "center", behavior });
    });
  }

  function validateCurrentStep(candidate: number) {
    const nextErrors = validateStep(candidate, form);
    setErrors(current => ({ ...Object.fromEntries(Object.entries(current).filter(([field]) => fieldStep(field) !== candidate)), ...nextErrors }));
    if (Object.keys(nextErrors).length) focusFirstError(nextErrors);
    return nextErrors;
  }

  function advance() {
    const nextErrors = validateCurrentStep(step);
    if (Object.keys(nextErrors).length) return;
    setMessage("");
    setStep(current => Math.min(totalSteps, current + 1));
  }

  function goBack() {
    setErrors({});
    setMessage("");
    setStep(current => Math.max(1, current - 1));
  }

  async function uploadLogo(file: File) {
    setLogoUploadError("");
    if (!IMAGE_TYPES.includes(file.type)) { setLogoUploadError("Выберите изображение JPEG, PNG или WebP"); return; }
    if (file.size > MAX_IMAGE_BYTES) { setLogoUploadError("Логотип должен быть не больше 5 МБ"); return; }
    setLogoUploading(true);
    setUploadCount(count => count + 1);
    try {
      const body = new FormData();
      body.append("kind", "COMPANY_LOGO");
      body.append("file", file);
      const result = await api<{ fileId: string }>("/media", { method: "POST", body });
      update("logoFileId", result.fileId);
    } catch (reason) {
      setLogoUploadError((reason as Error).message || "Не удалось загрузить логотип");
    } finally {
      setLogoUploading(false);
      setUploadCount(count => Math.max(0, count - 1));
    }
  }

  async function uploadPhotos(category: PhotoCategory, input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    setPhotoUploadErrors(current => ({ ...current, [category]: "" }));
    const remaining = Math.max(0, 20 - form.photos.length);
    if (remaining === 0) {
      setPhotoUploadErrors(current => ({ ...current, [category]: "Достигнут общий лимит в 20 фотографий" }));
      return;
    }
    const selectedFiles = files.slice(0, remaining);
    const uploaded: CompanyPhotoDraft[] = [];
    const issues: string[] = [];
    if (files.length > remaining) issues.push(`Можно выбрать ещё только ${remaining} ${remaining === 1 ? "фотографию" : "фотографий"}`);
    setUploadCount(count => count + 1);
    try {
      for (const file of selectedFiles) {
        if (!IMAGE_TYPES.includes(file.type)) { issues.push(`${file.name}: неподдерживаемый формат`); continue; }
        if (file.size > MAX_IMAGE_BYTES) { issues.push(`${file.name}: файл больше 5 МБ`); continue; }
        const body = new FormData();
        body.append("kind", "COMPANY_PHOTO");
        body.append("file", file);
        try {
          const result = await api<{ fileId: string }>("/media", { method: "POST", body });
          const photo = { fileId: result.fileId, category, sortOrder: form.photos.filter(item => item.category === category).length + uploaded.length };
          uploaded.push(photo);
          setForm(current => ({ ...current, photos: [...current.photos, photo] }));
        } catch (reason) {
          issues.push(`${file.name}: ${(reason as Error).message || "не удалось загрузить"}`);
        }
      }
      if (issues.length) setPhotoUploadErrors(current => ({ ...current, [category]: issues.join(". ") }));
    } finally {
      setUploadCount(count => Math.max(0, count - 1));
    }
  }

  function removePhoto(photo: CompanyPhotoDraft) {
    setForm(current => {
      const photos = current.photos.filter(item => item.fileId !== photo.fileId);
      const order = new Map<PhotoCategory, number>();
      return { ...current, photos: photos.map(item => {
        const sortOrder = order.get(item.category) ?? 0;
        order.set(item.category, sortOrder + 1);
        return { ...item, sortOrder };
      }) };
    });
    setErrors(current => { const next = { ...current }; delete next.photos; return next; });
  }

  async function finish() {
    const allErrors: WizardErrors = {};
    for (let currentStep = 1; currentStep <= totalSteps; currentStep += 1) Object.assign(allErrors, validateStep(currentStep, form));
    setErrors(allErrors);
    if (Object.keys(allErrors).length) {
      const firstKey = Object.keys(allErrors)[0];
      setStep(fieldStep(firstKey));
      focusFirstError(allErrors);
      return;
    }
    if (uploadCount > 0) return;

    setSaving(true);
    setMessage("");
    setMessageIsError(false);
    const nextOrder = new Map<PhotoCategory, number>();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      workFormat: form.workFormat,
      foundedYear: Number(form.foundedYear),
      sizeBand: form.sizeBand,
      industry: (form.industry === OTHER_INDUSTRY ? form.industryOther : form.industry).trim(),
      websiteUrl: form.websiteUrl.trim() || null,
      logoFileId: form.logoFileId,
      contactEmail: form.contactEmail.trim() || null,
      telegram: form.telegram.trim() || null,
      phone: form.phone.trim() || null,
      socialLinks: form.socialLinks.filter(link => link.platform && link.value.trim()).map(({ platform, value }) => ({ platform, value: value.trim() })),
      photos: form.photos.map(photo => {
        const sortOrder = nextOrder.get(photo.category) ?? 0;
        nextOrder.set(photo.category, sortOrder + 1);
        return { fileId: photo.fileId, category: photo.category, sortOrder };
      }),
    };

    try {
      await send("/companies/me", exists ? "PUT" : "POST", payload);
      setExists(true);
      try { window.localStorage.removeItem(key); } catch { /* The server save is complete. */ }
      onSaved();
    } catch (reason) {
      setMessage(`${(reason as Error).message || "Неизвестная ошибка"}. Черновик сохранён — проверьте соединение и повторите попытку.`);
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    if (step < totalSteps) advance();
    else void finish();
  }

  const selectedIndustry = form.industry === OTHER_INDUSTRY ? "Другое" : form.industry;
  const sizeLabel = SIZE_BANDS.find(([value]) => value === form.sizeBand)?.[1] ?? "";
  const formatLabel = WORK_FORMATS.find(([value]) => value === form.workFormat)?.[1] ?? "";
  const socialPreview = form.socialLinks.filter(link => link.platform && link.value.trim());
  const photoCount = form.photos.length;

  return <section className="profile-wizard company-wizard" aria-label="Анкета работодателя" aria-busy={saving}>
    <div className="profile-wizard__topline">
      <div className="profile-wizard__progress-block">
        <div className="profile-wizard__counter" aria-live="polite">
          <span>{String(step).padStart(2, "0")}</span><span aria-hidden="true"> / </span><span className="profile-wizard__total">{String(totalSteps).padStart(2, "0")}</span>
        </div>
        <div className="profile-wizard__progress" role="progressbar" aria-label="Прогресс анкеты компании" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step}>
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <div className="company-wizard__account"><span>{email}</span><button type="button" className="profile-wizard__logout" onClick={onLogout} disabled={isBusy}>Выйти</button></div>
    </div>

    <div className="profile-wizard__body">
      <div className="profile-wizard__main">
        <div className="profile-wizard__heading">
          <h1>{currentTitle}</h1>
          <p>{exists ? "Обновите профиль компании. Изменения появятся после завершения анкеты." : "Расскажите о компании — профиль появится в ленте после завершения анкеты."}</p>
        </div>

        {!ready && <div className="profile-wizard__loading" role="status">Загружаем компанию…</div>}
        {loadingError && <p className="profile-wizard__error" role="alert">Не удалось загрузить данные компании: {loadingError}</p>}

        {ready && !loadingError && <form className="profile-wizard__form" onSubmit={submit} noValidate>
          <div className="profile-wizard__fields">
            <fieldset className="company-wizard__step-fields" disabled={isBusy}>
              {step === 1 && <div className="profile-step-stack company-wizard__step-one">
                <div className="profile-form-grid">
                  <TextField field="name" label="Название компании" value={form.name} onChange={value => update("name", value)} error={errors.name} maxLength={160} required autoComplete="organization" placeholder="Например, MTCH" />
                  <ChoiceField field="workFormat" label="Формат работы" value={form.workFormat} options={WORK_FORMATS} onChange={value => update("workFormat", value)} error={errors.workFormat} />
                </div>
                <label className="profile-field" htmlFor="company-description">
                  <span className="profile-field__label">Краткое описание</span>
                  <textarea id="company-description" data-company-field="description" value={form.description} maxLength={500} rows={4} required placeholder="Чем занимается компания и какие задачи решает команда?" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "company-description-error" : "company-description-count"} onChange={event => update("description", event.target.value)} />
                  <span className="profile-field__hint" id="company-description-count">{form.description.length} / 500</span>
                  <ErrorText id="company-description-error">{errors.description}</ErrorText>
                </label>
                <div className="profile-field" data-company-field="logoFileId" tabIndex={-1}>
                  <span className="profile-field__label">Логотип компании</span>
                  <label className={form.logoFileId ? "company-logo-upload has-logo" : "company-logo-upload"} htmlFor="company-logo-upload">
                    {form.logoFileId
                      ? <Image src={`/api/v1/media/${form.logoFileId}`} width={220} height={150} unoptimized alt="Предварительный просмотр логотипа компании" />
                      : <UiIcon icon={Building2} size={28} className="company-logo-upload__icon" />}
                    <span>{logoUploading ? "Загружаем логотип…" : form.logoFileId ? "Заменить логотип" : "Загрузить логотип"}</span>
                    <input id="company-logo-upload" type="file" accept="image/jpeg,image/png,image/webp" disabled={isBusy} aria-invalid={Boolean(errors.logoFileId || logoUploadError)} aria-describedby={errors.logoFileId ? "company-logo-error" : logoUploadError ? "company-logo-upload-error" : undefined} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadLogo(file); event.target.value = ""; }} />
                  </label>
                  <ErrorText id="company-logo-error">{errors.logoFileId}</ErrorText>
                  <ErrorText id="company-logo-upload-error">{logoUploadError}</ErrorText>
                  <span className="profile-field__hint company-logo-upload__hint">JPEG, PNG или WebP · до 5 МБ</span>
                </div>
              </div>}

              {step === 2 && <div className="profile-step-stack">
                <div className="profile-form-grid">
                  <TextField field="foundedYear" label="Год основания" type="number" value={form.foundedYear} onChange={value => update("foundedYear", value)} error={errors.foundedYear} min={1800} max={new Date().getFullYear()} required placeholder="2016" />
                  <SelectField field="sizeBand" label="Размер компании" value={form.sizeBand} options={SIZE_BANDS} onChange={value => update("sizeBand", value)} error={errors.sizeBand} required />
                </div>
                <div className="profile-form-grid">
                  <SelectField field="industry" label="Сфера деятельности" value={form.industry} options={[...INDUSTRIES.map(value => [value, value] as [string, string]), [OTHER_INDUSTRY, "Другое"] as [string, string]]} onChange={value => update("industry", value)} error={errors.industry} required />
                  {form.industry === OTHER_INDUSTRY && <TextField field="industryOther" label="Уточните сферу" value={form.industryOther} onChange={value => update("industryOther", value)} error={errors.industryOther} maxLength={120} required placeholder="Например, робототехника" />}
                  <TextField field="websiteUrl" label="Сайт" type="url" value={form.websiteUrl} onChange={value => update("websiteUrl", value)} error={errors.websiteUrl} placeholder="https://company.ru" autoComplete="url" />
                </div>
              </div>}

              {step === 3 && <div className="profile-step-stack">
                <p className="company-wizard__privacy-note">Контакты сохраняются в профиле компании. Специалистам они доступны после Match или принятия приглашения на практику.</p>
                <div className="profile-form-grid">
                  <TextField field="contactEmail" label="Email" type="email" value={form.contactEmail} onChange={value => update("contactEmail", value)} error={errors.contactEmail} maxLength={254} autoComplete="email" placeholder="team@company.ru" />
                  <TextField field="telegram" label="Telegram" value={form.telegram} onChange={value => update("telegram", value)} error={errors.telegram} maxLength={100} placeholder="@username" />
                  <TextField field="phone" label="Телефон" type="tel" value={form.phone} onChange={value => update("phone", value)} error={errors.phone} maxLength={50} autoComplete="tel" placeholder="+7 900 000-00-00" />
                </div>
                <div className="company-wizard__socials">
                  <h2>Социальные сети</h2>
                  <p>Можно добавить несколько аккаунтов одной сети.</p>
                  {form.socialLinks.map(link => <div className="company-social-row" key={link.key}>
                    <SelectField field={`socialLinks.${link.key}.platform`} label="Платформа" value={link.platform} options={SOCIAL_PLATFORMS} onChange={value => updateSocial(link.key, "platform", value)} error={errors[`socialLinks.${link.key}.platform`]} />
                    <TextField field={`socialLinks.${link.key}.value`} label="Ссылка или username" value={link.value} onChange={value => updateSocial(link.key, "value", value)} error={errors[`socialLinks.${link.key}.value`]} maxLength={500} placeholder="https://… или @username" />
                    <button type="button" className="company-social-row__remove" aria-label="Удалить соцсеть" onClick={() => { setForm(current => ({ ...current, socialLinks: current.socialLinks.filter(item => item.key !== link.key) })); setErrors(current => Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith(`socialLinks.${link.key}.`)))); }}><UiIcon icon={X} size={16} /></button>
                  </div>)}
                  <button type="button" className="company-wizard__add" onClick={() => setForm(current => ({ ...current, socialLinks: [...current.socialLinks, { key: newRowKey(), platform: "", value: "" }] }))}><UiIcon icon={Plus} size={14} />Добавить соцсеть</button>
                </div>
              </div>}

              {step === 4 && <div className="profile-step-stack company-wizard__photos-step">
                <div className="company-wizard__photo-heading"><p>Покажите офис, команду и рабочую среду.</p><span>{photoCount} / 20</span></div>
                <div className="company-photo-groups" data-company-field="photos" tabIndex={-1}>
                  {PHOTO_CATEGORIES.map(([category, label]) => {
                    const photos = form.photos.filter(photo => photo.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
                    return <section className="company-photo-group" key={category} aria-label={label}>
                      <div className="company-photo-group__header"><h2>{label}</h2><span>{photos.length}</span></div>
                      {photos.length > 0 && <div className="company-photo-grid">{photos.map(photo => <div className="company-photo-thumb" key={photo.fileId}>
                        <Image src={`/api/v1/media/${photo.fileId}`} width={160} height={120} unoptimized alt="" />
                        <button type="button" aria-label={`Удалить фото: ${label}`} onClick={() => removePhoto(photo)}><UiIcon icon={X} size={14} /></button>
                      </div>)}</div>}
                      <label className="company-photo-add" htmlFor={`company-photo-${category}`}>
                        <UiIcon icon={ImagePlus} size={16} /><span>Добавить фото</span>
                        <input id={`company-photo-${category}`} type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label={`Добавить фото: ${label}`} disabled={isBusy || photoCount >= 20} onChange={event => { void uploadPhotos(category, event.currentTarget); }} />
                      </label>
                      {photoUploadErrors[category] && <p className="profile-field__error" role="alert">{photoUploadErrors[category]}</p>}
                    </section>;
                  })}
                </div>
                {errors.photos && <ErrorText id="company-photos-error">{errors.photos}</ErrorText>}
                <p className="company-wizard__upload-hint">JPEG, PNG или WebP · до 5 МБ за файл · всего до 20 фотографий</p>
              </div>}
            </fieldset>
          </div>

          {message && <p className={messageIsError ? "profile-wizard__message is-error" : "profile-wizard__message"} role={messageIsError ? "alert" : "status"}>{message}</p>}
          <footer className="profile-wizard__actions">
            <button type="button" className="profile-wizard__back" onClick={goBack} disabled={step === 1 || isBusy} aria-disabled={step === 1 || isBusy}><UiIcon icon={ArrowLeft} size={14} />Назад</button>
            <button type="submit" className="profile-wizard__next" disabled={!ready || isBusy}>
              {saving ? "Сохраняем…" : step === totalSteps ? "Завершить" : "Далее"}
              {!saving && <UiIcon icon={step === totalSteps ? Check : ArrowRight} size={16} className="profile-wizard__next-icon" />}
            </button>
          </footer>
        </form>}
      </div>

      <aside className={step === 1 ? "profile-preview profile-preview--intro company-preview" : "profile-preview company-preview"} aria-label="Предварительный просмотр компании">
        <div className="profile-preview__identity">
          <div className="profile-preview__avatar company-preview__logo">
            {form.logoFileId ? <Image src={`/api/v1/media/${form.logoFileId}`} width={256} height={256} unoptimized alt="" /> : <UiIcon icon={Building2} size={28} />}
          </div>
          <div className="profile-preview__name-block"><h2>{form.name.trim() || "Название компании"}</h2></div>
        </div>
        <div className="profile-preview__details">
          {step === 1 && <>
            {form.description.trim() && <PreviewRow label="О компании" value={form.description} />}
            {formatLabel && <PreviewRow label="Формат работы" value={formatLabel} />}
            {!form.description.trim() && !formatLabel && <p className="profile-preview__empty">Название и логотип останутся здесь, когда вы перейдёте к следующим шагам.</p>}
          </>}
          {step === 2 && <>
            {form.foundedYear && <PreviewRow label="Основана" value={form.foundedYear} />}
            {sizeLabel && <PreviewRow label="Размер" value={`${sizeLabel} человек`} />}
            {selectedIndustry && <PreviewRow label="Сфера" value={form.industry === OTHER_INDUSTRY ? form.industryOther || "Другое" : selectedIndustry} />}
            {form.websiteUrl && <PreviewRow label="Сайт" value={form.websiteUrl} />}
            {!form.foundedYear && !sizeLabel && !selectedIndustry && !form.websiteUrl && <p className="profile-preview__empty">Информация о компании появится здесь.</p>}
          </>}
          {step === 3 && <>
            {form.contactEmail && <PreviewRow label="Email" value={form.contactEmail} />}
            {form.telegram && <PreviewRow label="Telegram" value={form.telegram} />}
            {form.phone && <PreviewRow label="Телефон" value={form.phone} />}
            {socialPreview.map(link => <PreviewRow key={link.key} label={SOCIAL_PLATFORMS.find(([platform]) => platform === link.platform)?.[1] ?? "Соцсеть"} value={link.value} />)}
            {!(form.contactEmail || form.telegram || form.phone || socialPreview.length) && <p className="profile-preview__empty">Добавьте контакты или соцсети — они появятся здесь.</p>}
          </>}
          {step === 4 && <>
            {PHOTO_CATEGORIES.map(([category, label]) => {
              const photos = form.photos.filter(photo => photo.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
              return photos.length ? <div className="company-preview__photo-row" key={category}>
                <span>{label}</span><div className="company-preview__photos">{photos.slice(0, 4).map(photo => <Image key={photo.fileId} src={`/api/v1/media/${photo.fileId}`} width={72} height={56} unoptimized alt="" />)}{photos.length > 4 && <span className="company-preview__more">+{photos.length - 4}</span>}</div>
              </div> : null;
            })}
            {photoCount === 0 && <p className="profile-preview__empty">Добавленные фотографии появятся здесь.</p>}
          </>}
        </div>
      </aside>
    </div>
  </section>;
}

function ChoiceField({
  field, label, value, options, onChange, error,
}: {
  field: string; label: string; value: string; options: [string, string][]; onChange: (value: WorkFormat) => void; error?: string;
}) {
  const errorId = `company-${field}-error`;
  return <fieldset className="profile-choice" data-company-field={field} tabIndex={-1} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
    <legend>{label}</legend>
    <div className="profile-choice__options" style={{ "--choice-columns": 3 } as React.CSSProperties}>
      {options.map(([optionValue, optionLabel]) => <button type="button" key={optionValue} className={value === optionValue ? "profile-choice__option is-selected" : "profile-choice__option"} aria-pressed={value === optionValue} onClick={() => onChange(optionValue as WorkFormat)}>{optionLabel}</button>)}
    </div>
    <ErrorText id={errorId}>{error}</ErrorText>
  </fieldset>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <div className="profile-preview__row"><span>{label}</span><p>{value}</p></div>;
}

export { CompanyPanel };
