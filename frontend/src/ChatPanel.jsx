import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const formatError = (error) => error?.message || "Beklenmeyen bir hata oluştu";

const formatTime = (value) => {
  const date = new Date(value || Date.now());
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (value) => {
  const date = new Date(value || Date.now());
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const getConversationTitle = (conversation = {}) => {
  const name = String(conversation?.contactName || "").trim();
  if (name) {
    return name;
  }
  return conversation?.phone || "İsimsiz";
};

function ChatPanel() {
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [nextBefore, setNextBefore] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item._id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const loadConversations = async ({ preserveSelection = true } = {}) => {
    try {
      setConversationsLoading(true);
      setChatError("");
      const list = await api.getConversations(query.trim());
      const normalized = Array.isArray(list) ? list : [];
      setConversations(normalized);

      if (normalized.length === 0) {
        setSelectedConversationId("");
        setMessages([]);
        setHasMore(false);
        setNextBefore("");
        return;
      }

      if (!preserveSelection || !normalized.some((item) => item._id === selectedConversationId)) {
        setSelectedConversationId(normalized[0]._id);
      }
    } catch (error) {
      setChatError(formatError(error));
    } finally {
      setConversationsLoading(false);
    }
  };

  const loadMessages = async (conversationId, options = {}) => {
    if (!conversationId) {
      return;
    }

    try {
      setMessagesLoading(true);
      const response = await api.getConversationMessages(conversationId, {
        limit: 50,
        before: options.before || ""
      });

      const list = Array.isArray(response?.messages) ? response.messages : [];
      const cursor = response?.nextBefore || "";
      const more = Boolean(response?.hasMore);

      setMessages((current) => (options.append ? [...list, ...current] : list));
      setNextBefore(cursor);
      setHasMore(more);
    } catch (error) {
      setChatError(formatError(error));
    } finally {
      setMessagesLoading(false);
    }
  };

  const onSelectConversation = async (conversationId) => {
    setSelectedConversationId(conversationId);
    await loadMessages(conversationId);
    try {
      await api.markConversationRead(conversationId);
      setConversations((current) => current.map((item) => (
        item._id === conversationId
          ? { ...item, unreadCount: 0 }
          : item
      )));
    } catch {
    }
  };

  const onSubmitComposer = async (event) => {
    event.preventDefault();

    const text = String(composer || "").trim();
    if (!selectedConversationId || !text) {
      return;
    }

    try {
      setSending(true);
      setChatError("");
      await api.sendConversationMessage(selectedConversationId, { text });
      setComposer("");
      await Promise.all([
        loadMessages(selectedConversationId),
        loadConversations({ preserveSelection: true })
      ]);
    } catch (error) {
      setChatError(formatError(error));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadConversations({ preserveSelection: false });
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadConversations({ preserveSelection: true });
    }, 350);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    onSelectConversation(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadConversations({ preserveSelection: true });
      if (selectedConversationId) {
        loadMessages(selectedConversationId);
      }
    }, 7000);

    return () => clearInterval(intervalId);
  }, [selectedConversationId]);

  return (
    <section className="panel chat-panel">
      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-head">
            <h2>Sohbetler</h2>
            <input
              placeholder="Numara veya isim ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="chat-conversation-list">
            {conversationsLoading && <p className="hint">Yükleniyor...</p>}
            {!conversationsLoading && conversations.length === 0 && <p className="hint">Sohbet bulunamadı.</p>}

            {conversations.map((conversation) => {
              const activeConversation = conversation._id === selectedConversationId;
              return (
                <button
                  key={conversation._id}
                  type="button"
                  className={activeConversation ? "chat-conversation-item active" : "chat-conversation-item"}
                  onClick={() => onSelectConversation(conversation._id)}
                >
                  <div className="chat-conversation-row">
                    <strong>{getConversationTitle(conversation)}</strong>
                    <span>{formatTime(conversation.lastMessageAt)}</span>
                  </div>
                  <div className="chat-conversation-row muted-row">
                    <span>{conversation.phone}</span>
                    {conversation.unreadCount > 0 && <span className="chat-unread-badge">{conversation.unreadCount}</span>}
                  </div>
                  <p>{conversation.lastMessageText || "-"}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="chat-main">
          {selectedConversation ? (
            <>
              <header className="chat-main-header">
                <div>
                  <h3>{getConversationTitle(selectedConversation)}</h3>
                  <p>{selectedConversation.phone}</p>
                </div>
                <span className="meta-pill">{messages.length} mesaj</span>
              </header>

              <div className="chat-messages">
                {hasMore && (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => loadMessages(selectedConversation._id, { append: true, before: nextBefore })}
                    disabled={messagesLoading}
                  >
                    {messagesLoading ? "Yükleniyor..." : "Daha eski mesajlar"}
                  </button>
                )}

                {messages.map((message) => {
                  const inbound = message.direction === "inbound";
                  return (
                    <div key={message._id} className={inbound ? "chat-message inbound" : "chat-message outbound"}>
                      <p>{message.body || "(boş mesaj)"}</p>
                      <small>{formatDate(message.createdAt)} • {formatTime(message.createdAt)}</small>
                    </div>
                  );
                })}

                {!messagesLoading && messages.length === 0 && (
                  <p className="hint">Bu konuşmada henüz mesaj yok.</p>
                )}
              </div>

              <form onSubmit={onSubmitComposer} className="chat-composer">
                <textarea
                  placeholder="Bir mesaj yazın"
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  rows={3}
                />
                <button type="submit" disabled={sending || !composer.trim()}>
                  {sending ? "Gönderiliyor..." : "Gönder"}
                </button>
              </form>
            </>
          ) : (
            <div className="chat-empty-state">
              <h3>Sohbet seçin</h3>
              <p>Soldan bir konuşma seçtiğinizde tüm mesajları burada göreceksiniz.</p>
            </div>
          )}
        </div>
      </div>

      {chatError && <p className="info">{chatError}</p>}
    </section>
  );
}

export default ChatPanel;
