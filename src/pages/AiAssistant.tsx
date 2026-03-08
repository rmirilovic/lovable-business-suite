import { useState, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  MessageSquarePlus,
  Send,
  Loader2,
  Bot,
  User,
  MessageSquare,
  Mic,
  MicOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ChatFileUpload,
  FileAttachment,
  buildMessageContent,
  getDisplayText,
} from "@/components/ai/ChatFileUpload";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export default function AiAssistant() {
  const { user, selectedCompany } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Vaš pretraživač ne podržava glasovni unos");
      return;
    }
    const recognition = new SR();
    recognition.lang = "sr-Latn-RS";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        toast.error("Greška pri prepoznavanju govora");
      }
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    document.title = "AI Asistent | ERP Mirilo";
  }, []);

  // Load conversations
  useEffect(() => {
    if (!user || !selectedCompany) return;
    loadConversations();
  }, [user, selectedCompany]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("company_id", selectedCompany!.id)
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false });
    if (!error && data) setConversations(data);
    setLoadingConversations(false);
  };

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    loadMessages(activeConversationId);
  }, [activeConversationId]);

  const loadMessages = async (convId: string) => {
    const { data, error } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      setMessages(data.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createConversation = async (firstMessage: string): Promise<string | null> => {
    const title = firstMessage.length > 60 ? firstMessage.slice(0, 57) + "..." : firstMessage;
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user!.id, company_id: selectedCompany!.id, title })
      .select("id")
      .single();
    if (error) {
      toast.error("Greška pri kreiranju konverzacije");
      return null;
    }
    setActiveConversationId(data.id);
    await loadConversations();
    return data.id;
  };

  const saveMessage = async (conversationId: string, role: string, content: string) => {
    await supabase.from("ai_messages").insert({ conversation_id: conversationId, role, content });
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if ((!trimmed && attachedFiles.length === 0) || isStreaming) return;

    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation(trimmed);
      if (!convId) return;
    }

    // Build display text and AI content
    const displayText = getDisplayText(attachedFiles, trimmed);
    const aiContent = buildMessageContent(trimmed, attachedFiles);

    const userMsg: Message = { role: "user", content: displayText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setAttachedFiles([]);
    setIsStreaming(true);

    // Save user message (text only for DB)
    await saveMessage(convId, "user", displayText);

    // Build messages for AI - use multimodal content for the current message
    const aiMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: aiContent },
    ];

    // Stream AI response
    let assistantContent = "";
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: aiMessages }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Greška ${resp.status}`);
      }

      if (!resp.body) throw new Error("Nema odgovora");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await saveMessage(convId, "assistant", assistantContent);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(err.message || "Greška u komunikaciji sa AI");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, activeConversationId, messages, user, selectedCompany, attachedFiles]);

  const handleDeleteConversation = async (convId: string) => {
    const { error } = await supabase.from("ai_conversations").delete().eq("id", convId);
    if (error) {
      toast.error("Greška pri brisanju konverzacije");
      return;
    }
    if (activeConversationId === convId) {
      setActiveConversationId(null);
      setMessages([]);
    }
    setConversations((prev) => prev.filter((c) => c.id !== convId));
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <MainLayout title="AI Asistent">
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Conversations sidebar */}
        <Card className="w-72 shrink-0 flex flex-col">
          <div className="p-3 border-b">
            <Button onClick={handleNewConversation} className="w-full gap-2" size="sm">
              <MessageSquarePlus className="w-4 h-4" />
              Nova konverzacija
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingConversations ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nema konverzacija
                </p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors",
                      activeConversationId === conv.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() => setActiveConversationId(conv.id)}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      className="shrink-0 px-2 py-1 rounded-md border border-border text-xs font-medium text-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors"
                      title="Obriši konverzaciju"
                      aria-label="Obriši konverzaciju"
                    >
                      Obriši
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat area */}
        <Card className="flex-1 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Bot className="w-12 h-12 mb-4 opacity-40" />
                  <p className="text-lg font-medium">AI Asistent</p>
                  <p className="text-sm mt-1">Postavite pitanje o ERP sistemu ili poslovanju</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 max-w-[80%] text-sm whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="rounded-lg px-4 py-3 bg-muted">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="max-w-3xl mx-auto">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {attachedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs max-w-[200px]"
                    >
                      <span className="truncate">📎 {file.name}</span>
                      <button
                        onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="ml-0.5 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <ChatFileUpload
                  files={attachedFiles}
                  onFilesChange={setAttachedFiles}
                  disabled={isStreaming}
                />
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Unesite pitanje ili priložite fajl..."
                  className="min-h-[44px] max-h-32 resize-none"
                  rows={1}
                  disabled={isStreaming}
                />
                <Button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isStreaming}
                  size="icon"
                  variant={isListening ? "destructive" : "outline"}
                  className="shrink-0 h-11 w-11"
                  title={isListening ? "Zaustavi snimanje" : "Govori"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming}
                  size="icon"
                  className="shrink-0 h-11 w-11"
                >
                  {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
