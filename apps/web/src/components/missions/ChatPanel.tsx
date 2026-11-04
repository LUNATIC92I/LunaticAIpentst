'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Info, User, Bot } from 'lucide-react';
import { missions, type MissionMessage } from '@/lib/api';

export function ChatPanel({ missionId }: { missionId: string }) {
  const [messages, setMessages] = useState<MissionMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      setMessages(await missions.messages(missionId));
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    const text = input;
    setInput('');
    try {
      await missions.postMessage(missionId, text);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-18rem)] min-h-[360px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-text-dim">
            Describe the mission or ask a question to begin.
          </p>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2 border-t border-border pt-3">
        <input
          className="input flex-1"
          placeholder="Describe a task or ask the assistant…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn-primary px-3" type="submit" disabled={busy || !input.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function Message({ m }: { m: MissionMessage }) {
  if (m.role === 'system') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warn/25 bg-warn/5 p-3 text-sm text-text-muted">
        <Info size={15} className="mt-0.5 shrink-0 text-warn" />
        <span>{m.content}</span>
      </div>
    );
  }
  const isUser = m.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${isUser ? 'bg-electric/20 text-electric' : 'bg-accent/20 text-accent'}`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${isUser ? 'bg-electric/10 text-text' : 'bg-surface-2 text-text'}`}>
        <p className="whitespace-pre-wrap">{m.content}</p>
      </div>
    </div>
  );
}
