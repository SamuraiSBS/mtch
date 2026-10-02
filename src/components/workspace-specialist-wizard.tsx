"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { api, send } from "./api";
import { EMPLOYMENT, EXPERIENCE, LEVEL, WORK } from "./fields";
import type { Catalogs, Item } from "./workspace";
import { DIRECTIONS, GOALS } from "./practice-options";

type SpecialistDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  cityId: string;
  avatarFileId: string;
  professionId: string;
  experience: string;
  level: string;
  cooperationType: string;
  skillIds: string[];
  employmentGoal: string;
  salaryMinRub: string;
  salaryMaxRub: string;
  workFormat: string;
  employmentType: string;
  searchStatus: string;
  educationalInstitution: string;
  educationProgram: string;
  studyCourse: string;
  practiceStartDate: string;
  practiceEndDate: string;
  desiredDirections: string[];
  practiceWorkFormats: string[];
  about: string;
  portfolioUrl: string;
  githubUrl: string;
  behanceGitlabUrl: string;
  telegram: string;
};

type WizardErrors = Record<string, string>;
type Choice = [string, string];

const EMPTY_DRAFT: SpecialistDraft = {
  firstName: "",
  lastName: "",
  birthDate: "",
  cityId: "",
  avatarFileId: "",
  professionId: "",
  experience: "",
  level: "",
  cooperationType: "",
  skillIds: [],
  employmentGoal: "OPEN_TO_OFFERS",
  salaryMinRub: "",
  salaryMaxRub: "",
  workFormat: "",
  employmentType: "",
  searchStatus: "OPEN_TO_OFFERS",
  educationalInstitution: "",
  educationProgram: "",
  studyCourse: "",
  practiceStartDate: "",
  practiceEndDate: "",
  desiredDirections: [],
  practiceWorkFormats: [],
  about: "",
  portfolioUrl: "",
  githubUrl: "",
  behanceGitlabUrl: "",
  telegram: "",
};

const COOPERATION: Choice[] = [
  ["STAFF", "Штат"],
  ["PROJECT", "Проект"],
  ["FREELANCE", "Фриланс"],
  ["INTERNSHIP", "Стажировка"],
];

const SEARCH_STATUS: Choice[] = [
  ["ACTIVE", "Активно ищу"],
  ["OPEN_TO_OFFERS", "Открыт к предложениям"],
  ["NOT_LOOKING", "Не ищу"],
];

const PROFILE_DRAFT_VERSION = 1;

function asString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function normalizeDraft(source: Record<string, unknown>): SpecialistDraft {
  const skills = Array.isArray(source.skillIds)
    ? source.skillIds
    : Array.isArray(source.skills)
      ? source.skills.map((skill) => (typeof skill === "object" && skill ? (skill as { id?: unknown }).id : ""))
      : [];

  return {
    ...EMPTY_DRAFT,
    ...Object.fromEntries(Object.keys(EMPTY_DRAFT).map((key) => [key, source[key]])),
    firstName: asString(source.firstName),
    lastName: asString(source.lastName),
    birthDate: asString(source.birthDate),
    cityId: asString(source.cityId),
    avatarFileId: asString(source.avatarFileId),
    professionId: asString(source.professionId),
    experience: asString(source.experience),
    level: asString(source.level),
    cooperationType: asString(source.cooperationType),
    skillIds: skills.map(asString).filter(Boolean),
    employmentGoal: asString(source.employmentGoal) || EMPTY_DRAFT.employmentGoal,
    salaryMinRub: asString(source.salaryMinRub),
    salaryMaxRub: asString(source.salaryMaxRub),
    workFormat: asString(source.workFormat),
    employmentType: asString(source.employmentType),
    searchStatus: asString(source.searchStatus) || EMPTY_DRAFT.searchStatus,
    educationalInstitution: asString(source.educationalInstitution),
    educationProgram: asString(source.educationProgram),
    studyCourse: asString(source.studyCourse),
    practiceStartDate: asString(source.practiceStartDate),
    practiceEndDate: asString(source.practiceEndDate),
    desiredDirections: Array.isArray(source.desiredDirections) ? source.desiredDirections.map(asString).filter(Boolean) : [],
    practiceWorkFormats: Array.isArray(source.practiceWorkFormats) ? source.practiceWorkFormats.map(asString).filter(Boolean) : [],
    about: asString(source.about),
    portfolioUrl: asString(source.portfolioUrl),
    githubUrl: asString(source.githubUrl),
    behanceGitlabUrl: asString(source.behanceGitlabUrl),
    telegram: asString(source.telegram),
  };
}

function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function labelFor(value: string, options: Choice[] | Item[]): string {
  const match = options.find((option) => "id" in option ? option.id === value : option[0] === value);
  if (!match) return "";
  return "id" in match ? match.name : match[1];
}

function formatSalary(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `${new Intl.NumberFormat("ru-RU").format(number)} ₽` : "";
}

function compactText(text: string, limit: number): { text: string; hidden: number } {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return { text: trimmed, hidden: 0 };
  return { text: `${trimmed.slice(0, limit).trimEnd()}…`, hidden: trimmed.length - limit };
}

function ProfileTextField({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  maxLength,
  min,
  max,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  autoComplete?: string;
}) {
  const inputId = `specialist-${name}`;
  const errorId = `${inputId}-error`;
  return <label className="profile-field" htmlFor={inputId}>
    <span className="profile-field__label">{label}</span>
    <input
      id={inputId}
      data-profile-field={name}
      type={type}
      value={value}
      required={required}
      maxLength={maxLength}
      min={min}
      max={max}
      placeholder={placeholder}
      autoComplete={autoComplete}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
    {error && <span id={errorId} className="profile-field__error" role="alert">{error}</span>}
  </label>;
}

function ProfileSelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
  optional = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Choice[] | Item[];
  error?: string;
  optional?: boolean;
}) {
  const inputId = `specialist-${name}`;
  const errorId = `${inputId}-error`;
  return <label className="profile-field" htmlFor={inputId}>
    <span className="profile-field__label">{label}</span>
    <select
      id={inputId}
      data-profile-field={name}
      value={value}
      required={!optional}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{optional ? "Не выбрано" : "Выберите вариант"}</option>
      {options.map((option) => "id" in option
        ? <option key={option.id} value={option.id}>{option.name}</option>
        : <option key={option[0]} value={option[0]}>{option[1]}</option>)}
    </select>
    {error && <span id={errorId} className="profile-field__error" role="alert">{error}</span>}
  </label>;
}

function ChoiceField({
  label,
  name,
  value,
  options,
  onChange,
  error,
  columns = 3,
  optional = false,
}: {
  label: string;
  name: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
  error?: string;
  columns?: number;
  optional?: boolean;
}) {
  return <fieldset className="profile-choice" data-profile-field={name} tabIndex={-1}>
    <legend>{label}</legend>
    <div className="profile-choice__options" style={{ "--choice-columns": columns } as React.CSSProperties}>
      {options.map(([optionValue, optionLabel]) => <button
        key={optionValue}
        type="button"
        className={value === optionValue ? "profile-choice__option is-selected" : "profile-choice__option"}
        aria-pressed={value === optionValue}
        onClick={() => onChange(optional && value === optionValue ? "" : optionValue)}
      >{optionLabel}</button>)}
    </div>
    {optional && value && <button type="button" className="profile-choice__clear" onClick={() => onChange("")}>Сбросить</button>}
    {error && <span className="profile-field__error" role="alert">{error}</span>}
  </fieldset>;
}

function MultiChoiceField({
  label,
  name,
  values,
  options,
  onToggle,
  error,
  columns = 3,
}: {
  label: string;
  name: string;
  values: string[];
  options: Choice[];
  onToggle: (value: string) => void;
  error?: string;
  columns?: number;
}) {
  return <fieldset className="profile-choice" data-profile-field={name} tabIndex={-1} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}>
    <legend>{label}</legend>
    <div className="profile-choice__options" style={{ "--choice-columns": columns } as React.CSSProperties}>
      {options.map(([optionValue, optionLabel]) => <button
        key={optionValue}
        type="button"
        className={values.includes(optionValue) ? "profile-choice__option is-selected" : "profile-choice__option"}
        aria-pressed={values.includes(optionValue)}
        onClick={() => onToggle(optionValue)}
      >{optionLabel}</button>)}
    </div>
    {error && <span id={`${name}-error`} className="profile-field__error" role="alert">{error}</span>}
  </fieldset>;
}

function SkillPicker({
  items,
  selected,
  onChange,
  error,
}: {
  items: Item[];
  selected: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const selectedItems = items.filter((item) => selected.includes(item.id));
  const filteredItems = items
    .filter((item) => !selected.includes(item.id) && item.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")))
    .slice(0, 5);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((selectedId) => selectedId !== id) : [...selected, id]);
  }

  return <fieldset className="profile-field profile-skills" data-profile-field="skillIds" tabIndex={-1}>
    <legend className="profile-field__label">Навыки <span className="profile-field__optional">минимум один</span></legend>
    <div className="profile-skills__box" aria-describedby={error ? "specialist-skillIds-error" : undefined}>
      <div className="profile-skills__selected" aria-live="polite">
        {selectedItems.slice(0, 5).map((item) => <span className="profile-skill-chip" key={item.id}>
          {item.name}
          <button type="button" aria-label={`Убрать навык ${item.name}`} onClick={() => toggle(item.id)}>×</button>
        </span>)}
        {selectedItems.length > 5 && <span className="profile-skill-more">+{selectedItems.length - 5}</span>}
        <input
          type="search"
          value={query}
          aria-label="Найти навык"
          placeholder={selectedItems.length ? "Добавить навык…" : "Найти и добавить навык…"}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {query && <div className="profile-skills__results" role="group" aria-label="Результаты поиска навыков">
        {filteredItems.length > 0
          ? filteredItems.map((item) => <button type="button" key={item.id} onClick={() => { toggle(item.id); setQuery(""); }}>{item.name}</button>)
          : <span>Навыки не найдены</span>}
      </div>}
    </div>
    {error && <span id="specialist-skillIds-error" className="profile-field__error" role="alert">{error}</span>}
  </fieldset>;
}

function AvatarUploader({
  fileId,
  onChange,
  onLoadingChange,
  error,
}: {
  fileId: string;
  onChange: (value: string) => void;
  onLoadingChange: (loading: boolean) => void;
  error?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputId = "specialist-avatar-upload";

  async function upload(file: File) {
    setLoading(true);
    onLoadingChange(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("kind", "AVATAR");
      body.append("file", file);
      const result = await api<{ fileId: string }>("/media", { method: "POST", body });
      onChange(result.fileId);
    } catch (reason) {
      setUploadError((reason as Error).message);
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  }

  return <div className="profile-photo-field">
    <span className="profile-field__label">Фото профиля</span>
    <div className={fileId ? "profile-photo-upload has-photo" : "profile-photo-upload"}>
      {fileId
        ? <Image src={`/api/v1/media/${fileId}?size=256`} width={256} height={256} unoptimized alt="Предварительный просмотр фото профиля" />
        : <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 11.5 16.2 8h7.6l2.2 3.5H33a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-15a3 3 0 0 1 3-3h7Z" /><circle cx="20" cy="21" r="6" /><path d="M31 5v7M27.5 8.5h7" /></svg>}
      <label className="profile-photo-upload__action" htmlFor={inputId}>{loading ? "Обрабатываем фото…" : fileId ? "Заменить фото" : "Загрузить фото"}</label>
      <input
        id={inputId}
        data-profile-field="avatarFileId"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-describedby={error ? "specialist-avatar-error" : uploadError ? "specialist-avatar-upload-error" : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
    </div>
    {error && <span id="specialist-avatar-error" className="profile-field__error" role="alert">{error}</span>}
    {uploadError && <span id="specialist-avatar-upload-error" className="profile-field__error" role="alert">{uploadError}</span>}
  </div>;
}

export function SpecialistProfileWizard({
  catalogs,
  userId,
  onSaved,
  onLogout,
}: {
  catalogs: Catalogs;
  userId: string;
  onSaved?: () => void;
  onLogout?: () => void;
}) {
  const [form, setForm] = useState<SpecialistDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(1);
  const [exists, setExists] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadingError, setLoadingError] = useState("");
  const [errors, setErrors] = useState<WizardErrors>({});
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const isPractice = form.employmentGoal === "PRACTICE";
  const totalSteps = isPractice ? 5 : 4;
  const draftKey = `mtch:specialist-profile-draft:${userId}`;
  const cities = catalogs.cities;
  const professions = catalogs.professions;
  const selectedSkillItems = useMemo(() => catalogs.skills.filter((item) => form.skillIds.includes(item.id)), [catalogs.skills, form.skillIds]);
  const currentTitle = step === 1
    ? "Личные данные"
    : step === 2
      ? "Специализация и навыки"
      : step === 3
        ? "Параметры работы"
        : step === 4 && isPractice
          ? "Обучение и практика"
          : "О себе и ссылки";

  useEffect(() => {
    let active = true;
    async function hydrate() {
      let serverProfile = EMPTY_DRAFT;
      let profileExists = false;
      let fetchError = "";

      try {
        const profile = await api<Record<string, unknown>>("/specialists/me");
        serverProfile = normalizeDraft(profile);
        profileExists = true;
      } catch (reason) {
        const error = (reason as Error).message;
        if (!error.includes("Профиль не найден") && !error.includes("SPECIALIST_NOT_FOUND")) fetchError = error;
      }

      let savedValues: SpecialistDraft | null = null;
      let savedStep = 1;
      try {
        const stored = window.localStorage.getItem(draftKey);
        if (stored) {
          const parsed = JSON.parse(stored) as { version?: number; step?: number; form?: Record<string, unknown> };
          if (parsed.version === PROFILE_DRAFT_VERSION && parsed.form) {
            savedValues = normalizeDraft(parsed.form);
            savedStep = Number.isInteger(parsed.step) ? Number(parsed.step) : 1;
          }
        }
      } catch {
        // An unavailable or malformed browser draft should not prevent profile editing.
      }

      if (!active) return;
      const nextForm = savedValues ? { ...serverProfile, ...savedValues } : serverProfile;
      const maxStep = nextForm.employmentGoal === "PRACTICE" ? 5 : 4;
      setForm(nextForm);
      setExists(profileExists);
      setStep(Math.max(1, Math.min(savedStep, maxStep)));
      setLoadingError(fetchError);
      setReady(true);
    }

    void hydrate();
    return () => { active = false; };
  }, [draftKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ version: PROFILE_DRAFT_VERSION, step, form }));
    } catch {
      // Continue the form if browser storage is unavailable or full.
    }
  }, [draftKey, form, ready, step]);

  function update<K extends keyof SpecialistDraft>(key: K, value: SpecialistDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setMessage("");
  }

  function validateStep(stepToValidate: number): WizardErrors {
    const next: WizardErrors = {};
    if (stepToValidate === 1) {
      if (!form.firstName.trim()) next.firstName = "Укажите имя";
      if (!form.lastName.trim()) next.lastName = "Укажите фамилию";
      if (!form.avatarFileId) next.avatarFileId = "Загрузите фото профиля";
    } else if (stepToValidate === 2) {
      if (!form.professionId) next.professionId = "Выберите специализацию";
      if (form.skillIds.length === 0) next.skillIds = "Добавьте хотя бы один навык";
    } else if (stepToValidate === 3 && !isPractice) {
      const min = Number(form.salaryMinRub);
      const max = Number(form.salaryMaxRub);
      if (!Number.isInteger(min) || min <= 0) next.salaryMinRub = "Укажите минимальную зарплату";
      if (!Number.isInteger(max) || max <= 0) next.salaryMaxRub = "Укажите максимальную зарплату";
      if (Number.isInteger(min) && Number.isInteger(max) && min > 0 && max > 0 && max < min) next.salaryMaxRub = "Максимум должен быть не ниже минимума";
    } else if (stepToValidate === 4 && isPractice) {
      if (!form.educationalInstitution.trim()) next.educationalInstitution = "Укажите учебное заведение";
      if (!form.educationProgram.trim()) next.educationProgram = "Укажите программу обучения";
      const course = Number(form.studyCourse);
      if (!Number.isInteger(course) || course < 1 || course > 6) next.studyCourse = "Укажите курс от 1 до 6";
      if (!form.practiceStartDate) next.practiceStartDate = "Укажите дату начала";
      if (!form.practiceEndDate) next.practiceEndDate = "Укажите дату окончания";
      if (form.practiceStartDate && form.practiceEndDate && form.practiceEndDate <= form.practiceStartDate) next.practiceEndDate = "Дата окончания должна быть позже начала";
      if (form.desiredDirections.length === 0) next.desiredDirections = "Выберите хотя бы одно направление";
      if (form.desiredDirections.length > 3) next.desiredDirections = "Можно выбрать не больше трёх направлений";
      if (form.practiceWorkFormats.length === 0) next.practiceWorkFormats = "Выберите формат практики";
      if (form.practiceWorkFormats.some((format) => format !== "REMOTE") && !form.cityId) next.cityId = "Для офиса или гибрида укажите город на первом шаге";
    } else if (stepToValidate === totalSteps) {
      for (const [key, value] of [["portfolioUrl", form.portfolioUrl], ["githubUrl", form.githubUrl], ["behanceGitlabUrl", form.behanceGitlabUrl]] as const) {
        if (value && !URL.canParse(value)) next[key] = "Укажите ссылку целиком, например https://example.com";
      }
    }
    return next;
  }

  function focusFirstError(nextErrors: WizardErrors) {
    const first = Object.keys(nextErrors)[0];
    if (!first) return;
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-profile-field="${first}"]`)?.focus(), 0);
  }

  function advance() {
    const nextErrors = validateStep(step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }
    setMessage("");
    setStep((current) => Math.min(current + 1, totalSteps));
  }

  function goBack() {
    setErrors({});
    setMessage("");
    setStep((current) => Math.max(current - 1, 1));
  }

  async function finish() {
    const firstInvalidStep = Array.from({ length: totalSteps }, (_, index) => index + 1).find((candidateStep) => Object.keys(validateStep(candidateStep)).length > 0);
    const nextErrors = firstInvalidStep ? validateStep(firstInvalidStep) : {};
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(firstInvalidStep ?? step);
      focusFirstError(nextErrors);
      return;
    }
    if (processingPhoto) return;
    setSaving(true);
    setMessage("");
    setMessageIsError(false);
    const practice = form.employmentGoal === "PRACTICE";
    const payload = {
      ...form,
      birthDate: form.birthDate || null,
      cityId: form.cityId || null,
      experience: form.experience || null,
      level: form.level || null,
      cooperationType: form.cooperationType || null,
      skillIds: form.skillIds,
      about: form.about || null,
      portfolioUrl: form.portfolioUrl || null,
      githubUrl: form.githubUrl || null,
      behanceGitlabUrl: form.behanceGitlabUrl || null,
      telegram: form.telegram || null,
      salaryMinRub: practice ? null : Number(form.salaryMinRub),
      salaryMaxRub: practice ? null : Number(form.salaryMaxRub),
      workFormat: form.workFormat || null,
      employmentType: form.employmentType || null,
      studyCourse: practice ? Number(form.studyCourse) : null,
      practiceStartDate: practice ? form.practiceStartDate : null,
      practiceEndDate: practice ? form.practiceEndDate : null,
      educationalInstitution: practice ? form.educationalInstitution : null,
      educationProgram: practice ? form.educationProgram : null,
      desiredDirections: practice ? form.desiredDirections : null,
      practiceWorkFormats: practice ? form.practiceWorkFormats : null,
    };

    try {
      await send("/specialists/me", exists ? "PUT" : "POST", payload);
      setExists(true);
      setMessage("Анкета сохранена и опубликована");
      try { window.localStorage.removeItem(draftKey); } catch { /* The saved profile is still complete. */ }
      onSaved?.();
    } catch (reason) {
      setMessage((reason as Error).message);
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  }

  function submitStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === totalSteps) void finish();
    else advance();
  }

  const cityName = labelFor(form.cityId, cities);
  const professionName = labelFor(form.professionId, professions);
  const experienceName = labelFor(form.experience, EXPERIENCE as Choice[]);
  const levelName = labelFor(form.level, LEVEL as Choice[]);
  const age = calculateAge(form.birthDate);
  const aboutPreview = compactText(form.about, 124);
  const progressPercent = Math.round((step / totalSteps) * 100);
  const inPracticeStep = isPractice && step === 4;
  const inAboutStep = step === (isPractice ? 5 : 4);

  return <section className="profile-wizard" aria-label="Анкета специалиста">
    <div className="profile-wizard__topline">
      <div className="profile-wizard__progress-block">
        <div className="profile-wizard__counter" aria-live="polite">
          <span>{String(step).padStart(2, "0")}</span><span aria-hidden="true"> / </span><span className="profile-wizard__total">{String(totalSteps).padStart(2, "0")}</span>
        </div>
        <div className="profile-wizard__progress" role="progressbar" aria-label="Прогресс анкеты" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step}>
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      {onLogout && <button type="button" className="profile-wizard__logout" onClick={onLogout}>Выйти</button>}
    </div>

    <div className="profile-wizard__body">
      <div className="profile-wizard__main">
        <div className="profile-wizard__heading">
          <h1>{currentTitle}</h1>
          <p>Заполните профиль, чтобы работодатели могли предложить подходящую работу.</p>
        </div>

        {!ready && <div className="profile-wizard__loading" role="status">Загружаем анкету…</div>}
        {loadingError && <p className="profile-wizard__error" role="alert">Не удалось загрузить анкету: {loadingError}</p>}

        {ready && <form className="profile-wizard__form" onSubmit={submitStep} noValidate>
          <div className="profile-wizard__fields">
            {step === 1 && <div className="profile-form-grid">
              <ProfileTextField label="Имя" name="firstName" value={form.firstName} onChange={(value) => update("firstName", value)} error={errors.firstName} maxLength={100} autoComplete="given-name" required />
              <ProfileTextField label="Фамилия" name="lastName" value={form.lastName} onChange={(value) => update("lastName", value)} error={errors.lastName} maxLength={100} autoComplete="family-name" required />
              <ProfileTextField label="Дата рождения" name="birthDate" value={form.birthDate} onChange={(value) => update("birthDate", value)} type="date" autoComplete="bday" />
              <ProfileSelectField label="Город" name="cityId" value={form.cityId} onChange={(value) => update("cityId", value)} options={cities} optional error={errors.cityId} />
              <AvatarUploader fileId={form.avatarFileId} onChange={(value) => update("avatarFileId", value)} onLoadingChange={setProcessingPhoto} error={errors.avatarFileId} />
            </div>}

            {step === 2 && <div className="profile-step-stack">
              <div className="profile-form-grid">
                <ProfileSelectField label="Специализация" name="professionId" value={form.professionId} onChange={(value) => update("professionId", value)} options={professions} error={errors.professionId} />
                <ProfileSelectField label="Опыт работы" name="experience" value={form.experience} onChange={(value) => update("experience", value)} options={EXPERIENCE as Choice[]} optional />
              </div>
              <SkillPicker items={catalogs.skills} selected={form.skillIds} onChange={(value) => update("skillIds", value)} error={errors.skillIds} />
              <ChoiceField label="Уровень" name="level" value={form.level} options={LEVEL as Choice[]} onChange={(value) => update("level", value)} optional columns={4} />
            </div>}

            {step === 3 && <div className="profile-step-stack">
              <div className="profile-form-grid">
                <ChoiceField label="Тип сотрудничества" name="cooperationType" value={form.cooperationType} options={COOPERATION} onChange={(value) => update("cooperationType", value)} optional columns={4} />
                <ProfileSelectField label="Что вы ищете" name="employmentGoal" value={form.employmentGoal} onChange={(value) => update("employmentGoal", value)} options={GOALS as Choice[]} />
              </div>
              {!isPractice && <div className="profile-form-grid profile-form-grid--salary">
                <ProfileTextField label="Желаемая зарплата от, ₽" name="salaryMinRub" type="number" value={form.salaryMinRub} onChange={(value) => update("salaryMinRub", value)} error={errors.salaryMinRub} min={1} required placeholder="80 000" />
                <ProfileTextField label="Желаемая зарплата до, ₽" name="salaryMaxRub" type="number" value={form.salaryMaxRub} onChange={(value) => update("salaryMaxRub", value)} error={errors.salaryMaxRub} min={1} required placeholder="120 000" />
              </div>}
              <div className="profile-form-grid">
                <ChoiceField label="Формат работы" name="workFormat" value={form.workFormat} options={WORK as Choice[]} onChange={(value) => update("workFormat", value)} optional columns={3} />
                <ChoiceField label="Занятость" name="employmentType" value={form.employmentType} options={EMPLOYMENT as Choice[]} onChange={(value) => update("employmentType", value)} optional columns={2} />
              </div>
              <ChoiceField label="Статус поиска" name="searchStatus" value={form.searchStatus} options={SEARCH_STATUS} onChange={(value) => update("searchStatus", value)} columns={3} />
            </div>}

            {inPracticeStep && <div className="profile-step-stack">
              <div className="profile-form-grid profile-form-grid--practice">
                <ProfileTextField label="Учебное заведение" name="educationalInstitution" value={form.educationalInstitution} onChange={(value) => update("educationalInstitution", value)} error={errors.educationalInstitution} maxLength={200} required placeholder="Например, ЮФУ" />
                <ProfileTextField label="Направление обучения" name="educationProgram" value={form.educationProgram} onChange={(value) => update("educationProgram", value)} error={errors.educationProgram} maxLength={200} required placeholder="Программная инженерия" />
                <ProfileTextField label="Курс" name="studyCourse" type="number" value={form.studyCourse} onChange={(value) => update("studyCourse", value)} error={errors.studyCourse} min={1} max={6} required placeholder="3" />
                <ProfileTextField label="Начало практики" name="practiceStartDate" type="date" value={form.practiceStartDate} onChange={(value) => update("practiceStartDate", value)} error={errors.practiceStartDate} required />
                <ProfileTextField label="Окончание практики" name="practiceEndDate" type="date" value={form.practiceEndDate} onChange={(value) => update("practiceEndDate", value)} error={errors.practiceEndDate} required />
              </div>
              <MultiChoiceField label="Направления практики · до трёх" name="desiredDirections" values={form.desiredDirections} options={DIRECTIONS as Choice[]} onToggle={(value) => {
                update("desiredDirections", form.desiredDirections.includes(value)
                  ? form.desiredDirections.filter((item) => item !== value)
                  : form.desiredDirections.length < 3 ? [...form.desiredDirections, value] : form.desiredDirections);
              }} error={errors.desiredDirections} columns={4} />
              <div className="profile-choice__selected-list" aria-live="polite">
                {form.desiredDirections.map((direction) => <button type="button" key={direction} onClick={() => update("desiredDirections", form.desiredDirections.filter((item) => item !== direction))}>
                  {labelFor(direction, DIRECTIONS as Choice[])} <span aria-hidden="true">×</span>
                </button>)}
              </div>
              <MultiChoiceField label="Формат практики" name="practiceWorkFormats" values={form.practiceWorkFormats} options={WORK as Choice[]} onToggle={(value) => update("practiceWorkFormats", form.practiceWorkFormats.includes(value)
                ? form.practiceWorkFormats.filter((item) => item !== value)
                : [...form.practiceWorkFormats, value])} error={errors.practiceWorkFormats} columns={3} />
              <div className="profile-choice__selected-list" aria-live="polite">
                {form.practiceWorkFormats.map((format) => <button type="button" key={format} onClick={() => update("practiceWorkFormats", form.practiceWorkFormats.filter((item) => item !== format))}>
                  {labelFor(format, WORK as Choice[])} <span aria-hidden="true">×</span>
                </button>)}
              </div>
              {errors.cityId && <p className="profile-field__error" role="alert">{errors.cityId} <button type="button" className="profile-inline-link" onClick={() => { setStep(1); setErrors({}); }}>Указать город</button></p>}
            </div>}

            {inAboutStep && <div className="profile-step-stack profile-about-step">
              <label className="profile-field" htmlFor="specialist-about">
                <span className="profile-field__label">Кратко о себе</span>
                <textarea id="specialist-about" data-profile-field="about" value={form.about} maxLength={500} rows={4} placeholder="Расскажите о своём опыте, ключевых навыках и целях. Например: 3 года в веб-разработке, специализация на React, интересуют продуктовые проекты в финтехе…" onChange={(event) => update("about", event.target.value)} />
                <span className="profile-field__hint">{form.about.length} / 500</span>
              </label>
              <div className="profile-form-grid">
                <ProfileTextField label="Ссылка на портфолио" name="portfolioUrl" type="url" value={form.portfolioUrl} onChange={(value) => update("portfolioUrl", value)} placeholder="https://" />
                <ProfileTextField label="GitHub" name="githubUrl" type="url" value={form.githubUrl} onChange={(value) => update("githubUrl", value)} placeholder="https://github.com/…" />
                <ProfileTextField label="Behance / GitLab" name="behanceGitlabUrl" type="url" value={form.behanceGitlabUrl} onChange={(value) => update("behanceGitlabUrl", value)} placeholder="https://behance.net/…" />
                <ProfileTextField label="Telegram для связи" name="telegram" value={form.telegram} onChange={(value) => update("telegram", value)} maxLength={100} placeholder="@username" />
              </div>
              <div className="profile-resume-note"><span aria-hidden="true">↗</span><div><strong>Резюме PDF</strong><p>Загрузка появится позже</p></div></div>
            </div>}
          </div>

          {message && <p className={messageIsError ? "profile-wizard__message is-error" : "profile-wizard__message"} role={messageIsError ? "alert" : "status"}>{message}</p>}
          <footer className="profile-wizard__actions">
            <button type="button" className="profile-wizard__back" onClick={goBack} disabled={step === 1} aria-disabled={step === 1}>Назад</button>
            <button type="submit" className="profile-wizard__next" disabled={!ready || saving || processingPhoto}>
              {saving ? "Сохраняем…" : step === totalSteps ? "Завершить" : "Далее"}
              {!saving && <span aria-hidden="true">{step === totalSteps ? "✓" : "→"}</span>}
            </button>
          </footer>
        </form>}
      </div>

      <aside className={step === 1 ? "profile-preview profile-preview--intro" : "profile-preview"} aria-label="Предварительный просмотр анкеты">
        <div className="profile-preview__identity">
          <div className="profile-preview__avatar">
            {form.avatarFileId
              ? <Image src={`/api/v1/media/${form.avatarFileId}?size=256`} width={256} height={256} unoptimized alt="" />
              : <span aria-hidden="true">{form.firstName ? form.firstName.slice(0, 1).toUpperCase() : "○"}</span>}
          </div>
          <div className="profile-preview__name-block">
            <h2>{[form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ") || "Ваше имя и фамилия"}</h2>
          </div>
          {(age !== null || cityName) && <p className="profile-preview__meta">{age !== null ? `${age} ${age === 1 ? "год" : age >= 2 && age <= 4 ? "года" : "лет"}` : ""}{age !== null && cityName ? " · " : ""}{cityName}</p>}
        </div>

        <div className="profile-preview__details">
          {step === 2 && <>
            {professionName && <PreviewRow label="Специализация" value={professionName} />}
            {experienceName && <PreviewRow label="Опыт" value={experienceName} />}
            {levelName && <PreviewRow label="Уровень" value={levelName} />}
            {selectedSkillItems.length > 0 && <div className="profile-preview__row">
              <span>Навыки</span>
              <div className="profile-preview__chips">{selectedSkillItems.slice(0, 4).map((item) => <span key={item.id}>{item.name}</span>)}{selectedSkillItems.length > 4 && <span>+{selectedSkillItems.length - 4}</span>}</div>
            </div>}
          </>}
          {step === 3 && <>
            {labelFor(form.cooperationType, COOPERATION) && <PreviewRow label="Сотрудничество" value={labelFor(form.cooperationType, COOPERATION)} />}
            {labelFor(form.employmentGoal, GOALS as Choice[]) && <PreviewRow label="Цель" value={labelFor(form.employmentGoal, GOALS as Choice[])} />}
            {form.salaryMinRub && form.salaryMaxRub && !isPractice && <PreviewRow label="Желаемая зарплата" value={`${formatSalary(form.salaryMinRub)} – ${formatSalary(form.salaryMaxRub)}`} />}
            {labelFor(form.workFormat, WORK as Choice[]) && <PreviewRow label="Формат работы" value={labelFor(form.workFormat, WORK as Choice[])} />}
            {labelFor(form.employmentType, EMPLOYMENT as Choice[]) && <PreviewRow label="Занятость" value={labelFor(form.employmentType, EMPLOYMENT as Choice[])} />}
            {labelFor(form.searchStatus, SEARCH_STATUS) && <PreviewRow label="Статус" value={labelFor(form.searchStatus, SEARCH_STATUS)} />}
          </>}
          {inPracticeStep && <>
            {form.educationalInstitution && <PreviewRow label="Учебное заведение" value={form.educationalInstitution} />}
            {form.educationProgram && <PreviewRow label="Программа" value={form.educationProgram} />}
            {form.studyCourse && <PreviewRow label="Курс" value={`${form.studyCourse} курс`} />}
            {form.practiceStartDate && <PreviewRow label="Практика" value={`${form.practiceStartDate}${form.practiceEndDate ? ` — ${form.practiceEndDate}` : ""}`} />}
            {form.desiredDirections.length > 0 && <PreviewRow label="Направления" value={form.desiredDirections.map((direction) => labelFor(direction, DIRECTIONS as Choice[])).join(", ")} />}
            {form.practiceWorkFormats.length > 0 && <PreviewRow label="Формат практики" value={form.practiceWorkFormats.map((format) => labelFor(format, WORK as Choice[])).join(", ")} />}
          </>}
          {inAboutStep && <>
            {aboutPreview.text && <div className="profile-preview__row"><span>О себе</span><p>{aboutPreview.text}{aboutPreview.hidden > 0 && <small>ещё {aboutPreview.hidden} символов</small>}</p></div>}
            {form.portfolioUrl && <PreviewRow label="Портфолио" value={form.portfolioUrl} />}
            {form.githubUrl && <PreviewRow label="GitHub" value={form.githubUrl} />}
            {form.behanceGitlabUrl && <PreviewRow label="Behance / GitLab" value={form.behanceGitlabUrl} />}
            {form.telegram && <PreviewRow label="Telegram" value={form.telegram} />}
          </>}
          {step === 1 && !form.firstName && !form.lastName && !form.birthDate && !cityName && !form.avatarFileId && <p className="profile-preview__empty">Добавьте данные — они появятся здесь сразу.</p>}
          {step === 2 && !professionName && !experienceName && !levelName && selectedSkillItems.length === 0 && <p className="profile-preview__empty">Пока нет заполненных данных этого шага.</p>}
          {step === 3 && !form.salaryMinRub && !form.salaryMaxRub && !form.workFormat && !form.employmentType && form.cooperationType === "" && <p className="profile-preview__empty">Выберите параметры работы.</p>}
          {inPracticeStep && !form.educationalInstitution && !form.educationProgram && !form.practiceStartDate && form.desiredDirections.length === 0 && <p className="profile-preview__empty">Добавьте данные об обучении и практике.</p>}
          {inAboutStep && !form.about && !form.portfolioUrl && !form.githubUrl && !form.behanceGitlabUrl && !form.telegram && <p className="profile-preview__empty">Добавьте описание или ссылки на свои работы.</p>}
        </div>
      </aside>
    </div>
  </section>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  const preview = compactText(value, 58);
  return <div className="profile-preview__row"><span>{label}</span><p>{preview.text}{preview.hidden > 0 && <small>ещё {preview.hidden} символов</small>}</p></div>;
}
