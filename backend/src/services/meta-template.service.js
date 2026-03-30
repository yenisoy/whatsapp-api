import axios from "axios";

const normalizeMetaTemplateName = (name) => {
  return String(name || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]/g, "_")
    .replaceAll(/_+/g, "_")
    .replaceAll(/^_|_$/g, "")
    .slice(0, 200);
};

const convertNamedVariablesToPositional = (content = "") => {
  const order = [];

  const converted = String(content).replaceAll(/{{\s*(\w+)\s*}}/g, (_, variable) => {
    const index = order.indexOf(variable);
    if (index >= 0) {
      return `{{${index + 1}}}`;
    }

    order.push(variable);
    return `{{${order.length}}}`;
  });

  return {
    converted,
    variables: order
  };
};

const getMetaConfig = (credentials = {}) => {
  const token = credentials.whatsappToken || process.env.WHATSAPP_TOKEN;
  const businessAccountId = credentials.whatsappBusinessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !businessAccountId) {
    throw new Error("WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID are required for meta publish");
  }

  return {
    token,
    businessAccountId
  };
};

const getMetaAppId = (credentials = {}) => {
  const appId = String(credentials.metaAppId || process.env.META_APP_ID || "").trim();

  if (!appId) {
    throw new Error("META_APP_ID is required for media upload");
  }

  return appId;
};

export const uploadTemplateMediaToMeta = async ({ fileBuffer, fileName, fileType, fileLength, credentials = {} }) => {
  const { token } = getMetaConfig(credentials);
  const appId = getMetaAppId(credentials);

  const uploadSessionResponse = await axios.post(
    `https://graph.facebook.com/v18.0/${appId}/uploads`,
    null,
    {
      params: {
        file_name: fileName,
        file_length: fileLength,
        file_type: fileType
      },
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 30000
    }
  );

  const uploadSessionId = uploadSessionResponse.data?.id;

  if (!uploadSessionId) {
    throw new Error("upload session could not be created");
  }

  const uploaded = await axios.post(
    `https://graph.facebook.com/v18.0/${encodeURIComponent(uploadSessionId)}`,
    fileBuffer,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "file_offset": "0",
        "Content-Type": "application/octet-stream"
      },
      maxBodyLength: Infinity,
      timeout: 60000
    }
  );

  const handle = uploaded.data?.h || "";

  if (!handle) {
    throw new Error("media handle could not be obtained from Meta upload response");
  }

  return {
    uploadSessionId,
    handle
  };
};

export const publishTemplateToMeta = async ({
  name,
  language,
  content,
  category = "MARKETING",
  headerType = "none",
  headerText = "",
  headerMediaHandle = "",
  footerText = "",
  credentials = {}
}) => {
  const { token, businessAccountId } = getMetaConfig(credentials);

  const metaName = normalizeMetaTemplateName(name);
  if (!metaName) {
    throw new Error("template name is invalid for Meta template naming rules");
  }

  const converted = convertNamedVariablesToPositional(content);
  const components = [];

  if (headerType === "text") {
    const convertedHeader = convertNamedVariablesToPositional(headerText);
    const headerComponent = {
      type: "HEADER",
      format: "TEXT",
      text: convertedHeader.converted
    };

    if (convertedHeader.variables.length > 0) {
      headerComponent.example = {
        header_text: convertedHeader.variables.map((variable) => `sample_${variable}`)
      };
    }

    components.push(headerComponent);
  }

  if (["image", "video", "document"].includes(headerType)) {
    components.push({
      type: "HEADER",
      format: String(headerType || "").toUpperCase(),
      example: {
        header_handle: [headerMediaHandle]
      }
    });
  }

  const bodyComponent = {
    type: "BODY",
    text: converted.converted
  };

  if (converted.variables.length > 0) {
    bodyComponent.example = {
      body_text: [converted.variables.map((variable) => `sample_${variable}`)]
    };
  }

  components.push(bodyComponent);

  if (String(footerText || "").trim()) {
    components.push({
      type: "FOOTER",
      text: String(footerText || "").trim()
    });
  }

  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${businessAccountId}/message_templates`,
    {
      name: metaName,
      language,
      category,
      components
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    }
  );

  return {
    id: response.data?.id || "",
    status: response.data?.status || "",
    category: response.data?.category || category,
    name: metaName,
    convertedContent: converted.converted,
    variables: converted.variables
  };
};

export const fetchMetaTemplateStatus = async ({ metaTemplateId = "", metaTemplateName = "", credentials = {} }) => {
  const { token, businessAccountId } = getMetaConfig(credentials);

  if (!metaTemplateId && !metaTemplateName) {
    throw new Error("metaTemplateId or metaTemplateName is required for meta sync");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  if (metaTemplateId) {
    try {
      const byId = await axios.get(`https://graph.facebook.com/v18.0/${metaTemplateId}`, {
        params: { fields: "id,name,status,category,language,created_time" },
        headers,
        timeout: 30000
      });

      return {
        id: byId.data?.id || metaTemplateId,
        name: byId.data?.name || metaTemplateName,
        status: byId.data?.status || "",
        category: byId.data?.category || "",
        language: byId.data?.language || "",
        createdTime: byId.data?.created_time || ""
      };
    } catch {
    }
  }

  if (metaTemplateName) {
    const byName = await axios.get(`https://graph.facebook.com/v18.0/${businessAccountId}/message_templates`, {
      params: {
        fields: "id,name,status,category,language,created_time",
        name: metaTemplateName,
        limit: 1
      },
      headers,
      timeout: 30000
    });

    const first = byName.data?.data?.[0];

    if (!first) {
      throw new Error("template not found on meta");
    }

    return {
      id: first.id || metaTemplateId,
      name: first.name || metaTemplateName,
      status: first.status || "",
      category: first.category || "",
      language: first.language || "",
      createdTime: first.created_time || ""
    };
  }

  throw new Error("template status could not be fetched from meta");
};

export const fetchAllMetaTemplates = async ({ credentials = {}, pageLimit = 10 }) => {
  const { token, businessAccountId } = getMetaConfig(credentials);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const templates = [];
  let afterCursor = "";

  for (let page = 0; page < pageLimit; page += 1) {
    const params = {
      fields: "id,name,status,category,language,components,created_time",
      limit: 100
    };

    if (afterCursor) {
      params.after = afterCursor;
    }

    const response = await axios.get(`https://graph.facebook.com/v18.0/${businessAccountId}/message_templates`, {
      params,
      headers,
      timeout: 30000
    });

    const pageItems = Array.isArray(response.data?.data) ? response.data.data : [];
    templates.push(...pageItems);

    const nextCursor = response.data?.paging?.cursors?.after || "";
    if (!nextCursor || pageItems.length === 0) {
      break;
    }

    afterCursor = nextCursor;
  }

  return templates;
};