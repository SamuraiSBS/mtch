"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Camera, Check, FileText, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, send } from "./api";
import { UiIcon } from "./ui-icon";
import { EMPLOYMENT, EXPERIENCE, LEVEL, WORK } from "./fields";
import type { Catalogs, Item } from "./workspace";
import { DIRECTIONS, GOALS } from "./practice-options";

type SpecialistDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  age: string;
  cityId: string;
  cityName: string;
  avatarFileId: string;
  professionId: string;
  experience: string;
  level: string;
  cooperationType: string;
  skillIds: string[];
  customSkills: string[];
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
  resumeFileId: string;
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
  age: "",
  cityId: "",
  cityName: "",
  avatarFileId: "",
  professionId: "",
  experience: "",
  level: "",
  cooperationType: "",
  skillIds: [],
  customSkills: [],
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
  resumeFileId: "",
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

const PROFILE_DRAFT_VERSION = 2;

function asString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function normalizeCatalogName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU");
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
    age: asString(source.age) || (asString(source.birthDate) ? String(calculateAge(asString(source.birthDate)) ?? "") : ""),
    cityId: asString(source.cityId),
    cityName: asString(source.cityName) || asString(source.city),
    avatarFileId: asString(source.avatarFileId),
    professionId: asString(source.professionId),
    experience: asString(source.experience),
    level: asString(source.level),
    cooperationType: asString(source.cooperationType),
    skillIds: skills.map(asString).filter(Boolean),
    customSkills: Array.isArray(source.customSkills) ? source.customSkills.map(asString).map((name) => name.trim()).filter(Boolean) : [],
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
    resumeFileId: asString(source.resumeFileId),
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

function formatAge(age: number): string {
  const mod100 = age % 100;
  const mod10 = age % 10;
  const suffix = mod100 >= 11 && mod100 <= 14 ? "лет" : mod10 === 1 ? "год" : mod10 >= 2 && mod10 <= 4 ? "года" : "лет";
  return `${age} ${suffix}`;
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

function CityAutocomplete({
  items,
  value,
  customValue,
  onChange,
  error,
}: {
  items: Item[];
  value: string;
  customValue: string;
  onChange: (id: string, name: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((item) => item.id === value);
  const query = selected?.name ?? customValue;
  const normalizedQuery = normalizeCatalogName(query);
  const filteredItems = items
    .filter((item) => !normalizedQuery || normalizeCatalogName(item.name).includes(normalizedQuery))
    .slice(0, 8);
  const exactMatch = normalizedQuery ? items.some((item) => normalizeCatalogName(item.name) === normalizedQuery) : false;
  const inputId = "specialist-cityId";

  function chooseCustom() {
    const name = query.trim();
    if (!name) return;
    onChange("", name);
    setOpen(false);
  }

  return <div className="profile-field profile-city-field">
    <label className="profile-field__label" htmlFor={inputId}>Город</label>
    <div className="profile-city-picker">
      <input
        id={inputId}
        data-profile-field="cityId"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="specialist-city-options"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "specialist-cityId-error" : undefined}
        autoComplete="address-level2"
        value={query}
        placeholder="Начните вводить город"
        maxLength={120}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange("", event.target.value);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && query.trim()) {
            event.preventDefault();
            const match = items.find((item) => normalizeCatalogName(item.name) === normalizedQuery);
            if (match) {
              onChange(match.id, "");
              setOpen(false);
            } else chooseCustom();
          }
        }}
      />
      {open && <div className="profile-city-picker__results" id="specialist-city-options" role="listbox" aria-label="Города">
        {filteredItems.map((item) => <button
          type="button"
          role="option"
          aria-selected={item.id === value}
          key={item.id}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { onChange(item.id, ""); setOpen(false); }}
        >{item.name}</button>)}
        {query.trim() && !exactMatch && <button
          type="button"
          className="profile-city-picker__custom"
          role="option"
          aria-selected={!value}
          onMouseDown={(event) => event.preventDefault()}
          onClick={chooseCustom}
        >Добавить «{query.trim()}»</button>}
        {!query.trim() && filteredItems.length === 0 && <span>Города не найдены</span>}
      </div>}
    </div>
    {error && <span id="specialist-cityId-error" className="profile-field__error" role="alert">{error}</span>}
  </div>;
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
  customSkills,
  onChange,
  onCustomSkillsChange,
  error,
}: {
  items: Item[];
  selected: string[];
  customSkills: string[];
  onChange: (value: string[]) => void;
  onCustomSkillsChange: (value: string[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const selectedItems = items.filter((item) => selected.includes(item.id));
  const visibleSkills = [
    ...selectedItems.map((item) => ({ key: item.id, name: item.name, remove: () => toggle(item.id) })),
    ...customSkills.map((name, index) => ({ key: `custom-${index}-${name}`, name, remove: () => onCustomSkillsChange(customSkills.filter((_, skillIndex) => skillIndex !== index)) })),
  ];
  const normalizedQuery = normalizeCatalogName(query);
  const filteredItems = items
    .filter((item) => !selected.includes(item.id) && normalizeCatalogName(item.name).includes(normalizedQuery))
    .slice(0, 8);
  const exactMatch = normalizedQuery ? items.find((item) => normalizeCatalogName(item.name) === normalizedQuery) : undefined;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((selectedId) => selectedId !== id) : [...selected, id]);
  }

  function addCustomSkill() {
    const name = query.trim();
    if (!name || name.length > 80) return;
    const normalized = normalizeCatalogName(name);
    const alreadyAdded = visibleSkills.some((skill) => normalizeCatalogName(skill.name) === normalized);
    if (!alreadyAdded && !items.some((item) => normalizeCatalogName(item.name) === normalized)) onCustomSkillsChange([...customSkills, name]);
    setQuery("");
  }

  function acceptQuery() {
    if (!query.trim()) return;
    if (exactMatch && !selected.includes(exactMatch.id)) toggle(exactMatch.id);
    else if (!exactMatch) addCustomSkill();
    setQuery("");
  }

  return <fieldset className="profile-field profile-skills" data-profile-field="skillIds" tabIndex={-1}>
      <legend className="profile-field__label">Навыки <span className="profile-field__optional">минимум один</span></legend>
      <div className="profile-skills__box" aria-describedby={error ? "specialist-skillIds-error" : undefined}>
        <div className="profile-skills__selected" aria-live="polite">
        {visibleSkills.slice(0, 5).map((skill) => <span className="profile-skill-chip" key={skill.key}>
          {skill.name}
          <button type="button" aria-label={`Убрать навык ${skill.name}`} onClick={skill.remove}><UiIcon icon={X} size={12} /></button>
        </span>)}
        {visibleSkills.length > 5 && <span className="profile-skill-more">+{visibleSkills.length - 5}</span>}
        <input
          type="search"
          value={query}
          aria-label="Найти навык"
          placeholder={visibleSkills.length ? "Добавить навык…" : "Найти или вписать навык…"}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => setQuery("")}
          maxLength={80}
          onKeyDown={(event) => {
            if (event.key === "Enter" && query.trim()) {
              event.preventDefault();
              acceptQuery();
            }
            if (event.key === "Escape") setQuery("");
          }}
        />
      </div>
      {query && <div className="profile-skills__results" role="listbox" aria-label="Результаты поиска навыков">
        {filteredItems.map((item) => <button type="button" role="option" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { toggle(item.id); setQuery(""); }}>{item.name}</button>)}
        {!exactMatch && normalizedQuery && <button type="button" className="profile-skills__custom" role="option" onMouseDown={(event) => event.preventDefault()} onClick={addCustomSkill}>Добавить свой навык «{query.trim()}»</button>}
        {filteredItems.length === 0 && exactMatch && <span>Этот навык уже добавлен</span>}
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
        : <UiIcon icon={Camera} size={32} className="profile-photo-upload__icon" />}
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

function ResumeUploader({
  fileId,
  onChange,
  onLoadingChange,
}: {
  fileId: string;
  onChange: (value: string) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputId = "specialist-resume-upload";

  async function upload(file: File) {
    setLoading(true);
    onLoadingChange(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("kind", "RESUME");
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

  return <div className="profile-resume-upload">
    <span className="profile-field__label">Резюме PDF <span className="profile-field__optional">необязательно</span></span>
    {fileId
      ? <div className="profile-resume-upload__file">
        <UiIcon icon={FileText} size={18} className="profile-resume-note__icon" />
        <strong>Резюме прикреплено</strong>
        <a href={`/api/v1/media/${fileId}`} download>Скачать</a>
        <button type="button" onClick={() => onChange("")} aria-label="Убрать резюме"><UiIcon icon={X} size={14} /></button>
      </div>
      : <label className="profile-resume-upload__action" htmlFor={inputId}>
        <UiIcon icon={FileText} size={18} />
        <span>{loading ? "Загружаем PDF…" : "Прикрепить файл"}</span>
        <input
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          disabled={loading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>}
    <span className="profile-field__hint">PDF до 10 МБ</span>
    {uploadError && <span className="profile-field__error" role="alert">{uploadError}</span>}
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
  const [processingResume, setProcessingResume] = useState(false);
  const isPractice = form.employmentGoal === "PRACTICE";
  const totalSteps = 5;
  const draftKey = `mtch:specialist-profile-draft:${userId}`;
  const cities = catalogs.cities;
  const professions = catalogs.professions;
  const selectedSkillItems = useMemo(() => catalogs.skills.filter((item) => form.skillIds.includes(item.id)), [catalogs.skills, form.skillIds]);
  const selectedSkillNames = useMemo(() => [...selectedSkillItems.map((item) => item.name), ...form.customSkills], [selectedSkillItems, form.customSkills]);
  const currentTitle = ["", "Основная информация", "Профессия и опыт", "О себе и ссылки", "Условия работы", "Проверьте профиль"][step];

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
          if ((parsed.version === 1 || parsed.version === PROFILE_DRAFT_VERSION) && parsed.form) {
            savedValues = normalizeDraft(parsed.form);
            savedStep = Number.isInteger(parsed.step) ? Number(parsed.step) : 1;
            if (parsed.version === 1) {
              if (savedStep === 3) savedStep = 4;
              else if (savedStep === 4 && savedValues.employmentGoal !== "PRACTICE") savedStep = 3;
              else if (savedStep === 5) savedStep = 3;
            }
          }
        }
      } catch {
        // An unavailable or malformed browser draft should not prevent profile editing.
      }

      if (!active) return;
      const nextForm = savedValues ? { ...serverProfile, ...savedValues } : serverProfile;
      const maxStep = 5;
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
      const age = Number(form.age);
      if (!Number.isInteger(age) || age < 1 || age > 120) next.age = "Укажите возраст от 1 до 120 лет";
      if (!form.cityId && !form.cityName.trim()) next.cityId = "Выберите город из списка или введите свой";
      if (!form.avatarFileId) next.avatarFileId = "Загрузите фото профиля";
    } else if (stepToValidate === 2) {
      if (!form.professionId) next.professionId = "Выберите специализацию";
      if (!form.experience) next.experience = "Выберите опыт работы";
      if (form.skillIds.length + form.customSkills.length === 0) next.skillIds = "Добавьте хотя бы один навык";
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
      if (form.practiceWorkFormats.some((format) => format !== "REMOTE") && !form.cityId && !form.cityName.trim()) next.cityId = "Для офиса или гибрида укажите город на первом шаге";
    }
    if (stepToValidate === 2) {
      if (!form.level) next.level = "Выберите уровень";
      if (!form.cooperationType) next.cooperationType = "Выберите тип сотрудничества";
    }
    if (stepToValidate === 3) {
      for (const [key, value] of [["portfolioUrl", form.portfolioUrl], ["githubUrl", form.githubUrl], ["behanceGitlabUrl", form.behanceGitlabUrl]] as const) {
        if (value && !URL.canParse(value)) next[key] = "Укажите ссылку целиком, например https://example.com";
      }
    }
    if (stepToValidate === 4) {
      if (!form.employmentGoal) next.employmentGoal = "Выберите цель поиска";
      if (!isPractice) {
        const min = Number(form.salaryMinRub);
        const max = Number(form.salaryMaxRub);
        if (!Number.isInteger(min) || min <= 0) next.salaryMinRub = "Укажите минимальную зарплату";
        if (!Number.isInteger(max) || max <= 0) next.salaryMaxRub = "Укажите максимальную зарплату";
        if (Number.isInteger(min) && Number.isInteger(max) && min > 0 && max > 0 && max < min) next.salaryMaxRub = "Максимум должен быть не ниже минимума";
      }
      if (!form.workFormat) next.workFormat = "Выберите формат работы";
      if (!form.employmentType) next.employmentType = "Выберите занятость";
      if (!form.searchStatus) next.searchStatus = "Выберите статус";
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
    const firstInvalidStep = Array.from({ length: totalSteps - 1 }, (_, index) => index + 1).find((candidateStep) => Object.keys(validateStep(candidateStep)).length > 0);
    const nextErrors = firstInvalidStep ? validateStep(firstInvalidStep) : {};
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(firstInvalidStep ?? step);
      focusFirstError(nextErrors);
      return;
    }
    if (processingPhoto || processingResume) return;
    setSaving(true);
    setMessage("");
    setMessageIsError(false);
    const practice = form.employmentGoal === "PRACTICE";
    const payload = {
      ...form,
      birthDate: null,
      age: form.age ? Number(form.age) : null,
      cityId: form.cityId || null,
      cityName: form.cityName.trim() || null,
      experience: form.experience || null,
      level: form.level || null,
      cooperationType: form.cooperationType || null,
      skillIds: form.skillIds,
      customSkills: form.customSkills,
      about: form.about || null,
      resumeFileId: form.resumeFileId || null,
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

  const cityName = labelFor(form.cityId, cities) || form.cityName;
  const professionName = labelFor(form.professionId, professions);
  const experienceName = labelFor(form.experience, EXPERIENCE as Choice[]);
  const levelName = labelFor(form.level, LEVEL as Choice[]);
  const age = form.age && Number.isInteger(Number(form.age)) ? Number(form.age) : null;
  const aboutPreview = compactText(form.about, 124);
  const progressPercent = Math.round((step / totalSteps) * 100);
  const inPracticeStep = isPractice && step === 4;
  const inAboutStep = step === 3;
  const isReviewStep = step === 5;
  const isProcessingFile = processingPhoto || processingResume;

  return <section className="profile-wizard" aria-label="Анкета специалиста">
    <div className="profile-wizard__body">
      <div className="profile-wizard__main">
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
              <ProfileTextField label="Возраст" name="age" type="number" value={form.age} onChange={(value) => update("age", value)} error={errors.age} min={1} max={120} required placeholder="21" />
              <CityAutocomplete items={cities} value={form.cityId} customValue={form.cityName} onChange={(id, name) => { update("cityId", id); update("cityName", name); }} error={errors.cityId} />
              <AvatarUploader fileId={form.avatarFileId} onChange={(value) => update("avatarFileId", value)} onLoadingChange={setProcessingPhoto} error={errors.avatarFileId} />
            </div>}

            {step === 2 && <div className="profile-step-stack">
              <div className="profile-form-grid">
                <ProfileSelectField label="Специализация" name="professionId" value={form.professionId} onChange={(value) => update("professionId", value)} options={professions} error={errors.professionId} />
                <ProfileSelectField label="Опыт работы" name="experience" value={form.experience} onChange={(value) => update("experience", value)} options={EXPERIENCE as Choice[]} error={errors.experience} />
              </div>
              <SkillPicker items={catalogs.skills} selected={form.skillIds} customSkills={form.customSkills} onChange={(value) => update("skillIds", value)} onCustomSkillsChange={(value) => update("customSkills", value)} error={errors.skillIds} />
              <ChoiceField label="Уровень" name="level" value={form.level} options={LEVEL as Choice[]} onChange={(value) => update("level", value)} error={errors.level} columns={4} />
              <ChoiceField label="Желаемый тип занятости" name="cooperationType" value={form.cooperationType} options={COOPERATION} onChange={(value) => update("cooperationType", value)} error={errors.cooperationType} columns={4} />
            </div>}

            {inAboutStep && <div className="profile-step-stack profile-about-step">
              <label className="profile-field" htmlFor="specialist-about">
                <span className="profile-field__label">Кратко о себе</span>
                <textarea id="specialist-about" data-profile-field="about" value={form.about} maxLength={500} rows={4} placeholder="Расскажите о своём опыте, ключевых навыках и целях. Например: 3 года в веб-разработке, специализация на React, интересуют продуктовые проекты в финтехе…" onChange={(event) => update("about", event.target.value)} />
                <span className="profile-field__hint">{form.about.length} / 500</span>
              </label>
              <div className="profile-form-grid">
                <ProfileTextField label="Ссылка на портфолио" name="portfolioUrl" type="url" value={form.portfolioUrl} onChange={(value) => update("portfolioUrl", value)} error={errors.portfolioUrl} placeholder="https://" />
                <ProfileTextField label="GitHub" name="githubUrl" type="url" value={form.githubUrl} onChange={(value) => update("githubUrl", value)} error={errors.githubUrl} placeholder="https://github.com/…" />
                <ProfileTextField label="Behance / GitLab" name="behanceGitlabUrl" type="url" value={form.behanceGitlabUrl} onChange={(value) => update("behanceGitlabUrl", value)} error={errors.behanceGitlabUrl} placeholder="https://behance.net/…" />
                <ProfileTextField label="Telegram для связи" name="telegram" value={form.telegram} onChange={(value) => update("telegram", value)} maxLength={100} placeholder="@username" />
              </div>
              <ResumeUploader fileId={form.resumeFileId} onChange={(value) => update("resumeFileId", value)} onLoadingChange={setProcessingResume} />
            </div>}

            {step === 4 && <div className="profile-step-stack">
              <ProfileSelectField label="Цель поиска" name="employmentGoal" value={form.employmentGoal} onChange={(value) => update("employmentGoal", value)} options={GOALS as Choice[]} error={errors.employmentGoal} />
              {!isPractice && <div className="profile-form-grid profile-form-grid--salary">
                <ProfileTextField label="Желаемая зарплата от, ₽" name="salaryMinRub" type="number" value={form.salaryMinRub} onChange={(value) => update("salaryMinRub", value)} error={errors.salaryMinRub} min={1} required placeholder="80 000" />
                <ProfileTextField label="Желаемая зарплата до, ₽" name="salaryMaxRub" type="number" value={form.salaryMaxRub} onChange={(value) => update("salaryMaxRub", value)} error={errors.salaryMaxRub} min={1} required placeholder="120 000" />
              </div>}
              <div className="profile-form-grid">
                <ChoiceField label="Формат работы" name="workFormat" value={form.workFormat} options={WORK as Choice[]} onChange={(value) => update("workFormat", value)} error={errors.workFormat} columns={3} />
                <ChoiceField label="Занятость" name="employmentType" value={form.employmentType} options={EMPLOYMENT as Choice[]} onChange={(value) => update("employmentType", value)} error={errors.employmentType} columns={2} />
              </div>
              <ChoiceField label="Статус" name="searchStatus" value={form.searchStatus} options={SEARCH_STATUS} onChange={(value) => update("searchStatus", value)} error={errors.searchStatus} columns={3} />

              {inPracticeStep && <div className="profile-practice-extra">
                <h2>Данные для практики</h2>
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
                  {labelFor(direction, DIRECTIONS as Choice[])} <UiIcon icon={X} size={12} />
                </button>)}
              </div>
              <MultiChoiceField label="Формат практики" name="practiceWorkFormats" values={form.practiceWorkFormats} options={WORK as Choice[]} onToggle={(value) => update("practiceWorkFormats", form.practiceWorkFormats.includes(value)
                ? form.practiceWorkFormats.filter((item) => item !== value)
                : [...form.practiceWorkFormats, value])} error={errors.practiceWorkFormats} columns={3} />
              <div className="profile-choice__selected-list" aria-live="polite">
                {form.practiceWorkFormats.map((format) => <button type="button" key={format} onClick={() => update("practiceWorkFormats", form.practiceWorkFormats.filter((item) => item !== format))}>
                  {labelFor(format, WORK as Choice[])} <UiIcon icon={X} size={12} />
                </button>)}
              </div>
              {errors.cityId && <p className="profile-field__error" role="alert">{errors.cityId} <button type="button" className="profile-inline-link" onClick={() => { setStep(1); setErrors({}); }}>Указать город</button></p>}
              </div>}
            </div>}

            {isReviewStep && <div className="profile-confirm">
              <div className="profile-confirm__intro">
                <span className="profile-confirm__check"><UiIcon icon={Check} size={20} /></span>
                <div><h2>Почти готово</h2><p>Проверьте анкету. После публикации её смогут увидеть работодатели.</p></div>
              </div>
              <section className="profile-confirm__section">
                <header><h2>Основная информация</h2><button type="button" onClick={() => { setErrors({}); setStep(1); }}>Изменить</button></header>
                <div className="profile-confirm__rows">
                  <PreviewRow label="Имя и фамилия" value={[form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ")} />
                  {age !== null && <PreviewRow label="Возраст" value={formatAge(age)} />}
                  {cityName && <PreviewRow label="Город" value={cityName} />}
                  <PreviewRow label="Аватар" value={form.avatarFileId ? "Фото добавлено" : "Не добавлено"} />
                </div>
              </section>
              <section className="profile-confirm__section">
                <header><h2>Профессия и опыт</h2><button type="button" onClick={() => { setErrors({}); setStep(2); }}>Изменить</button></header>
                <div className="profile-confirm__rows">
                  {professionName && <PreviewRow label="Специализация" value={professionName} />}
                  {experienceName && <PreviewRow label="Опыт" value={experienceName} />}
                  {levelName && <PreviewRow label="Уровень" value={levelName} />}
                  {labelFor(form.cooperationType, COOPERATION) && <PreviewRow label="Тип занятости" value={labelFor(form.cooperationType, COOPERATION)} />}
                  {selectedSkillNames.length > 0 && <PreviewRow label="Навыки" value={selectedSkillNames.join(", ")} />}
                </div>
              </section>
              <section className="profile-confirm__section">
                <header><h2>О себе и ссылки</h2><button type="button" onClick={() => { setErrors({}); setStep(3); }}>Изменить</button></header>
                <div className="profile-confirm__rows">
                  {form.about && <PreviewRow label="О себе" value={form.about} />}
                  {form.portfolioUrl && <PreviewRow label="Портфолио" value={form.portfolioUrl} />}
                  {form.githubUrl && <PreviewRow label="GitHub" value={form.githubUrl} />}
                  {form.behanceGitlabUrl && <PreviewRow label="Behance / GitLab" value={form.behanceGitlabUrl} />}
                  {form.telegram && <PreviewRow label="Telegram" value={form.telegram} />}
                  {form.resumeFileId && <PreviewRow label="Резюме" value="PDF прикреплён" />}
                </div>
              </section>
              <section className="profile-confirm__section">
                <header><h2>Условия работы</h2><button type="button" onClick={() => { setErrors({}); setStep(4); }}>Изменить</button></header>
                <div className="profile-confirm__rows">
                  {!isPractice && <PreviewRow label="Желаемая зарплата" value={`${formatSalary(form.salaryMinRub)} – ${formatSalary(form.salaryMaxRub)}`} />}
                  {labelFor(form.workFormat, WORK as Choice[]) && <PreviewRow label="Формат работы" value={labelFor(form.workFormat, WORK as Choice[])} />}
                  {labelFor(form.employmentType, EMPLOYMENT as Choice[]) && <PreviewRow label="Занятость" value={labelFor(form.employmentType, EMPLOYMENT as Choice[])} />}
                  {labelFor(form.searchStatus, SEARCH_STATUS) && <PreviewRow label="Статус" value={labelFor(form.searchStatus, SEARCH_STATUS)} />}
                  {labelFor(form.employmentGoal, GOALS as Choice[]) && <PreviewRow label="Цель поиска" value={labelFor(form.employmentGoal, GOALS as Choice[])} />}
                  {isPractice && form.educationalInstitution && <PreviewRow label="Учебное заведение" value={form.educationalInstitution} />}
                  {isPractice && form.educationProgram && <PreviewRow label="Программа" value={form.educationProgram} />}
                  {isPractice && form.studyCourse && <PreviewRow label="Курс" value={`${form.studyCourse} курс`} />}
                </div>
              </section>
              <p className="profile-confirm__privacy">Резюме прикреплено к профилю. Проверьте остальные данные перед публикацией.</p>
            </div>}
          </div>

          {message && <p className={messageIsError ? "profile-wizard__message is-error" : "profile-wizard__message"} role={messageIsError ? "alert" : "status"}>{message}</p>}
          <footer className="profile-wizard__actions">
            <button type="button" className="profile-wizard__back" onClick={goBack} disabled={step === 1} aria-disabled={step === 1}><UiIcon icon={ArrowLeft} size={14} />Назад</button>
            <button type="submit" className="profile-wizard__next" disabled={!ready || saving || isProcessingFile}>
              {saving ? "Сохраняем…" : step === totalSteps ? "Опубликовать профиль" : "Далее"}
              {!saving && <UiIcon icon={step === totalSteps ? Check : ArrowRight} size={16} className="profile-wizard__next-icon" />}
            </button>
          </footer>
        </form>}
      </div>

      <aside className={step === 1 ? "profile-preview profile-preview--intro" : "profile-preview"} aria-label="Предварительный просмотр анкеты">
        <div className="profile-preview__identity">
          <div className="profile-preview__avatar">
            {form.avatarFileId
              ? <Image src={`/api/v1/media/${form.avatarFileId}?size=256`} width={256} height={256} unoptimized alt="" />
              : form.firstName
                ? <span aria-hidden="true">{form.firstName.slice(0, 1).toUpperCase()}</span>
                : <UiIcon icon={UserRound} size={28} />}
          </div>
          <div className="profile-preview__name-block">
            <h2>{[form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ") || "Ваше имя и фамилия"}</h2>
          </div>
          {(age !== null || cityName) && <p className="profile-preview__meta">{age !== null ? formatAge(age) : ""}{age !== null && cityName ? " · " : ""}{cityName}</p>}
        </div>

        <div className="profile-preview__details">
          {(step === 2 || isReviewStep) && <>
            {professionName && <PreviewRow label="Специализация" value={professionName} />}
            {experienceName && <PreviewRow label="Опыт" value={experienceName} />}
            {levelName && <PreviewRow label="Уровень" value={levelName} />}
            {labelFor(form.cooperationType, COOPERATION) && <PreviewRow label="Тип занятости" value={labelFor(form.cooperationType, COOPERATION)} />}
            {selectedSkillNames.length > 0 && <div className="profile-preview__row">
              <span>Навыки</span>
              <div className="profile-preview__chips">{selectedSkillNames.slice(0, 4).map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}{selectedSkillNames.length > 4 && <span>+{selectedSkillNames.length - 4}</span>}</div>
            </div>}
          </>}
          {(step === 4 || isReviewStep) && <>
            {labelFor(form.employmentGoal, GOALS as Choice[]) && <PreviewRow label="Цель" value={labelFor(form.employmentGoal, GOALS as Choice[])} />}
            {form.salaryMinRub && form.salaryMaxRub && !isPractice && <PreviewRow label="Желаемая зарплата" value={`${formatSalary(form.salaryMinRub)} – ${formatSalary(form.salaryMaxRub)}`} />}
            {labelFor(form.workFormat, WORK as Choice[]) && <PreviewRow label="Формат работы" value={labelFor(form.workFormat, WORK as Choice[])} />}
            {labelFor(form.employmentType, EMPLOYMENT as Choice[]) && <PreviewRow label="Занятость" value={labelFor(form.employmentType, EMPLOYMENT as Choice[])} />}
            {labelFor(form.searchStatus, SEARCH_STATUS) && <PreviewRow label="Статус" value={labelFor(form.searchStatus, SEARCH_STATUS)} />}
            {inPracticeStep || isReviewStep && isPractice ? <>
            {form.educationalInstitution && <PreviewRow label="Учебное заведение" value={form.educationalInstitution} />}
            {form.educationProgram && <PreviewRow label="Программа" value={form.educationProgram} />}
            {form.studyCourse && <PreviewRow label="Курс" value={`${form.studyCourse} курс`} />}
            {form.practiceStartDate && <PreviewRow label="Практика" value={`${form.practiceStartDate}${form.practiceEndDate ? ` — ${form.practiceEndDate}` : ""}`} />}
            {form.desiredDirections.length > 0 && <PreviewRow label="Направления" value={form.desiredDirections.map((direction) => labelFor(direction, DIRECTIONS as Choice[])).join(", ")} />}
            {form.practiceWorkFormats.length > 0 && <PreviewRow label="Формат практики" value={form.practiceWorkFormats.map((format) => labelFor(format, WORK as Choice[])).join(", ")} />}
            </> : null}
          </>}
          {(step === 3 || isReviewStep) && <>
            {aboutPreview.text && <div className="profile-preview__row"><span>О себе</span><p>{aboutPreview.text}{aboutPreview.hidden > 0 && <small>ещё {aboutPreview.hidden} символов</small>}</p></div>}
            {form.portfolioUrl && <PreviewRow label="Портфолио" value={form.portfolioUrl} />}
            {form.githubUrl && <PreviewRow label="GitHub" value={form.githubUrl} />}
            {form.behanceGitlabUrl && <PreviewRow label="Behance / GitLab" value={form.behanceGitlabUrl} />}
            {form.telegram && <PreviewRow label="Telegram" value={form.telegram} />}
            {form.resumeFileId && <PreviewRow label="Резюме" value="PDF прикреплён" />}
          </>}
          {step === 1 && !form.firstName && !form.lastName && !age && !cityName && !form.avatarFileId && <p className="profile-preview__empty">Добавьте данные — они появятся здесь сразу.</p>}
          {step === 2 && !professionName && !experienceName && !levelName && selectedSkillNames.length === 0 && <p className="profile-preview__empty">Пока нет заполненных данных этого шага.</p>}
          {step === 3 && !form.about && !form.portfolioUrl && !form.githubUrl && !form.behanceGitlabUrl && !form.telegram && !form.resumeFileId && <p className="profile-preview__empty">Добавьте описание или ссылки на свои работы.</p>}
          {step === 4 && !form.salaryMinRub && !form.salaryMaxRub && !form.workFormat && !form.employmentType && <p className="profile-preview__empty">Выберите условия работы.</p>}
        </div>
      </aside>
    </div>
  </section>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  const preview = compactText(value, 58);
  return <div className="profile-preview__row"><span>{label}</span><p>{preview.text}{preview.hidden > 0 && <small>ещё {preview.hidden} символов</small>}</p></div>;
}
