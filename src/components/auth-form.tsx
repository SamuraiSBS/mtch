"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { api } from "./api";

type AuthFormProps = {
  mode: "login" | "register";
  initialRole?: "SPECIALIST" | "EMPLOYER";
};

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg>;
}

function SpecialistIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2Z" /></svg>;
}

function EmployerIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-11 0v2h4v-2" /></svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{hidden && <path d="m4 4 16 16" />}</svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

export function AuthForm({ mode, initialRole = "SPECIALIST" }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const isLogin = mode === "login";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(isLogin
          ? { email, password }
          : { email, password, passwordConfirmation: confirmation, role }),
      });
      window.location.href = "/app";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <div className="auth-page__mascot" aria-hidden="true">
        <Image
          src="/login-fox.png"
          fill
          sizes="(max-width: 760px) 90vw, 52vw"
          alt=""
          priority
          style={{ objectFit: "contain", objectPosition: "bottom" }}
        />
      </div>
      <div className="auth-page__content">
        <div className="auth-panel">
          <h1 id="auth-title">{isLogin ? "Вход" : "Регистрация"}</h1>
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <MailIcon />
              <input
                aria-label="Почта"
                type="email"
                autoComplete="email"
                placeholder="Почта"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </div>
            <div className="auth-field">
              <LockIcon />
              <input
                aria-label="Пароль"
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder="Пароль"
                required
                minLength={8}
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
              <button
                className="auth-field__toggle"
                type="button"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(value => !value)}
              >
                <EyeIcon hidden={!showPassword} />
              </button>
            </div>
            {!isLogin && (
              <>
                <div className="auth-field">
                  <LockIcon />
                  <input
                    aria-label="Повторите пароль"
                    type={showConfirmation ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Повторите пароль"
                    required
                    value={confirmation}
                    onChange={event => setConfirmation(event.target.value)}
                  />
                  <button
                    className="auth-field__toggle"
                    type="button"
                    aria-label={showConfirmation ? "Скрыть пароль" : "Показать пароль"}
                    aria-pressed={showConfirmation}
                    onClick={() => setShowConfirmation(value => !value)}
                  >
                    <EyeIcon hidden={!showConfirmation} />
                  </button>
                </div>
                <fieldset className="auth-roles">
                  <legend className="sr-only">Кто вы?</legend>
                  <label className={`auth-role${role === "SPECIALIST" ? " is-selected" : ""}`}>
                    <input
                      className="sr-only"
                      type="radio"
                      name="role"
                      value="SPECIALIST"
                      checked={role === "SPECIALIST"}
                      onChange={() => setRole("SPECIALIST")}
                    />
                    <SpecialistIcon />
                    <span>Специалист</span>
                  </label>
                  <label className={`auth-role${role === "EMPLOYER" ? " is-selected" : ""}`}>
                    <input
                      className="sr-only"
                      type="radio"
                      name="role"
                      value="EMPLOYER"
                      checked={role === "EMPLOYER"}
                      onChange={() => setRole("EMPLOYER")}
                    />
                    <EmployerIcon />
                    <span>Работодатель</span>
                  </label>
                </fieldset>
              </>
            )}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={loading}>
              <span>{loading ? "Подождите…" : isLogin ? "Войти" : "Зарегистрироваться"}</span>
              <ArrowIcon />
            </button>
          </form>
          <Link className="auth-register" href={isLogin ? "/register" : "/login"}>
            {isLogin ? "Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </Link>
        </div>
      </div>
    </section>
  );
}
