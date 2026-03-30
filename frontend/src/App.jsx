import React, { useEffect, useMemo, useState } from "react";
import { api, setApiToken } from "./api";

const defaultContact = { name: "", phone: "", tag: "" };
const defaultTemplateForm = {
  name: "",
  category: "UTILITY",
  language: "tr",
  publishToMeta: true,
  headerType: "none",
  headerText: "",
  headerMediaHandle: "",
  footerText: "",
  content: ""
};
const defaultLogin = { username: "", password: "" };
const defaultNewUser = { username: "", password: "", role: "user" };
const defaultSingleSendForm = { contactId: "", phone: "", templateId: "", mediaUrl: "", variablesJson: '{"name":"Ahmet"}' };
const defaultBulkSendForm = { templateId: "", mediaUrl: "", variablesJson: '{"name":"Ahmet"}', contactIds: [] };

const formatError = (error) => error?.message || "Beklenmeyen bir hata oluştu";

const getStoredToken = () => localStorage.getItem("auth_token") || "";

const compareTemplatesByMetaOrder = (first, second) => {
  const firstLocal = new Date(first?.createdAt || 0).getTime();
  const secondLocal = new Date(second?.createdAt || 0).getTime();
  return secondLocal - firstLocal;
};

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [health, setHealth] = useState("checking");

  const [token, setToken] = useState(getStoredToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState(defaultLogin);
  const [authMessage, setAuthMessage] = useState("");

  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactForm, setContactForm] = useState(defaultContact);
  const [contactQuery, setContactQuery] = useState("");
  const [importResult, setImportResult] = useState("");

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateActionResult, setTemplateActionResult] = useState("");
  const [expandedTemplateId, setExpandedTemplateId] = useState("");
  const [templateForm, setTemplateForm] = useState(defaultTemplateForm);
  const [templateMediaFile, setTemplateMediaFile] = useState(null);
  const [templateMediaUploading, setTemplateMediaUploading] = useState(false);

  const [singleSendForm, setSingleSendForm] = useState(defaultSingleSendForm);
  const [bulkSendForm, setBulkSendForm] = useState(defaultBulkSendForm);
  const [sendResult, setSendResult] = useState("");

  const [logsResult, setLogsResult] = useState("");
  const [messageStats, setMessageStats] = useState({
    totalMessages: 0,
    successRate: 0
  });

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUserForm, setNewUserForm] = useState(defaultNewUser);
  const [userActionResult, setUserActionResult] = useState("");

  const [profileForm, setProfileForm] = useState({
    whatsappToken: "",
    whatsappPhoneId: "",
    whatsappBusinessAccountId: "",
    password: ""
  });
  const [profileResult, setProfileResult] = useState("");

  const tabs = useMemo(() => {
    const base = ["dashboard", "contacts", "templates", "send", "logs", "profile"];

    if (currentUser?.role === "admin") {
      return [...base, "users"];
    }

    return base;
  }, [currentUser?.role]);

  const metrics = useMemo(() => {
    return {
      totalContacts: contacts.length,
      totalTemplates: templates.length,
      totalMessages: messageStats.totalMessages,
      successRate: messageStats.successRate
    };
  }, [contacts.length, messageStats.successRate, messageStats.totalMessages, templates.length]);

  const selectedSingleContact = useMemo(
    () => contacts.find((item) => item._id === singleSendForm.contactId) || null,
    [contacts, singleSendForm.contactId]
  );

  const selectedSingleTemplate = useMemo(
    () => templates.find((item) => item._id === singleSendForm.templateId) || null,
    [templates, singleSendForm.templateId]
  );

  const selectedBulkTemplate = useMemo(
    () => templates.find((item) => item._id === bulkSendForm.templateId) || null,
    [templates, bulkSendForm.templateId]
  );

  const isMediaHeaderTemplate = (template) => ["image", "video", "document"].includes(String(template?.headerType || "").toLowerCase());

  const loadHealth = async () => {
    try {
      await api.health();
      setHealth("ok");
    } catch {
      setHealth("error");
    }
  };

  const loadCurrentUser = async () => {
    const response = await api.me();
    const user = response?.user;

    if (user) {
      setCurrentUser(user);
      setProfileForm({
        whatsappToken: user.whatsappToken || "",
        whatsappPhoneId: user.whatsappPhoneId || "",
        whatsappBusinessAccountId: user.whatsappBusinessAccountId || "",
        password: ""
      });
    }
  };

  const loadContacts = async (query = "") => {
    try {
      setContactsLoading(true);
      const queryString = query ? `?q=${encodeURIComponent(query)}` : "";
      const data = await api.getContacts(queryString);
      setContacts(data);
    } catch (error) {
      setImportResult(formatError(error));
    } finally {
      setContactsLoading(false);
    }
  };

  const loadTemplates = async (syncMeta = false) => {
    try {
      setTemplatesLoading(true);
      const data = await api.getTemplates({ syncMeta });
      const normalized = Array.isArray(data?.value) ? data.value : data;
      const list = Array.isArray(normalized) ? normalized : [];
      const sorted = [...list].sort(compareTemplatesByMetaOrder);
      setTemplates(sorted);
    } catch (error) {
      setLogsResult(formatError(error));
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadUsers = async () => {
    if (currentUser?.role !== "admin") {
      return;
    }

    try {
      setUsersLoading(true);
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (error) {
      setUserActionResult(formatError(error));
    } finally {
      setUsersLoading(false);
    }
  };

  const loadMessageStats = async () => {
    try {
      const stats = await api.getLogStats();
      setMessageStats({
        totalMessages: Number(stats.totalMessages || 0),
        successRate: Number(stats.successRate || 0)
      });
    } catch {
      setMessageStats({ totalMessages: 0, successRate: 0 });
    }
  };

  const loadInitialData = async () => {
    await Promise.all([
      loadContacts(),
      loadTemplates(),
      loadMessageStats()
    ]);
  };

  useEffect(() => {
    loadHealth();
  }, []);

  useEffect(() => {
    setApiToken(token);

    if (!token) {
      setCurrentUser(null);
      return;
    }

    const bootstrap = async () => {
      try {
        await loadCurrentUser();
        await loadInitialData();
      } catch {
        localStorage.removeItem("auth_token");
        setToken("");
        setCurrentUser(null);
      }
    };

    bootstrap();
  }, [token]);

  useEffect(() => {
    if (activeTab === "templates" && currentUser) {
      loadTemplates(true);
    }

    if (activeTab === "users" && currentUser?.role === "admin") {
      loadUsers();
    }
  }, [activeTab, currentUser]);

  const onLogin = async (event) => {
    event.preventDefault();
    setAuthMessage("");

    try {
      const response = await api.login(loginForm);
      localStorage.setItem("auth_token", response.token);
      setToken(response.token);
      setLoginForm(defaultLogin);
    } catch (error) {
      setAuthMessage(formatError(error));
    }
  };

  const onLogout = () => {
    localStorage.removeItem("auth_token");
    setApiToken("");
    setToken("");
    setCurrentUser(null);
    setContacts([]);
    setTemplates([]);
    setSingleSendForm(defaultSingleSendForm);
    setBulkSendForm(defaultBulkSendForm);
    setUsers([]);
    setActiveTab("dashboard");
  };

  const onCreateContact = async (event) => {
    event.preventDefault();
    try {
      await api.createContact(contactForm);
      setContactForm(defaultContact);
      await loadContacts(contactQuery);
    } catch (error) {
      setImportResult(formatError(error));
    }
  };

  const onDeleteContact = async (id) => {
    try {
      await api.deleteContact(id);
      await loadContacts(contactQuery);
    } catch (error) {
      setImportResult(formatError(error));
    }
  };

  const onImportContacts = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const result = await api.importContacts(file);
      setImportResult(`Import tamamlandı: ${result.imported} satır işlendi`);
      await loadContacts(contactQuery);
    } catch (error) {
      setImportResult(formatError(error));
    } finally {
      event.target.value = "";
    }
  };

  const onDeleteTemplate = async (id) => {
    try {
      await api.deleteTemplate(id);
      if (expandedTemplateId === id) {
        setExpandedTemplateId("");
      }
      await loadTemplates();
    } catch (error) {
      setTemplateActionResult(formatError(error));
    }
  };

  const onCreateTemplate = async (event) => {
    event.preventDefault();

    try {
      const response = await api.createTemplate(templateForm);
      setTemplateActionResult(response?.message || "Template oluşturuldu");
      setTemplateForm(defaultTemplateForm);
      await loadTemplates(true);
    } catch (error) {
      setTemplateActionResult(formatError(error));
    }
  };

  const onChangeTemplateHeaderType = (value) => {
    const headerType = String(value || "none");
    setTemplateForm((current) => ({
      ...current,
      headerType,
      headerText: headerType === "text" ? current.headerText : "",
      headerMediaHandle: ["image", "video", "document"].includes(headerType) ? current.headerMediaHandle : ""
    }));
    setTemplateMediaFile(null);
  };

  const onUploadTemplateMedia = async () => {
    if (!templateMediaFile) {
      setTemplateActionResult("Önce bir dosya seçin");
      return;
    }

    try {
      setTemplateMediaUploading(true);
      const uploaded = await api.uploadTemplateMedia(templateMediaFile, templateForm.headerType);
      setTemplateForm((current) => ({
        ...current,
        headerMediaHandle: uploaded.handle || ""
      }));
      setTemplateActionResult("Medya yüklendi, handle otomatik dolduruldu");
    } catch (error) {
      setTemplateActionResult(formatError(error));
    } finally {
      setTemplateMediaUploading(false);
    }
  };

  const onToggleTemplateDetail = (id) => {
    setExpandedTemplateId((current) => (current === id ? "" : id));
  };

  const onImportTemplatesFromMeta = async () => {
    try {
      setTemplateActionResult("Meta template'ler çekiliyor...");
      const result = await api.importTemplatesFromMeta();
      setTemplateActionResult(
        `Meta import tamamlandı: toplam ${result.totalMetaTemplates}, yeni ${result.created}, güncellenen ${result.updated}, atlanan ${result.skipped}`
      );
      await loadTemplates(false);
    } catch (error) {
      setTemplateActionResult(formatError(error));
    }
  };

  const onToggleBulkContact = (contactId) => {
    setBulkSendForm((current) => {
      const exists = current.contactIds.includes(contactId);
      return {
        ...current,
        contactIds: exists
          ? current.contactIds.filter((id) => id !== contactId)
          : [...current.contactIds, contactId]
      };
    });
  };

  const onSelectAllBulkContacts = () => {
    setBulkSendForm((current) => ({
      ...current,
      contactIds: contacts.map((item) => item._id)
    }));
  };

  const onClearBulkContacts = () => {
    setBulkSendForm((current) => ({
      ...current,
      contactIds: []
    }));
  };

  const onSendSingleMessage = async (event) => {
    event.preventDefault();
    setSendResult("");

    try {
      const variables = JSON.parse(singleSendForm.variablesJson || "{}");
      const resolvedPhone = selectedSingleContact?.phone || singleSendForm.phone;

      if (!resolvedPhone) {
        setSendResult("Lütfen bir contact seçin veya telefon numarası girin");
        return;
      }

      const payload = {
        phone: resolvedPhone,
        templateId: singleSendForm.templateId,
        mediaUrl: singleSendForm.mediaUrl,
        variables
      };
      const response = await api.sendSingle(payload);
      setSendResult(JSON.stringify(response, null, 2));
      await loadMessageStats();
    } catch (error) {
      setSendResult(formatError(error));
    }
  };

  const onSendBulkMessage = async (event) => {
    event.preventDefault();
    setSendResult("");

    try {
      if (!bulkSendForm.contactIds.length) {
        setSendResult("Toplu gönderim için en az bir contact seçin");
        return;
      }

      const variables = JSON.parse(bulkSendForm.variablesJson || "{}");
      const payload = {
        contactIds: bulkSendForm.contactIds,
        templateId: bulkSendForm.templateId,
        mediaUrl: bulkSendForm.mediaUrl,
        variables
      };

      const response = await api.sendBulk(payload);
      setSendResult(JSON.stringify(response, null, 2));
      await loadMessageStats();
    } catch (error) {
      setSendResult(formatError(error));
    }
  };

  const onLoadLogs = async () => {
    try {
      const response = await api.getLogs();
      setLogsResult(JSON.stringify(response, null, 2));
      await loadMessageStats();
    } catch (error) {
      setLogsResult(formatError(error));
    }
  };

  const onCreateUser = async (event) => {
    event.preventDefault();

    try {
      await api.createUser(newUserForm);
      setNewUserForm(defaultNewUser);
      setUserActionResult("Kullanıcı oluşturuldu");
      await loadUsers();
    } catch (error) {
      setUserActionResult(formatError(error));
    }
  };

  const onDeleteUser = async (id) => {
    try {
      await api.deleteUser(id);
      setUserActionResult("Kullanıcı silindi");
      await loadUsers();
    } catch (error) {
      setUserActionResult(formatError(error));
    }
  };

  const onUpdateProfile = async (event) => {
    event.preventDefault();

    try {
      const response = await api.updateMyProfile(profileForm);
      const user = response.user;
      setCurrentUser(user);
      setProfileForm({
        whatsappToken: user.whatsappToken || "",
        whatsappPhoneId: user.whatsappPhoneId || "",
        whatsappBusinessAccountId: user.whatsappBusinessAccountId || "",
        password: ""
      });
      setProfileResult("Profil güncellendi");
    } catch (error) {
      setProfileResult(formatError(error));
    }
  };

  let backendStatusLabel = "Kontrol ediliyor";

  if (health === "ok") {
    backendStatusLabel = "Bağlı";
  } else if (health === "error") {
    backendStatusLabel = "Bağlantı Hatası";
  }

  if (!currentUser) {
    return (
      <div className="app-container">
        <section className="panel auth-panel">
          <h1>Giriş</h1>
          <p>Backend: {backendStatusLabel}</p>
          <form onSubmit={onLogin} className="form">
            <input
              placeholder="Kullanıcı adı"
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Şifre"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              required
            />
            <button type="submit">Giriş Yap</button>
          </form>
          {authMessage && <p className="info">{authMessage}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>WhatsApp Bulk Messaging</h1>
        <div className="row">
          <p>
            {currentUser.username} ({currentUser.role}) • Backend: {backendStatusLabel}
          </p>
          <button type="button" onClick={onLogout}>Çıkış</button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {activeTab === "dashboard" && (
        <section className="panel grid-4">
          <div className="card"><h3>Toplam Kişi</h3><strong>{metrics.totalContacts}</strong></div>
          <div className="card"><h3>Toplam Şablon</h3><strong>{metrics.totalTemplates}</strong></div>
          <div className="card"><h3>Toplam Mesaj</h3><strong>{metrics.totalMessages}</strong></div>
          <div className="card"><h3>Başarı Oranı</h3><strong>%{metrics.successRate}</strong></div>
        </section>
      )}

      {activeTab === "contacts" && (
        <section className="panel two-col">
          <div>
            <h2>Contact Ekle</h2>
            <form onSubmit={onCreateContact} className="form">
              <input placeholder="Ad" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
              <input placeholder="Telefon" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} required />
              <input placeholder="Tag" value={contactForm.tag} onChange={(event) => setContactForm({ ...contactForm, tag: event.target.value })} />
              <button type="submit">Kaydet</button>
            </form>

            <h3>CSV / Excel Import</h3>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={onImportContacts} />
            <div className="links">
              <a href={api.getTemplateDownloadUrl("csv")} target="_blank" rel="noreferrer">CSV Şablonu</a>
              <a href={api.getTemplateDownloadUrl("xlsx")} target="_blank" rel="noreferrer">Excel Şablonu</a>
            </div>
            {importResult && <p className="info">{importResult}</p>}
          </div>

          <div>
            <h2>Kişiler</h2>
            <div className="row">
              <input placeholder="Ara (name/phone/tag)" value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} />
              <button type="button" onClick={() => loadContacts(contactQuery)}>Filtrele</button>
            </div>
            {contactsLoading ? <p>Yükleniyor...</p> : (
              <ul className="list">
                {contacts.map((item) => (
                  <li key={item._id}>
                    <span>{item.name || "-"} • {item.phone} • {item.tag || "-"}</span>
                    <button type="button" onClick={() => onDeleteContact(item._id)}>Sil</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeTab === "templates" && (
        <section className="panel two-col">
          <div>
            <h2>Template Oluştur</h2>
            <form onSubmit={onCreateTemplate} className="form">
              <input
                placeholder="Template adı"
                value={templateForm.name}
                onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })}
                maxLength={200}
                required
              />
              <div className="row">
                <select
                  value={templateForm.category}
                  onChange={(event) => setTemplateForm({ ...templateForm, category: event.target.value })}
                >
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
                <select
                  value={templateForm.language}
                  onChange={(event) => setTemplateForm({ ...templateForm, language: event.target.value })}
                >
                  <option value="tr">tr</option>
                  <option value="en">en</option>
                </select>
              </div>

              <label className="row" style={{ alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={templateForm.publishToMeta}
                  onChange={(event) => setTemplateForm({ ...templateForm, publishToMeta: event.target.checked })}
                />
                <span>Meta'ya gönder (kapatılırsa sadece local kaydedilir)</span>
              </label>

              <select value={templateForm.headerType} onChange={(event) => onChangeTemplateHeaderType(event.target.value)}>
                <option value="none">Header yok</option>
                <option value="text">Header: Text</option>
                <option value="image">Header: Image</option>
                <option value="video">Header: Video</option>
                <option value="document">Header: Document</option>
              </select>

              {templateForm.headerType === "text" && (
                <input
                  placeholder="Header metni (opsiyonel değişken: {{name}})"
                  value={templateForm.headerText}
                  onChange={(event) => setTemplateForm({ ...templateForm, headerText: event.target.value })}
                  required
                />
              )}

              {["image", "video", "document"].includes(templateForm.headerType) && (
                <>
                  <input
                    type="file"
                    onChange={(event) => setTemplateMediaFile(event.target.files?.[0] || null)}
                  />
                  <div className="row">
                    <button type="button" onClick={onUploadTemplateMedia} disabled={templateMediaUploading}>
                      {templateMediaUploading ? "Yükleniyor..." : "Medyayı Yükle"}
                    </button>
                  </div>
                  <input
                    placeholder="Media handle (otomatik dolar, gerekirse manuel yazılabilir)"
                    value={templateForm.headerMediaHandle}
                    onChange={(event) => setTemplateForm({ ...templateForm, headerMediaHandle: event.target.value })}
                    required
                  />
                </>
              )}

              <textarea
                placeholder="Mesaj metni (örn: Merhaba {{name}} siparişiniz hazır)"
                value={templateForm.content}
                onChange={(event) => setTemplateForm({ ...templateForm, content: event.target.value })}
                required
              />

              <input
                placeholder="Footer metni (opsiyonel)"
                value={templateForm.footerText}
                onChange={(event) => setTemplateForm({ ...templateForm, footerText: event.target.value })}
              />

              <button type="submit">Template Oluştur</button>
            </form>
            <p className="hint">Medya header için Meta'nın döndürdüğü media handle değeri gerekir.</p>
          </div>

          <div>
            <div className="row">
              <h2>Template Listesi</h2>
              <button type="button" onClick={onImportTemplatesFromMeta}>Meta'dan Çek</button>
            </div>
            {templateActionResult && <p className="info">{templateActionResult}</p>}
            {templatesLoading ? <p>Yükleniyor...</p> : (
              <ul className="list template-list">
                {templates.map((item) => (
                  <li key={item._id} className="template-item">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span>
                        {item.name} • {item.language} • {item.category || "UTILITY"} •
                        <span className={`status-badge status-${item.status || "pending"}`}>{item.status || "pending"}</span>
                        {item.metaStatus ? ` • Meta: ${item.metaStatus}` : ""}
                      </span>
                      <small>{item.metaCreatedAt ? new Date(item.metaCreatedAt).toLocaleString("tr-TR") : "-"}</small>
                    </div>
                    <div className="row">
                      <button type="button" onClick={() => onToggleTemplateDetail(item._id)}>
                        {expandedTemplateId === item._id ? "Detayı Gizle" : "Detay"}
                      </button>
                      <button type="button" onClick={() => onDeleteTemplate(item._id)}>Sil</button>
                    </div>
                    {expandedTemplateId === item._id && (
                      <pre className="info">{[
                        `Header Type: ${item.headerType || "none"}`,
                        item.headerText ? `Header Text: ${item.headerText}` : "",
                        item.footerText ? `Footer: ${item.footerText}` : "",
                        `Body: ${item.content || ""}`
                      ].filter(Boolean).join("\n")}</pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeTab === "send" && (
        <section className="panel two-col">
          <div>
            <h2>Tekli Gönderim</h2>
            <form onSubmit={onSendSingleMessage} className="form">
              <select
                value={singleSendForm.contactId}
                onChange={(event) => setSingleSendForm({ ...singleSendForm, contactId: event.target.value })}
              >
                <option value="">Contact seç (opsiyonel)</option>
                {contacts.map((item) => <option key={item._id} value={item._id}>{item.name || item.phone} • {item.phone}</option>)}
              </select>
              <input
                placeholder="Telefon"
                value={selectedSingleContact?.phone || singleSendForm.phone}
                onChange={(event) => setSingleSendForm({ ...singleSendForm, contactId: "", phone: event.target.value })}
                required
              />
              <select value={singleSendForm.templateId} onChange={(event) => setSingleSendForm({ ...singleSendForm, templateId: event.target.value })} required>
                <option value="">Template seç</option>
                {templates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
              {isMediaHeaderTemplate(selectedSingleTemplate) && (
                <input
                  placeholder="Media URL (header image/video/document için zorunlu)"
                  value={singleSendForm.mediaUrl}
                  onChange={(event) => setSingleSendForm({ ...singleSendForm, mediaUrl: event.target.value })}
                  required
                />
              )}
              <textarea value={singleSendForm.variablesJson} onChange={(event) => setSingleSendForm({ ...singleSendForm, variablesJson: event.target.value })} />
              <button type="submit">Gönder</button>
            </form>
          </div>

          <div>
            <h2>Toplu Gönderim</h2>
            <form onSubmit={onSendBulkMessage} className="form">
              <select value={bulkSendForm.templateId} onChange={(event) => setBulkSendForm({ ...bulkSendForm, templateId: event.target.value })} required>
                <option value="">Template seç</option>
                {templates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
              {isMediaHeaderTemplate(selectedBulkTemplate) && (
                <input
                  placeholder="Media URL (header image/video/document için zorunlu)"
                  value={bulkSendForm.mediaUrl}
                  onChange={(event) => setBulkSendForm({ ...bulkSendForm, mediaUrl: event.target.value })}
                  required
                />
              )}
              <textarea value={bulkSendForm.variablesJson} onChange={(event) => setBulkSendForm({ ...bulkSendForm, variablesJson: event.target.value })} />
              <div className="row">
                <button type="button" onClick={onSelectAllBulkContacts}>Tümünü Seç</button>
                <button type="button" onClick={onClearBulkContacts}>Seçimi Temizle</button>
              </div>
              <div className="list contact-select-list">
                {contacts.map((item) => (
                  <label key={item._id} className="contact-select-item">
                    <input
                      type="checkbox"
                      checked={bulkSendForm.contactIds.includes(item._id)}
                      onChange={() => onToggleBulkContact(item._id)}
                    />
                    <span>{item.name || "-"} • {item.phone}</span>
                  </label>
                ))}
              </div>
              <button type="submit">Toplu Gönder ({bulkSendForm.contactIds.length})</button>
            </form>
            {sendResult && <pre className="info">{sendResult}</pre>}
          </div>
        </section>
      )}

      {activeTab === "logs" && (
        <section className="panel">
          <h2>Logs</h2>
          <button type="button" onClick={onLoadLogs}>Logları Getir</button>
          {logsResult && <pre className="info">{logsResult}</pre>}
        </section>
      )}

      {activeTab === "profile" && (
        <section className="panel">
          <h2>Profil ve WhatsApp Ayarları</h2>
          <form onSubmit={onUpdateProfile} className="form">
            <input
              placeholder="WHATSAPP_TOKEN"
              value={profileForm.whatsappToken}
              onChange={(event) => setProfileForm({ ...profileForm, whatsappToken: event.target.value })}
            />
            <input
              placeholder="WHATSAPP_PHONE_ID"
              value={profileForm.whatsappPhoneId}
              onChange={(event) => setProfileForm({ ...profileForm, whatsappPhoneId: event.target.value })}
            />
            <input
              placeholder="WHATSAPP_BUSINESS_ACCOUNT_ID"
              value={profileForm.whatsappBusinessAccountId}
              onChange={(event) => setProfileForm({ ...profileForm, whatsappBusinessAccountId: event.target.value })}
            />
            <input
              type="password"
              placeholder="Yeni şifre (opsiyonel)"
              value={profileForm.password}
              onChange={(event) => setProfileForm({ ...profileForm, password: event.target.value })}
            />
            <button type="submit">Kaydet</button>
          </form>
          {profileResult && <p className="info">{profileResult}</p>}
        </section>
      )}

      {activeTab === "users" && currentUser?.role === "admin" && (
        <section className="panel two-col">
          <div>
            <h2>Kullanıcı Ekle</h2>
            <form onSubmit={onCreateUser} className="form">
              <input
                placeholder="Kullanıcı adı"
                value={newUserForm.username}
                onChange={(event) => setNewUserForm({ ...newUserForm, username: event.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Şifre"
                value={newUserForm.password}
                onChange={(event) => setNewUserForm({ ...newUserForm, password: event.target.value })}
                required
              />
              <select
                value={newUserForm.role}
                onChange={(event) => setNewUserForm({ ...newUserForm, role: event.target.value })}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit">Kullanıcı Oluştur</button>
            </form>
            {userActionResult && <p className="info">{userActionResult}</p>}
          </div>

          <div>
            <h2>Kullanıcı Listesi</h2>
            <button type="button" onClick={loadUsers}>Yenile</button>
            {usersLoading ? <p>Yükleniyor...</p> : (
              <ul className="list">
                {users.map((item) => (
                  <li key={item.id}>
                    <span>{item.username} • {item.role}</span>
                    <button type="button" onClick={() => onDeleteUser(item.id)}>Sil</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
