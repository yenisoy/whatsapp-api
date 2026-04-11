const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

let authToken = "";

export const setApiToken = (token) => {
  authToken = token || "";
};

const buildHeaders = (extraHeaders = {}) => {
  const headers = { ...extraHeaders };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
};

const parseResponse = async (response) => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || `Request failed with ${response.status}`);
  }

  return data;
};

export const api = {
  async login(payload) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async me() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async health() {
    const response = await fetch(`${API_BASE_URL}/health`);
    return parseResponse(response);
  },

  async getContacts(query = "") {
    const response = await fetch(`${API_BASE_URL}/contacts${query}`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async createContact(payload) {
    const response = await fetch(`${API_BASE_URL}/contacts`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async deleteContact(id) {
    const response = await fetch(`${API_BASE_URL}/contacts/${id}`, {
      method: "DELETE",
      headers: buildHeaders()
    });
    if (!response.ok) {
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      throw new Error(data?.message || `Request failed with ${response.status}`);
    }
    return true;
  },

  async importContacts(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/contacts/import`, {
      method: "POST",
      headers: buildHeaders(),
      body: formData
    });

    return parseResponse(response);
  },

  getTemplateDownloadUrl(format) {
    return `${API_BASE_URL}/contacts/import/template?format=${format}`;
  },

  async downloadTemplateImport(format = "csv") {
    const response = await fetch(`${API_BASE_URL}/contacts/import/template?format=${encodeURIComponent(format)}`, {
      headers: buildHeaders()
    });

    if (!response.ok) {
      const text = await response.text();
      let message = `Request failed with ${response.status}`;

      if (text) {
        try {
          const data = JSON.parse(text);
          message = data?.message || message;
        } catch {
          message = text;
        }
      }

      throw new Error(message);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition") || "";
    const fileNameMatch = /filename=([^;]+)/i.exec(contentDisposition);
    const fileName = fileNameMatch?.[1]?.replaceAll('"', "") || `contact-import-template.${format === "xlsx" || format === "xls" ? "xlsx" : "csv"}`;

    const downloadUrl = globalThis.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    globalThis.URL.revokeObjectURL(downloadUrl);

    return true;
  },

  async downloadContactsExport({ format = "csv", q = "", tags = [] } = {}) {
    const params = new URLSearchParams();

    params.set("format", format);

    if (q) {
      params.set("q", q);
    }

    if (Array.isArray(tags) && tags.length > 0) {
      params.set("tags", tags.join(","));
    }

    const response = await fetch(`${API_BASE_URL}/contacts/export?${params.toString()}`, {
      headers: buildHeaders()
    });

    if (!response.ok) {
      const text = await response.text();
      let message = `Request failed with ${response.status}`;

      if (text) {
        try {
          const data = JSON.parse(text);
          message = data?.message || message;
        } catch {
          message = text;
        }
      }

      throw new Error(message);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition") || "";
    const fileNameMatch = /filename=([^;]+)/i.exec(contentDisposition);
    const fileName = fileNameMatch?.[1]?.replaceAll('"', "") || `contacts-export.${format === "xlsx" || format === "xls" ? "xlsx" : "csv"}`;

    const downloadUrl = globalThis.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    globalThis.URL.revokeObjectURL(downloadUrl);

    return true;
  },

  async getTemplates(options = {}) {
    const syncMeta = options?.syncMeta ? "?syncMeta=true" : "";
    const response = await fetch(`${API_BASE_URL}/templates${syncMeta}`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async importTemplatesFromMeta() {
    const response = await fetch(`${API_BASE_URL}/templates/import-meta`, {
      method: "POST",
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async uploadTemplateMedia(file, mediaType = "") {
    const formData = new FormData();
    formData.append("file", file);

    const query = mediaType ? `?mediaType=${encodeURIComponent(mediaType)}` : "";

    const response = await fetch(`${API_BASE_URL}/templates/media/upload${query}`, {
      method: "POST",
      headers: buildHeaders(),
      body: formData
    });

    return parseResponse(response);
  },

  async createTemplate(payload) {
    const response = await fetch(`${API_BASE_URL}/templates`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async deleteTemplate(id) {
    const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
      method: "DELETE",
      headers: buildHeaders()
    });
    if (!response.ok) {
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      throw new Error(data?.message || `Request failed with ${response.status}`);
    }
    return true;
  },

  async publishTemplateToMeta(id, category = "UTILITY") {
    const response = await fetch(`${API_BASE_URL}/templates/${id}/publish-meta`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ category })
    });
    return parseResponse(response);
  },

  async syncTemplateMetaStatus(id) {
    const response = await fetch(`${API_BASE_URL}/templates/${id}/sync-meta`, {
      method: "POST",
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async previewVariables(content) {
    const response = await fetch(`${API_BASE_URL}/templates/preview/variables`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ content })
    });
    return parseResponse(response);
  },

  async sendSingle(payload) {
    const response = await fetch(`${API_BASE_URL}/send`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async sendBatch(payload) {
    const response = await fetch(`${API_BASE_URL}/send/batch`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async getConversations(query = "") {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    const response = await fetch(`${API_BASE_URL}/conversations${suffix}`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async getConversationMessages(conversationId, options = {}) {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }
    if (options?.before) {
      params.set("before", String(options.before));
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages${query}`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async sendConversationMessage(conversationId, payload) {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async markConversationRead(conversationId) {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/read`, {
      method: "POST",
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async getLogs() {
    const response = await fetch(`${API_BASE_URL}/logs`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async getLogStats() {
    const response = await fetch(`${API_BASE_URL}/logs/stats`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async getUsers() {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async createUser(payload) {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async deleteUser(id) {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: "DELETE",
      headers: buildHeaders()
    });

    if (!response.ok) {
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      throw new Error(data?.message || `Request failed with ${response.status}`);
    }

    return true;
  },

  async updateMyProfile(payload) {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: "PUT",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async regenerateMyWebhookToken() {
    const response = await fetch(`${API_BASE_URL}/users/me/webhook-token/regenerate`, {
      method: "POST",
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async getSystemSettings() {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async updateSystemSettings(payload) {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: "PUT",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  },

  async getMyMedia() {
    const response = await fetch(`${API_BASE_URL}/users/me/media`, {
      headers: buildHeaders()
    });
    return parseResponse(response);
  },

  async uploadMyMedia({ file = null, sourceUrl = "" } = {}) {
    const formData = new FormData();

    if (file) {
      formData.append("file", file);
    }

    if (sourceUrl) {
      formData.append("sourceUrl", sourceUrl);
    }

    const response = await fetch(`${API_BASE_URL}/users/me/media`, {
      method: "POST",
      headers: buildHeaders(),
      body: formData
    });

    return parseResponse(response);
  },

  async deleteMyMedia() {
    const response = await fetch(`${API_BASE_URL}/users/me/media`, {
      method: "DELETE",
      headers: buildHeaders()
    });

    if (!response.ok) {
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      throw new Error(data?.message || `Request failed with ${response.status}`);
    }

    return true;
  }
};
