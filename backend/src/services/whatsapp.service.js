import axios from "axios";

const getCloudApiConfig = (credentials = {}) => {
  const token = credentials.whatsappToken || process.env.WHATSAPP_TOKEN;
  const phoneId = credentials.whatsappPhoneId || process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    return null;
  }

  return {
    token,
    phoneId,
    url: `https://graph.facebook.com/v18.0/${phoneId}/messages`
  };
};

export const sendWhatsAppText = async ({ phone, text, credentials = {} }) => {
  const config = getCloudApiConfig(credentials);
  const requestBody = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: text }
  };

  if (!config) {
    return {
      success: true,
      mode: "mock",
      providerMessageId: `mock-${Date.now()}`,
      providerStatus: "sent",
      providerRequestUrl: "",
      providerRequestBody: requestBody
    };
  }

  try {
    const response = await axios.post(
      config.url,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    const providerMessageId = response.data?.messages?.[0]?.id || "";

    return {
      success: true,
      mode: "cloud",
      providerMessageId,
      providerStatus: response.data?.messages?.[0]?.message_status || "accepted",
      providerRequestUrl: config.url,
      providerRequestBody: requestBody
    };
  } catch (error) {
    return {
      success: false,
      mode: "cloud",
      error: error.response?.data?.error?.message || error.message,
      providerRequestUrl: config.url,
      providerRequestBody: requestBody
    };
  }
};

export const sendWhatsAppMedia = async ({ phone, mediaType, mediaUrl, credentials = {} }) => {
  const config = getCloudApiConfig(credentials);
  const normalizedType = String(mediaType || "").toLowerCase();
  const url = String(mediaUrl || "").trim();
  const requestBody = {
    messaging_product: "whatsapp",
    to: phone,
    type: normalizedType,
    [normalizedType]: {
      link: url
    }
  };

  if (!["image", "video", "document"].includes(normalizedType)) {
    throw new Error("mediaType must be image, video or document");
  }

  if (!url) {
    throw new Error("mediaUrl is required");
  }

  if (!config) {
    return {
      success: true,
      mode: "mock",
      providerMessageId: `mock-${Date.now()}`,
      providerStatus: "sent",
      providerRequestUrl: "",
      providerRequestBody: requestBody
    };
  }

  try {
    const response = await axios.post(
      config.url,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    const providerMessageId = response.data?.messages?.[0]?.id || "";

    return {
      success: true,
      mode: "cloud",
      providerMessageId,
      providerStatus: response.data?.messages?.[0]?.message_status || "accepted",
      providerRequestUrl: config.url,
      providerRequestBody: requestBody
    };
  } catch (error) {
    return {
      success: false,
      mode: "cloud",
      error: error.response?.data?.error?.message || error.message,
      providerRequestUrl: config.url,
      providerRequestBody: requestBody
    };
  }
};

export const sendWhatsAppTemplate = async ({ phone, templateName, language = "tr", components = [], credentials = {} }) => {
  const config = getCloudApiConfig(credentials);
  const name = String(templateName || "").trim();
  const languageCode = String(language || "tr").trim().toLowerCase() || "tr";
  const componentList = Array.isArray(components) ? components : [];
  const requestBody = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name,
      language: { code: languageCode },
      ...(componentList.length ? { components: componentList } : {})
    }
  };

  if (!name) {
    throw new Error("templateName is required");
  }

  if (!config) {
    return {
      success: true,
      mode: "mock",
      providerMessageId: `mock-${Date.now()}`,
      providerStatus: "sent",
      providerRequestUrl: "",
      providerRequestBody: requestBody
    };
  }

  try {
    const response = await axios.post(
      config.url,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    const providerMessageId = response.data?.messages?.[0]?.id || "";

    return {
      success: true,
      mode: "cloud",
      providerMessageId,
      providerStatus: response.data?.messages?.[0]?.message_status || "accepted",
      providerRequestUrl: config.url,
      providerRequestBody: requestBody
    };
  } catch (error) {
    return {
      success: false,
      mode: "cloud",
      error: error.response?.data?.error?.message || error.message,
      providerRequestUrl: config.url,
      providerRequestBody: requestBody
    };
  }
};