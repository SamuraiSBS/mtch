"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Heart, MessageCircle, Send } from "lucide-react";
import { api, send } from "./api";
import { UiIcon } from "./ui-icon";

type ChatMessage = { id: string; matchId: string; senderUserId: string; body: string; createdAt: string };
type ChatThread = {
  id: string;
  companyId: string;
  name: string;
  subtitle: string;
  avatarFileId: string;
  isFavorite: boolean;
  acceptedAt: string;
  lastMessage: Pick<ChatMessage, "body" | "senderUserId" | "createdAt"> | null;
};

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export function ChatPanel({ role, userId }: { role: "SPECIALIST" | "EMPLOYER"; userId: string }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [requestedId, setRequestedId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => threads.find((thread) => thread.id === selectedId) ?? null, [threads, selectedId]);

  useEffect(() => {
    setRequestedId(new URLSearchParams(window.location.search).get("match") ?? "");
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await api<{ items: ChatThread[] }>("/chats");
        if (!active) return;
        setThreads(result.items);
        setError("");
        setSelectedId((current) => current && result.items.some((thread) => thread.id === current)
          ? current
          : requestedId && result.items.some((thread) => thread.id === requestedId)
            ? requestedId
            : result.items[0]?.id ?? "");
      } catch (reason) { if (active) setError((reason as Error).message); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 12000);
    return () => { active = false; window.clearInterval(timer); };
  }, [requestedId]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    let active = true;
    const load = async () => {
      try {
        const result = await api<{ items: ChatMessage[] }>(`/chats/${selectedId}/messages`);
        if (active) setMessages(result.items);
      } catch (reason) { if (active) setError((reason as Error).message); }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, selectedId]);

  async function toggleFavorite(thread: ChatThread) {
    setError("");
    try {
      if (thread.isFavorite) await send(`/favorites/${thread.companyId}`, "DELETE");
      else await send("/favorites", "POST", { companyId: thread.companyId });
      setThreads((current) => current.map((item) => item.id === thread.id ? { ...item, isFavorite: !item.isFavorite } : item));
    } catch (reason) { setError((reason as Error).message); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!selected || !body || sending) return;
    setSending(true);
    setError("");
    try {
      const created = await send<ChatMessage>(`/chats/${selected.id}/messages`, "POST", { body });
      setMessages((current) => [...current, created]);
      setDraft("");
      const result = await api<{ items: ChatThread[] }>("/chats");
      setThreads(result.items);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSending(false); }
  }

  return <section className="chat-screen" aria-label="Чаты">
    <header className="specialist-content__heading chat-screen__heading"><div><h1>Чаты</h1><p>Обсуждайте детали предложения напрямую</p></div></header>
    {error && <p className="specialist-dashboard__error" role="alert">{error}</p>}
    <div className="chat-layout">
      <aside className="chat-list" aria-label="Список чатов">
        {loading && <p className="chat-list__loading">Загружаем чаты…</p>}
        {!loading && threads.length === 0 && <div className="chat-list__empty"><UiIcon icon={MessageCircle} size={22} /><p>Принятые предложения появятся здесь.</p></div>}
        {threads.map((thread) => <button type="button" key={thread.id} className={thread.id === selectedId ? "chat-list__item is-active" : "chat-list__item"} onClick={() => setSelectedId(thread.id)}>
          <span className="chat-list__avatar">{thread.avatarFileId ? <Image src={`/api/v1/media/${thread.avatarFileId}?size=64`} width={56} height={56} unoptimized alt="" /> : <span>{thread.name.slice(0, 1).toUpperCase()}</span>}</span>
          <span className="chat-list__copy"><strong>{thread.name}{role === "SPECIALIST" && thread.isFavorite && <UiIcon icon={Heart} size={13} className="chat-list__heart" />}</strong><small>{thread.subtitle}</small><span>{thread.lastMessage?.body ?? "Предложение принято — можно начать диалог"}</span></span>
          <time>{thread.lastMessage ? timeLabel(thread.lastMessage.createdAt) : dateLabel(thread.acceptedAt)}</time>
        </button>)}
      </aside>
      {!selected && !loading && <div className="chat-empty-state"><span><UiIcon icon={MessageCircle} size={26} /></span><h2>Выберите чат</h2><p>Здесь появится переписка после принятия предложения.</p></div>}
      {selected && <div className="chat-conversation">
        <header className="chat-conversation__header">
          <span className="chat-conversation__avatar">{selected.avatarFileId ? <Image src={`/api/v1/media/${selected.avatarFileId}?size=64`} width={48} height={48} unoptimized alt="" /> : selected.name.slice(0, 1).toUpperCase()}</span>
          <div><h2>{selected.name}</h2><p>{selected.subtitle}</p></div>
          {role === "SPECIALIST" && <button type="button" className={selected.isFavorite ? "chat-conversation__favorite is-active" : "chat-conversation__favorite"} aria-pressed={selected.isFavorite} aria-label={selected.isFavorite ? "Убрать работодателя из избранного" : "Добавить работодателя в избранное"} onClick={() => void toggleFavorite(selected)}><UiIcon icon={Heart} size={20} /></button>}
        </header>
        <div className="chat-conversation__messages" aria-live="polite">
          <div className="chat-conversation__date">Чат открыт {dateLabel(selected.acceptedAt)}</div>
          {messages.map((message) => <article className={message.senderUserId === userId ? "chat-message is-own" : "chat-message"} key={message.id}>
            <p>{message.body}</p><time>{timeLabel(message.createdAt)}</time>
          </article>)}
          {messages.length === 0 && <p className="chat-conversation__welcome">Предложение принято. Напишите работодателю, чтобы обсудить детали.</p>}
          <div ref={bottomRef} />
        </div>
        <form className="chat-composer" onSubmit={sendMessage}>
          <textarea value={draft} maxLength={3000} rows={1} aria-label="Сообщение" placeholder="Напишите сообщение…" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <button type="submit" aria-label="Отправить сообщение" disabled={!draft.trim() || sending}><UiIcon icon={Send} size={18} /></button>
        </form>
      </div>}
    </div>
  </section>;
}
