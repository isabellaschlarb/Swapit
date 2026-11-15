"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatChatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

// The live part of a chat: the message bubbles and the "type a message" box.
//  - New messages arrive instantly through Supabase Realtime.
//  - Sending inserts a row in `messages`; the database checks I'm in this swap.
//  - Opening the chat (and each new message) marks it read, which clears
//    the unread dot in the Messages list.
export function ChatThread({
  swapId,
  myId,
  timeZone,
  initialMessages,
  otherName,
}: {
  swapId: string;
  myId: string;
  timeZone: string;
  initialMessages: Message[];
  otherName: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Add a message unless we already have it (our own message comes back
  // both from the insert and from Realtime).
  function add(message: Message) {
    setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
  }

  // Live updates for this chat.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`chat-${swapId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `swap_request_id=eq.${swapId}` },
          (payload) => add(payload.new as Message),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [swapId]);

  // Scroll to the newest message and mark the chat as read.
  const count = messages.length;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
    createClient()
      .from("message_reads")
      .upsert(
        { swap_request_id: swapId, user_id: myId, last_read_at: new Date().toISOString() },
        { onConflict: "swap_request_id,user_id" },
      )
      .then(({ error: readError }) => readError && console.error(readError));
  }, [count, swapId, myId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error: sendError } = await createClient()
      .from("messages")
      .insert({ swap_request_id: swapId, body })
      .select()
      .single();
    if (sendError) {
      console.error(sendError);
      setError("Couldn't send. Check your connection and try again.");
    } else {
      add(data as Message);
      setText("");
    }
    setSending(false);
  }

  return (
    <>
      <ol className="flex-1 space-y-2 px-5 py-4" aria-live="polite">
        {messages.length === 0 && (
          <li className="py-10 text-center text-sm text-ink/60">
            Say hi to {otherName}! Ask about fit, or confirm when and where to meet.
          </li>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] space-y-1 rounded-2xl px-4 py-2 ${
                  mine ? "rounded-br-md bg-navy text-white" : "rounded-bl-md bg-surface shadow-soft"
                }`}
              >
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={`text-[10px] ${mine ? "text-white/60" : "text-ink/50"}`}>{formatChatTime(m.created_at, timeZone)}</p>
              </div>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ol>

      {/* Stays above the phone tab bar */}
      <form
        onSubmit={send}
        className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] mx-5 mb-2 flex items-end gap-2 rounded-3xl bg-surface p-2 shadow-soft lg:bottom-4"
      >
        <label className="sr-only" htmlFor="chat-input">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={1}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Message…"
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 outline-none"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
      {error && <p className="mx-5 mb-4 rounded-2xl bg-pale p-3 text-sm">{error}</p>}
    </>
  );
}
