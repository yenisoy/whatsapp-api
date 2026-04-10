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

  async sendBulk(payload) {
    const response = await fetch(`${API_BASE_URL}/send/bulk`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
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
  }
};
