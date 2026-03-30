export const extractTemplateVariables = (content = "") => {
  const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const unique = new Set();
  let match = regex.exec(content);

  while (match) {
    unique.add(match[1]);
    match = regex.exec(content);
  }

  return [...unique];
};
