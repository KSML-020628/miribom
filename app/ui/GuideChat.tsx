"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ChatIntent,
  ChatReply,
  ChatTurn,
  FinalGuideResult,
} from "@/app/lib/types";

interface Props {
  guide: FinalGuideResult;
  documentText: string;
  onSpeak: (text: string) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: ChatIntent;
  reply?: ChatReply;
}

interface SpeechResultEvent {
  results: ArrayLike<{
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const STARTER_QUESTIONS = [
  "물은 언제까지 마셔요?",
  "먹는 약은 어떻게 해요?",
  "병원에는 몇 시에 가요?",
];

function messageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toHistory(messages: ChatMessage[]): ChatTurn[] {
  return messages.slice(-6).map((message) => ({
    role: message.role,
    text: message.text,
    intent: message.intent,
  }));
}

export default function GuideChat({ guide, documentText, onSpeak }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => recognitionRef.current?.stop();
  }, [open]);

  async function ask(text: string) {
    const nextQuestion = text.trim();
    if (!nextQuestion || sending) return;

    const userMessage: ChatMessage = {
      id: messageId(),
      role: "user",
      text: nextQuestion,
    };
    const history = toHistory(messages);
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: nextQuestion,
          documentText,
          guide,
          history,
        }),
      });
      const payload = await response.json() as ChatReply | { error?: string };
      if (!response.ok || !("answer" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "답변을 만들지 못했어요.");
      }
      setMessages((current) => [
        ...current.map((message) => message.id === userMessage.id
          ? { ...message, intent: payload.intent }
          : message),
        {
          id: messageId(),
          role: "assistant",
          text: payload.answer,
          intent: payload.intent,
          reply: payload,
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "답변을 만들지 못했어요.");
    } finally {
      setSending(false);
    }
  }

  function startListening() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("이 브라우저에서는 말로 질문하기를 사용할 수 없어요. 글자로 질문해 주세요.");
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || "";
      setQuestion(transcript);
      setError(transcript ? "이렇게 들었어요. 맞으면 ‘질문하기’를 눌러 주세요." : "말을 잘 듣지 못했어요. 다시 말해 주세요.");
    };
    recognition.onerror = () => setError("말을 잘 듣지 못했어요. 다시 말하거나 글자로 적어 주세요.");
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    setError("듣고 있어요. 천천히 말씀해 주세요.");
    recognition.start();
  }

  function closeChat() {
    recognitionRef.current?.stop();
    setOpen(false);
  }

  const latestReply = [...messages].reverse().find((message) => message.role === "assistant")?.reply;
  const suggestions = latestReply?.suggestions?.length ? latestReply.suggestions : STARTER_QUESTIONS;

  return (
    <>
      <button className="chatOpenButton" type="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">?</span>
        안내문에 물어보기
      </button>

      {open && (
        <div className="chatOverlay" role="dialog" aria-modal="true" aria-labelledby="chat-title">
          <section className="chatPanel">
            <header className="chatHeader">
              <div>
                <p className="eyebrow">올려주신 안내문 안에서만 찾아요</p>
                <h2 id="chat-title">무엇이 궁금하세요?</h2>
              </div>
              <button type="button" onClick={closeChat} aria-label="질문창 닫기">닫기</button>
            </header>

            <div className="chatConversation" aria-live="polite">
              {!messages.length && (
                <div className="chatWelcome">
                  <strong>짧게 말해도 괜찮아요.</strong>
                  <p>“물 돼?”, “약은?”, “몇 시부터?”처럼 물어보세요.</p>
                </div>
              )}
              {messages.map((message) => (
                <article key={message.id} className={`chatMessage ${message.role}`}>
                  <span>{message.role === "user" ? "내 질문" : "미리봄 답변"}</span>
                  {message.reply?.understood_as && <small>{message.reply.understood_as}</small>}
                  <p>{message.text}</p>
                  {message.reply && (
                    <>
                      <button
                        className="chatListenButton"
                        type="button"
                        onClick={() => onSpeak(message.text)}
                      >
                        ▶ 답변 듣기
                      </button>
                      {message.reply.evidence.length > 0 && (
                        <details className="chatEvidence">
                          <summary>안내문에서 찾은 내용</summary>
                          {message.reply.evidence.map((item, index) => (
                            <blockquote key={`${item.source}-${index}`}>
                              <b>{item.source}</b>
                              <p>{item.text}</p>
                            </blockquote>
                          ))}
                        </details>
                      )}
                    </>
                  )}
                </article>
              ))}
              {sending && (
                <div className="chatThinking" role="status">
                  <b>안내문에서 답을 찾고 있어요.</b>
                  <span aria-hidden="true">···</span>
                </div>
              )}
            </div>

            <div className="chatSuggestions" aria-label="추천 질문">
              {suggestions.slice(0, 3).map((suggestion) => (
                <button type="button" key={suggestion} disabled={sending} onClick={() => void ask(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>

            <form
              className="chatComposer"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(question);
              }}
            >
              <label htmlFor="guide-question">궁금한 내용을 적어 주세요</label>
              <div>
                <input
                  ref={inputRef}
                  id="guide-question"
                  value={question}
                  maxLength={240}
                  disabled={sending}
                  placeholder="예: 물은 언제까지 마셔요?"
                  onChange={(event) => setQuestion(event.target.value)}
                />
                <button
                  className={listening ? "voiceButton listening" : "voiceButton"}
                  type="button"
                  disabled={sending || listening}
                  onClick={startListening}
                >
                  {listening ? "듣는 중" : "말로 질문"}
                </button>
                <button className="chatSendButton" type="submit" disabled={sending || !question.trim()}>
                  질문하기
                </button>
              </div>
              {error && <p className="chatStatus">{error}</p>}
            </form>

            <p className="chatSafety">
              미리봄은 진단하거나 약을 결정하지 않아요. 안내문에서 찾지 못한 내용은 병원에 확인해 주세요.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
