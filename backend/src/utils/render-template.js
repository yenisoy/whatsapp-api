export const renderTemplate = (templateContent = "", variables = {}) => {
  return String(templateContent).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
};