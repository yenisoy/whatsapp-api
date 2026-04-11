import React, { useEffect, useMemo, useRef, useState } from "react";
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
const defaultGroupSendForm = { templateId: "", mediaUrl: "", variablesJson: '{"name":"Ahmet"}', contactIds: [] };
const contactPageSizeOptions = [10, 50, 100, 1000, 10000];

const formatError = (error) => error?.message || "Beklenmeyen bir hata oluştu";

const getStoredToken = () => localStorage.getItem("auth_token") || "";

const compareTemplatesByMetaOrder = (first, second) => {
  const firstLocal = new Date(first?.createdAt || 0).getTime();
  const secondLocal = new Date(second?.createdAt || 0).getTime();
  return secondLocal - firstLocal;
};

const getContactInitials = (contact = {}) => {
  const name = String(contact?.name || "").trim();
  const phone = String(contact?.phone || "").trim();

  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = parts[1]?.[0] || parts[0]?.[1] || "";
    return `${first}${second}`.trim().toUpperCase() || first.toUpperCase();
  }

  if (phone) {
    return phone.slice(-2);
  }

  return "?";
};

const getContactAvatarStyle = (contact = {}) => {
  const seed = String(contact?.name || contact?.phone || "contact");
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + (seed.codePointAt(index) || 0)) % 360;
  }

  return {
    background: `linear-gradient(135deg, hsl(${hash} 82% 56%) 0%, hsl(${(hash + 28) % 360} 82% 44%) 100%)`
  };
};

function App() { // NOSONAR
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
  const [contactActionResult, setContactActionResult] = useState("");
  const [contactTagFilters, setContactTagFilters] = useState([]);
  const [contactPage, setContactPage] = useState(1);
  const [contactPageSize, setContactPageSize] = useState(10);

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateActionResult, setTemplateActionResult] = useState("");
  const [expandedTemplateId, setExpandedTemplateId] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateLanguageFilter, setTemplateLanguageFilter] = useState("all");
  const [templateHeaderTypeFilter, setTemplateHeaderTypeFilter] = useState("all");
  const [templateStatusFilter, setTemplateStatusFilter] = useState("all");
  const [templateForm, setTemplateForm] = useState(defaultTemplateForm);
  const [templateMediaFile, setTemplateMediaFile] = useState(null);
  const [templateMediaUploading, setTemplateMediaUploading] = useState(false);

  const [singleSendForm, setSingleSendForm] = useState(defaultSingleSendForm);
  const [groupSendForm, setGroupSendForm] = useState(defaultGroupSendForm);
  const [selectedTags, setSelectedTags] = useState([]);
  const [sendResult, setSendResult] = useState("");

  // Grup gönderim ilerleme durumu
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, success: 0, failed: 0 });
  const [sendLogs, setSendLogs] = useState([]);
  const cancelRef = useRef(false);

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

  const selectedGroupTemplate = useMemo(
    () => templates.find((item) => item._id === groupSendForm.templateId) || null,
    [templates, groupSendForm.templateId]
  );

  const availableTags = useMemo(() => {
    const tagSet = new Set();
    contacts.forEach((c) => {
      if (c.tag?.trim()) tagSet.add(c.tag.trim());
    });
    return Array.from(tagSet).sort((first, second) => first.localeCompare(second, "tr"));
  }, [contacts]);

  const filteredGroupContacts = useMemo(() => {
    if (selectedTags.length === 0) return contacts;
    return contacts.filter((c) => selectedTags.includes(c.tag?.trim()));
  }, [contacts, selectedTags]);

  const contactStats = useMemo(() => {
    const taggedContacts = contacts.filter((contact) => contact?.tag?.trim()).length;
    return {
      total: contacts.length,
      tagged: taggedContacts,
      untagged: contacts.length - taggedContacts
    };
  }, [contacts]);

  let contactListSubtitle = "Tüm kayıtlar";

  if (contactTagFilters.length > 0) {
    contactListSubtitle = `${contactTagFilters.length} tag filtresi aktif`;
  } else if (contactQuery) {
    contactListSubtitle = `Arama: ${contactQuery}`;
  }

  const filteredContacts = useMemo(() => {
    const normalizedQuery = contactQuery.trim().toLowerCase();

    return contacts.filter((contact) => {
      const matchesTags = contactTagFilters.length === 0 || contactTagFilters.includes(contact?.tag?.trim());

      if (!matchesTags) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [contact?.name, contact?.phone, contact?.tag]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(normalizedQuery);
    });
  }, [contactQuery, contactTagFilters, contacts]);

  const contactTotalPages = Math.max(1, Math.ceil(filteredContacts.length / contactPageSize));
  const safeContactPage = Math.min(contactPage, contactTotalPages);

  const paginatedContacts = useMemo(() => {
    const start = (safeContactPage - 1) * contactPageSize;
    return filteredContacts.slice(start, start + contactPageSize);
  }, [contactPageSize, filteredContacts, safeContactPage]);

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesLanguage = templateLanguageFilter === "all" || String(template.language || "").toLowerCase() === templateLanguageFilter;
      const normalizedHeaderType = String(template.headerType || "none").toLowerCase();
      const matchesHeaderType = templateHeaderTypeFilter === "all" || normalizedHeaderType === templateHeaderTypeFilter;
      const matchesStatus = templateStatusFilter === "all" || String(template.status || "pending").toLowerCase() === templateStatusFilter;

      if (!matchesLanguage || !matchesHeaderType || !matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [template.name, template.category, template.language, template.status, template.metaStatus, template.content, template.footerText, template.headerText]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [templateHeaderTypeFilter, templateLanguageFilter, templateSearch, templateStatusFilter, templates]);

  const isMediaHeaderTemplate = (template) => ["image", "video", "document"].includes(String(template?.headerType || "").toLowerCase());

  useEffect(() => {
    setContactPage(1);
  }, [contactQuery, contactTagFilters, contactPageSize]);

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
    setGroupSendForm(defaultGroupSendForm);
    setSelectedTags([]);
    setUsers([]);
    setActiveTab("dashboard");
  };

  const onCreateContact = async (event) => {
    event.preventDefault();
    try {
      await api.createContact(contactForm);
      setContactForm(defaultContact);
      await loadContacts();
      setContactActionResult("Contact eklendi");
    } catch (error) {
      setContactActionResult(formatError(error));
    }
  };

  const onDeleteContact = async (id) => {
    try {
      await api.deleteContact(id);
      await loadContacts();
      setContactActionResult("Contact silindi");
    } catch (error) {
      setContactActionResult(formatError(error));
    }
  };

  const onClearContactSearch = async () => {
    setContactQuery("");
    setContactTagFilters([]);
    setContactPage(1);
  };

  const onToggleContactTag = (tag) => {
    setContactTagFilters((current) => (
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    ));
  };

  const onClearContactTags = () => {
    setContactTagFilters([]);
  };

  const onExportContacts = async (format) => {
    try {
      await api.downloadContactsExport({
        format,
        q: contactQuery.trim(),
        tags: contactTagFilters
      });
      setContactActionResult(`${format.toUpperCase()} dışa aktarım tamamlandı`);
    } catch (error) {
      setContactActionResult(formatError(error));
    }
  };

  let contactListContent;

  if (contactsLoading) {
    contactListContent = <div className="empty-state"><p>Yükleniyor...</p></div>;
  } else if (paginatedContacts.length > 0) {
    contactListContent = (
      <ul className="list contact-list">
        {paginatedContacts.map((item) => (
          <li key={item._id} className="contact-list-item">
            <div className="contact-avatar" style={getContactAvatarStyle(item)} aria-hidden="true">
              {getContactInitials(item)}
            </div>
            <div className="contact-meta">
              <div className="contact-name-row">
                <strong>{item.name || "İsimsiz"}</strong>
                {item.tag && <span className="contact-tag-badge">{item.tag}</span>}
              </div>
              <span className="contact-phone">{item.phone}</span>
            </div>
            <button type="button" className="delete-action" onClick={() => onDeleteContact(item._id)}>Sil</button>
          </li>
        ))}
      </ul>
    );
  } else {
    contactListContent = (
      <div className="empty-state">
        <h4>{contacts.length > 0 ? "Eşleşen kişi bulunamadı" : "Henüz kişi yok"}</h4>
        <p>{contacts.length > 0 ? "Filtreleri temizleyip tekrar deneyin." : "Yeni kişi ekleyebilir veya CSV / Excel şablonu ile içe aktarabilirsiniz."}</p>
      </div>
    );
  }

  const sendLogItems = sendLogs.map((log, idx) => {
    let logStatusIcon = "⚠";

    if (log.status === "success") {
      logStatusIcon = "✓";
    } else if (log.status === "failed") {
      logStatusIcon = "✗";
    }

    const logKey = log._id || `${log.phone || "log"}-${log.createdAt || idx}`;

    return (
      <div key={logKey} className={`send-log-item ${log.status}`}>
        <span className="send-log-status">{logStatusIcon}</span>
        <span>{log.name || log.phone} • {log.phone}</span>
        <span className="send-log-msg">{log.message}</span>
      </div>
    );
  });

  const onImportContacts = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const result = await api.importContacts(file);
      setImportResult(`Import tamamlandı: ${result.imported} satır işlendi`);
      await loadContacts();
    } catch (error) {
      setImportResult(formatError(error));
    } finally {
      event.target.value = "";
    }
  };

  const onDownloadContactTemplate = async (format) => {
    try {
      await api.downloadTemplateImport(format);
      setImportResult(`${format.toUpperCase()} şablonu indirildi`);
    } catch (error) {
      setImportResult(formatError(error));
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

  const onToggleTag = (tag) => {
    setSelectedTags((current) => {
      const newTags = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return newTags;
    });
  };

  // Tag değiştiğinde contactları otomatik seç
  useEffect(() => {
    if (selectedTags.length === 0) {
      setGroupSendForm((current) => ({ ...current, contactIds: [] }));
      return;
    }
    const matched = contacts
      .filter((c) => selectedTags.includes(c.tag?.trim()))
      .map((c) => c._id);
    setGroupSendForm((current) => ({ ...current, contactIds: matched }));
  }, [selectedTags, contacts]);

  const onToggleGroupContact = (contactId) => {
    setGroupSendForm((current) => {
      const exists = current.contactIds.includes(contactId);
      return {
        ...current,
        contactIds: exists
          ? current.contactIds.filter((id) => id !== contactId)
          : [...current.contactIds, contactId]
      };
    });
  };

  const onSelectAllGroupContacts = () => {
    setGroupSendForm((current) => ({
      ...current,
      contactIds: filteredGroupContacts.map((item) => item._id)
    }));
  };

  const onClearGroupContacts = () => {
    setGroupSendForm((current) => ({ ...current, contactIds: [] }));
    setSelectedTags([]);
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

  const onCancelSending = () => {
    cancelRef.current = true;
  };

  const onSendGroupMessages = async (event) => {
    event.preventDefault();
    setSendResult("");
    setSendLogs([]);

    const selectedIds = groupSendForm.contactIds;
    if (!selectedIds.length) {
      setSendResult("Gönderim için en az bir kişi seçin");
      return;
    }
    if (!groupSendForm.templateId) {
      setSendResult("Template seçin");
      return;
    }

    let variables;
    try {
      variables = JSON.parse(groupSendForm.variablesJson || "{}");
    } catch {
      setSendResult("Variables JSON formatı hatalı");
      return;
    }

    const selectedContacts = contacts.filter((c) => selectedIds.includes(c._id));
    const total = selectedContacts.length;

    setIsSending(true);
    cancelRef.current = false;
    setSendProgress({ sent: 0, total, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < selectedContacts.length; i++) {
      if (cancelRef.current) {
        setSendLogs((prev) => [...prev, { phone: "—", status: "cancelled", message: "Gönderim kullanıcı tarafından durduruldu" }]);
        break;
      }

      const contact = selectedContacts[i];
      const mergedVars = { name: contact.name || "", ...variables };

      try {
        const response = await api.sendSingle({
          phone: contact.phone,
          templateId: groupSendForm.templateId,
          mediaUrl: groupSendForm.mediaUrl || "",
          variables: mergedVars
        });

        successCount++;
        setSendLogs((prev) => [...prev, { phone: contact.phone, name: contact.name, status: "success", message: response.providerMessageId || "OK" }]);
      } catch (error) {
        failedCount++;
        setSendLogs((prev) => [...prev, { phone: contact.phone, name: contact.name, status: "failed", message: formatError(error) }]);
      }

      setSendProgress({ sent: i + 1, total, success: successCount, failed: failedCount });

      // 1 saniye bekle (son mesajdan sonra bekleme)
      if (i < selectedContacts.length - 1 && !cancelRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setIsSending(false);
    await loadMessageStats();
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

  let templateListContent;

  if (templatesLoading) {
    templateListContent = <p>Yükleniyor...</p>;
  } else if (filteredTemplates.length > 0) {
    templateListContent = (
      <ul className="list template-list">
        {filteredTemplates.map((item) => {
          const headerPreview = item.headerType === "text" && item.headerText ? (
            <p className="template-preview-text strong">{item.headerText}</p>
          ) : null;

          const mediaHeaderPreview = isMediaHeaderTemplate(item) ? (
            <div className="template-media-preview">
              <span className="meta-pill">{String(item.headerType || "none").toUpperCase()}</span>
              <p className="template-preview-text">Media handle: {item.headerMediaHandle || "-"}</p>
            </div>
          ) : null;

          const fallbackHeaderPreview = !headerPreview && !mediaHeaderPreview ? (
            <p className="template-preview-text muted">Header yok</p>
          ) : null;

          return (
          <li key={item._id} className="template-item">
            <div className="template-card-top">
              <div className="template-card-title-block">
                <div className="template-card-title-row">
                  <strong>{item.name}</strong>
                  <span className={`status-badge status-${item.status || "pending"}`}>{item.status || "pending"}</span>
                </div>
                <div className="template-chip-row">
                  <span className="meta-pill">{item.language}</span>
                  <span className="meta-pill">{item.category || "UTILITY"}</span>
                  <span className="meta-pill">{String(item.headerType || "none").toUpperCase()}</span>
                  {item.metaStatus ? <span className="meta-pill light">Meta: {item.metaStatus}</span> : null}
                </div>
              </div>
              <small className="template-item-meta">{item.metaCreatedAt ? new Date(item.metaCreatedAt).toLocaleString("tr-TR") : "-"}</small>
            </div>

            <div className="template-body-snippet">
              <p>{item.content || "İçerik yok"}</p>
            </div>

            <div className="template-item-actions template-card-actions">
              <button type="button" onClick={() => onToggleTemplateDetail(item._id)}>
                {expandedTemplateId === item._id ? "Detayı Gizle" : "Detay"}
              </button>
              <button type="button" className="secondary-action" onClick={() => setTemplateForm({
                name: item.name || "",
                category: item.category || "UTILITY",
                language: item.language || "tr",
                publishToMeta: true,
                headerType: item.headerType || "none",
                headerText: item.headerText || "",
                headerMediaHandle: item.headerMediaHandle || "",
                footerText: item.footerText || "",
                content: item.content || ""
              })}>
                Forma Aktar
              </button>
              <button type="button" onClick={() => onDeleteTemplate(item._id)}>Sil</button>
            </div>
            {expandedTemplateId === item._id && (
              <div className="template-detail-card">
                <div className="template-preview-shell template-preview-compact">
                  <div className="template-preview-section template-preview-header">
                    {headerPreview}
                    {mediaHeaderPreview}
                    {fallbackHeaderPreview}
                  </div>

                  <div className="template-preview-section template-preview-body">
                    <p className="template-preview-message">{item.content || "-"}</p>
                  </div>

                  {item.footerText && (
                    <div className="template-preview-section template-preview-footer">
                      <p className="template-preview-text muted">{item.footerText}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </li>
        );
        })}
      </ul>
    );
  } else {
    templateListContent = (
      <div className="empty-state template-empty-state">
        <h4>Template bulunamadı</h4>
        <p>Filtreleri temizleyip tekrar deneyebilirsin.</p>
      </div>
    );
  }

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
        <h1>WhatsApp Mesajlaşma</h1>
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
        <section className="panel contacts-panel">
          <div className="contacts-header">
            <div>
              <h2>Contacts</h2>
              <p className="section-caption">Kişi ekleme, içe aktarma ve liste yönetimi tek ekranda.</p>
            </div>
            <div className="contact-stats">
              <div className="stat-pill"><strong>{contactStats.total}</strong><span>Toplam</span></div>
              <div className="stat-pill"><strong>{contactStats.tagged}</strong><span>Tag’li</span></div>
              <div className="stat-pill"><strong>{contactStats.untagged}</strong><span>Tagsiz</span></div>
            </div>
          </div>

          <div className="contacts-grid">
            <div className="contact-card">
              <div className="card-title-block">
                <h3>Contact Ekle</h3>
                <p>Tekli kayıt oluştur veya mevcut kayıtları güncelle.</p>
              </div>
              <form onSubmit={onCreateContact} className="form compact-form">
                <input placeholder="Ad" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
                <input placeholder="Telefon" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} required />
                <input placeholder="Tag" value={contactForm.tag} onChange={(event) => setContactForm({ ...contactForm, tag: event.target.value })} />
                <button type="submit">Kaydet</button>
              </form>

              <div className="import-box">
                <div className="card-title-block">
                  <h3>CSV / Excel Import</h3>
                  <p>Şablonu indir, dosyanı yükle ve toplu aktarım yap.</p>
                </div>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={onImportContacts} />
                <div className="download-actions">
                  <button type="button" className="secondary-action" onClick={() => onDownloadContactTemplate("csv")}>CSV Şablonu</button>
                  <button type="button" className="secondary-action" onClick={() => onDownloadContactTemplate("xlsx")}>Excel Şablonu</button>
                </div>
              </div>

              {importResult && <p className="info contact-feedback">{importResult}</p>}
            </div>

            <div className="contact-card contact-list-card">
              <div className="card-title-block contact-list-header">
                <div>
                  <h3>Kişiler</h3>
                  <p>{contactListSubtitle}</p>
                </div>
                <div className="list-header-actions">
                  <span className="list-count-badge">{filteredContacts.length} / {contacts.length} kayıt</span>
                  <button type="button" className="secondary-action tiny-action" onClick={() => onExportContacts("csv")} disabled={filteredContacts.length === 0}>CSV Dışa Aktar</button>
                  <button type="button" className="secondary-action tiny-action" onClick={() => onExportContacts("xlsx")} disabled={filteredContacts.length === 0}>Excel Dışa Aktar</button>
                </div>
              </div>

              <div className="tag-filter-box">
                <div className="tag-filter-head">
                  <p>Tag filtreleri</p>
                  <button type="button" className="secondary-action tiny-action" onClick={onClearContactTags} disabled={contactTagFilters.length === 0}>Temizle</button>
                </div>
                {availableTags.length > 0 ? (
                  <div className="tag-chips contact-tag-chips">
                    <button
                      type="button"
                      className={contactTagFilters.length === 0 ? "tag-chip active" : "tag-chip"}
                      onClick={onClearContactTags}
                    >
                      Tümü
                    </button>
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={contactTagFilters.includes(tag) ? "tag-chip active" : "tag-chip"}
                        onClick={() => onToggleContactTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="tag-filter-empty">Tag bulunan kişi yok.</p>
                )}
              </div>

              <div className="search-bar">
                <input
                  placeholder="Ara (name/phone/tag)"
                  value={contactQuery}
                  onChange={(event) => setContactQuery(event.target.value)}
                />
                <button type="button" className="secondary-action" onClick={onClearContactSearch} disabled={!contactQuery && contactTagFilters.length === 0}>Temizle</button>
              </div>

              <div className="pagination-toolbar">
                <div className="page-size-control">
                  <span>Sayfa başına</span>
                  <select value={contactPageSize} onChange={(event) => setContactPageSize(Number(event.target.value))}>
                    {contactPageSizeOptions.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                <div className="pagination-actions">
                  <button type="button" className="secondary-action tiny-action" onClick={() => setContactPage((current) => Math.max(1, current - 1))} disabled={safeContactPage <= 1}>Önceki</button>
                  <span className="page-indicator">{safeContactPage} / {contactTotalPages}</span>
                  <button type="button" className="secondary-action tiny-action" onClick={() => setContactPage((current) => Math.min(contactTotalPages, current + 1))} disabled={safeContactPage >= contactTotalPages}>Sonraki</button>
                </div>
              </div>

              {contactListContent}

              {contactActionResult && <p className="info contact-feedback">{contactActionResult}</p>}
            </div>
          </div>
        </section>
      )}

      {activeTab === "templates" && (
        <section className="panel template-panel">
          <div className="template-header">
            <div>
              <h2>Template Yönetimi</h2>
              <p className="section-caption">Template oluştur, media header yükle ve Meta’dan gelen şablonları filtrele.</p>
            </div>
            <div className="row template-header-actions">
              <button type="button" className="secondary-action" onClick={() => loadTemplates(true)}>Yenile</button>
              <button type="button" onClick={onImportTemplatesFromMeta}>Meta'dan Çek</button>
            </div>
          </div>

          <div className="two-col template-workspace">
            <div className="template-editor-card">
              <div className="card-title-block">
                <h3>Template Oluştur</h3>
                <p>Başlık, gövde, footer ve medya alanlarını tek ekranda düzenle.</p>
              </div>

            <form onSubmit={onCreateTemplate} className="form compact-form">
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
              <div className="template-preview-box">
                <div className="card-title-block">
                  <h3>Canlı Önizleme</h3>
                  <p>Formu değiştir, önizleme anında güncellensin.</p>
                </div>
                <div className="template-preview-meta">
                  <span>{templateForm.name || "Yeni template"}</span>
                  <span>{templateForm.language} • {templateForm.category}</span>
                  <span>{templateForm.headerType === "none" ? "Header yok" : `Header: ${templateForm.headerType}`}</span>
                </div>
                <div className="template-preview-body">
                  {templateForm.headerType === "text" && templateForm.headerText && <p className="preview-block">Header: {templateForm.headerText}</p>}
                  {isMediaHeaderTemplate(templateForm) && <p className="preview-block">Media handle: {templateForm.headerMediaHandle || "bekleniyor"}</p>}
                  <p className="preview-block main-body">{templateForm.content || "Mesaj içeriği burada görünecek"}</p>
                  {templateForm.footerText && <p className="preview-block footer">Footer: {templateForm.footerText}</p>}
                </div>
                <p className="hint">Medya header için Meta’nın döndürdüğü media handle değeri gerekir.</p>
              </div>
            </div>

          <div className="template-list-card">
            <div className="template-list-head">
              <div>
                <h2>Template Listesi</h2>
                <p>{filteredTemplates.length} sonuç / {templates.length} kayıt</p>
              </div>
              <span className="list-count-badge">{templates.length} toplam</span>
            </div>

            <div className="row template-filters" style={{ marginBottom: "12px" }}>
              <input
                placeholder="Ara (isim, içerik, footer...)"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
              />
              <select value={templateLanguageFilter} onChange={(event) => setTemplateLanguageFilter(event.target.value)}>
                <option value="all">Tüm diller</option>
                <option value="tr">tr</option>
                <option value="en">en</option>
                <option value="en_us">en_US</option>
              </select>
              <select value={templateHeaderTypeFilter} onChange={(event) => setTemplateHeaderTypeFilter(event.target.value)}>
                <option value="all">Tüm headerlar</option>
                <option value="none">Header yok</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
              </select>
              <select value={templateStatusFilter} onChange={(event) => setTemplateStatusFilter(event.target.value)}>
                <option value="all">Tüm durumlar</option>
                <option value="approved">approved</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div className="template-filter-summary">
              <span className="meta-pill light">Arama: {templateSearch || "-"}</span>
              <span className="meta-pill light">Dil: {templateLanguageFilter === "all" ? "Tümü" : templateLanguageFilter}</span>
              <span className="meta-pill light">Header: {templateHeaderTypeFilter === "all" ? "Tümü" : templateHeaderTypeFilter}</span>
              <span className="meta-pill light">Durum: {templateStatusFilter === "all" ? "Tümü" : templateStatusFilter}</span>
            </div>
            {templateActionResult && <p className="info">{templateActionResult}</p>}
            {templateListContent}
          </div>
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
            <h2>Grup Gönderim</h2>

            {/* Tag seçimi */}
            {availableTags.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--muted)", fontSize: "13px" }}>Tag ile filtrele:</p>
                <div className="tag-chips">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={selectedTags.includes(tag) ? "tag-chip active" : "tag-chip"}
                      onClick={() => onToggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={onSendGroupMessages} className="form">
              <select
                value={groupSendForm.templateId}
                onChange={(event) => setGroupSendForm({ ...groupSendForm, templateId: event.target.value })}
                disabled={isSending}
                required
              >
                <option value="">Template seç</option>
                {templates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
              {isMediaHeaderTemplate(selectedGroupTemplate) && (
                <input
                  placeholder="Media URL (header image/video/document için zorunlu)"
                  value={groupSendForm.mediaUrl}
                  onChange={(event) => setGroupSendForm({ ...groupSendForm, mediaUrl: event.target.value })}
                  disabled={isSending}
                  required
                />
              )}
              <textarea
                value={groupSendForm.variablesJson}
                onChange={(event) => setGroupSendForm({ ...groupSendForm, variablesJson: event.target.value })}
                disabled={isSending}
                placeholder='Değişkenler (JSON) — örn: {"name":"Ahmet"}'
              />

              <div className="row">
                <button type="button" onClick={onSelectAllGroupContacts} disabled={isSending}>Tümünü Seç</button>
                <button type="button" onClick={onClearGroupContacts} disabled={isSending}>Seçimi Temizle</button>
                <span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--muted)", fontSize: "13px" }}>
                  {groupSendForm.contactIds.length} kişi seçili
                </span>
              </div>

              <div className="list contact-select-list">
                {filteredGroupContacts.map((item) => (
                  <label key={item._id} className="contact-select-item">
                    <input
                      type="checkbox"
                      checked={groupSendForm.contactIds.includes(item._id)}
                      onChange={() => onToggleGroupContact(item._id)}
                      disabled={isSending}
                    />
                    <span>{item.name || "-"} • {item.phone} {item.tag ? `• ${item.tag}` : ""}</span>
                  </label>
                ))}
              </div>

              {/* Gönderim ilerleme alanı */}
              {isSending && (
                <div className="send-progress">
                  <div className="progress-header">
                    <span>Gönderiliyor: {sendProgress.sent} / {sendProgress.total}</span>
                    <button type="button" className="btn-cancel" onClick={onCancelSending}>Durdur</button>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: sendProgress.total > 0 ? `${(sendProgress.sent / sendProgress.total) * 100}%` : "0%" }}
                    />
                  </div>
                  <div className="progress-stats">
                    <span className="stat-success">✓ {sendProgress.success}</span>
                    <span className="stat-failed">✗ {sendProgress.failed}</span>
                  </div>
                </div>
              )}

              {/* İlerleme bittikten sonra özet */}
              {!isSending && sendProgress.total > 0 && (
                <div className="send-progress">
                  <div className="progress-header">
                    <span>Tamamlandı: {sendProgress.sent} / {sendProgress.total}</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill done" style={{ width: "100%" }} />
                  </div>
                  <div className="progress-stats">
                    <span className="stat-success">✓ Başarılı: {sendProgress.success}</span>
                    <span className="stat-failed">✗ Hatalı: {sendProgress.failed}</span>
                    {cancelRef.current && <span style={{ color: "var(--warning)" }}>⚠ Durduruldu</span>}
                  </div>
                </div>
              )}

              {/* Mesaj logları */}
              {sendLogs.length > 0 && (
                <div className="send-log-list">{sendLogItems}</div>
              )}

              {!isSending && (
                <button type="submit" disabled={groupSendForm.contactIds.length === 0}>
                  Gönder ({groupSendForm.contactIds.length} kişi)
                </button>
              )}
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
