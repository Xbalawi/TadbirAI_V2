"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2, Maximize2, Minimize2, CheckCircle2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/authStore";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatWidget() {
  const { t, langue } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeRole = user?.role || "Lecteur";
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      { role: "assistant", content: t("aichat.welcome", "Bonjour ! Je suis l'Assistant IA de Tadbir AI. Comment puis-je vous aider aujourd'hui ? (Ex: Crée un devis, Affiche mes clients, Cherche un produit...)") }
    ]);
  }, [langue]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": activeRole,
        },
        body: JSON.stringify({ message: userMessage, langue, userRole: activeRole }),
      });

      if (!response.ok) throw new Error("Erreur réseau");
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || t("aichat.not_understood", "Désolé, je n'ai pas compris.") }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: t("aichat.error", "Désolé, une erreur est survenue lors de la connexion au serveur.") }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 ring-2 ring-indigo-400/30 transition-transform hover:scale-110 active:scale-95 glow-indigo"
        >
          <MessageSquare size={24} />
          {/* Notification dot */}
          <span className="absolute right-3 top-3 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400 animate-pulse"></span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl transition-all duration-300 max-h-[calc(100vh-2rem)] ${
            isExpanded ? "h-[80vh] w-[800px]" : "h-[500px] w-[390px]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-950 border-b border-slate-800 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                <span className="font-bold text-xs">IA</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">{t("aichat.title", "Assistant Tadbir AI")}</h3>
                <p className="text-[11px] text-slate-400">Gemini 1.5 Pro • Online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto bg-slate-950/60 p-4 space-y-4">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] shadow-sm ${
                    msg.role === "user" 
                      ? "bg-indigo-600 text-white rounded-br-xs font-medium" 
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs prose prose-invert prose-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-slate-800 text-[12px]" {...props} /></div>,
                        th: ({node, ...props}) => <th className="bg-slate-950 px-3 py-2 text-left font-semibold text-slate-200 border-b border-slate-800" {...props} />,
                        td: ({node, ...props}) => <td className="whitespace-nowrap px-3 py-2 text-slate-300 border-b border-slate-800" {...props} />,
                        a: ({node, href, children}) => {
                            if (href?.startsWith('https://wa.me')) {
                                return (
                                    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 mb-1 px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-full hover:bg-emerald-400 no-underline shadow-sm transition-all text-xs">
                                        {children}
                                    </a>
                                )
                            }
                            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">{children}</a>
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-xs px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"></div>
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '0.15s' }}></div>
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-slate-950 border-t border-slate-800 p-3">
            <div className="flex items-end gap-2 bg-slate-900 rounded-xl border border-slate-800 p-1 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("aichat.placeholder", "Posez une question à l'assistant...")}
                className="max-h-32 min-h-[44px] w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-slate-500"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="mb-1 mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
