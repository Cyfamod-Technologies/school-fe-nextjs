"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAiChatHistory, sendAiChat } from "@/lib/ai";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const STORAGE_KEY = "ai_chat_history_v1";
const POSITION_KEY = "ai_chat_widget_position_v1";
const LAUNCHER_SIZE = 56;
const VIEWPORT_MARGIN = 16;

const quickActions = [
  "How do I add a student?",
  "Show me how to enter term results.",
  "Edit a class teacher assignment.",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function splitWithBreaks(text: string, keyPrefix: string) {
  if (!text) {
    return [];
  }
  const parts = text.split("\n");
  return parts.flatMap((part, index) => {
    const nodes: React.ReactNode[] = [];
    if (index > 0) {
      nodes.push(<br key={`${keyPrefix}-br-${index}`} />);
    }
    if (part) {
      nodes.push(<span key={`${keyPrefix}-part-${index}`}>{part}</span>);
    }
    return nodes;
  });
}

function renderMessageContent(content: string) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of content.matchAll(urlRegex)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(
        ...splitWithBreaks(
          content.slice(lastIndex, index),
          `text-${matchIndex}`,
        ),
      );
    }

    let rawUrl = match[0];
    let trailing = "";
    if (/[.,!?]$/.test(rawUrl)) {
      trailing = rawUrl.slice(-1);
      rawUrl = rawUrl.slice(0, -1);
    }

    nodes.push(
      <a
        key={`link-${matchIndex}-${index}`}
        href={rawUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        {rawUrl}
      </a>,
    );

    if (trailing) {
      nodes.push(
        <span key={`trail-${matchIndex}-${index}`}>{trailing}</span>,
      );
    }

    lastIndex = index + match[0].length;
    matchIndex += 1;
  }

  if (lastIndex < content.length) {
    nodes.push(
      ...splitWithBreaks(content.slice(lastIndex), `text-end-${matchIndex}`),
    );
  }

  return nodes.length ? nodes : [content];
}

function safeParseMessages(raw: string | null): ChatMessage[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (Array.isArray(parsed)) {
      return parsed.filter((msg) => typeof msg?.content === "string");
    }
  } catch {
    // ignore bad storage
  }
  return [];
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const ignoreClickRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const clampPosition = useCallback(
    (x: number, y: number) => {
      if (!viewport.width || !viewport.height) {
        return { x, y };
      }
      const maxX = viewport.width - LAUNCHER_SIZE - VIEWPORT_MARGIN;
      const maxY = viewport.height - LAUNCHER_SIZE - VIEWPORT_MARGIN;
      return {
        x: clamp(x, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxX)),
        y: clamp(y, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxY)),
      };
    },
    [viewport.height, viewport.width],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const localMessages = safeParseMessages(localStorage.getItem(STORAGE_KEY));
    setMessages(localMessages);

    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const saved = localStorage.getItem(POSITION_KEY);
    let initial = {
      x: VIEWPORT_MARGIN,
      y: window.innerHeight - LAUNCHER_SIZE - VIEWPORT_MARGIN,
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { x?: number; y?: number };
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          initial = { x: parsed.x, y: parsed.y };
        }
      } catch {
        // ignore bad storage
      }
    }
    setPosition(clampPosition(initial.x, initial.y));

    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : prev));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  useEffect(() => {
    let active = true;
    fetchAiChatHistory("school", 100)
      .then((response) => {
        if (!active || !response?.data?.length) {
          return;
        }
        const serverMessages: ChatMessage[] = [];
        response.data.forEach((log) => {
          serverMessages.push({
            id: `${log.id}-user`,
            role: "user",
            content: log.user_message,
            timestamp: new Date(log.created_at).getTime(),
          });
          serverMessages.push({
            id: `${log.id}-assistant`,
            role: "assistant",
            content: log.assistant_reply,
            timestamp: new Date(log.created_at).getTime() + 1,
          });
        });
        setMessages((prev) => (serverMessages.length ? serverMessages : prev));
      })
      .catch(() => {
        // keep local history on failure
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!position || typeof window === "undefined") {
      return;
    }
    localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const trimmed = messages.slice(-100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }, [messages]);

  useEffect(() => {
    if (!open) {
      return;
    }
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  const toggleOpen = useCallback(() => {
    if (ignoreClickRef.current) {
      return;
    }
    setOpen((prev) => !prev);
    setError(null);
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) {
        return;
      }
      dragMovedRef.current = true;
      const next = clampPosition(
        event.clientX - dragOffsetRef.current.x,
        event.clientY - dragOffsetRef.current.y,
      );
      setPosition(next);
    },
    [clampPosition],
  );

  const handlePointerUp = useCallback(() => {
    if (dragMovedRef.current) {
      ignoreClickRef.current = true;
      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 0);
    }
    draggingRef.current = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!position) {
        return;
      }
      draggingRef.current = true;
      dragMovedRef.current = false;
      dragOffsetRef.current = {
        x: event.clientX - position.x,
        y: event.clientY - position.y,
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, position],
  );

  const handleSend = useCallback(
    async (messageOverride?: string) => {
      const content = (messageOverride ?? input).trim();
      if (!content || loading) {
        return;
      }

      const outgoing: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, outgoing]);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const response = await sendAiChat(content);
        const reply: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "assistant",
          content: response.reply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, reply]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to reach the AI service.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [input, loading],
  );

  return (
    <>
      {open ? (
        <div
          className="shadow-lg"
          style={{
            position: "fixed",
            zIndex: 1200,
            width: "100vw",
            height: "100vh",
            left: 0,
            top: 0,
            display: "flex",
            flexDirection: "column",
            background: "#f8f9fb",
          }}
        >
          <div
            className="card-header d-flex align-items-center justify-content-between"
            style={{
              background: "#042C54",
              color: "#fff",
              borderRadius: 0,
              fontSize: "1.4rem",
            }}
          >
            <div className="font-weight-bold">School Assistant</div>
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={() => setOpen(false)}
              style={{ fontSize: "1.2rem" }}
            >
              Close
            </button>
          </div>
          <div
            ref={scrollRef}
            className="card-body"
            style={{
              overflowY: "auto",
              padding: "1rem",
              flex: 1,
              fontSize: "1.6rem",
            }}
          >
            {messages.length === 0 ? (
              <div className="text-muted mb-3" style={{ fontSize: "2.2rem" }}>
                Ask me anything about your school dashboard.
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-3 ${
                  message.role === "user" ? "text-right" : "text-left"
                }`}
              >
                <div
                  className={`d-inline-block px-3 py-2 rounded ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-white border"
                  }`}
                  style={{
                    maxWidth: "85%",
                    whiteSpace: "pre-wrap",
                    fontSize: "1.6rem",
                    lineHeight: 1.5,
                  }}
                >
                  {renderMessageContent(message.content)}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="text-muted" style={{ fontSize: "1.4rem" }}>
                Thinking...
              </div>
            ) : null}

            {error ? (
              <div className="alert alert-danger mt-3" role="alert">
                {error}
              </div>
            ) : null}

            {messages.length === 0 ? (
              <div className="mt-3">
                <div className="text-muted mb-2" style={{ fontSize: "1.4rem" }}>
                  Quick actions
                </div>
                <div className="d-flex flex-column" style={{ gap: 8 }}>
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="btn btn-outline-primary btn-sm text-left"
                      onClick={() => handleSend(action)}
                      style={{ fontSize: "1.7rem" }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <form
            className="card-footer"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
          >
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                placeholder="Ask a question..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={loading}
                style={{ fontSize: "2rem", height: "4.5rem" }}
              />
              <div className="input-group-append">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !input.trim()}
                  style={{ fontSize: "1.4rem" }}
                >
                  Send
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onClick={toggleOpen}
          className="btn btn-primary"
          style={{
            position: "fixed",
            zIndex: 1201,
            width: LAUNCHER_SIZE,
            height: LAUNCHER_SIZE,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 24px rgba(0,0,0,0.2)",
            left: position?.x ?? VIEWPORT_MARGIN,
            top: position?.y ?? VIEWPORT_MARGIN,
          }}
          aria-label="Open AI assistant"
        >
          <span className="font-weight-bold">AI</span>
        </button>
      ) : null}
    </>
  );
}
