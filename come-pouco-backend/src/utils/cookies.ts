const parseCookieHeader = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, pair) => {
      const separatorIndex = pair.indexOf('=');

      if (separatorIndex < 1) {
        return accumulator;
      }

      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();

      if (!key) {
        return accumulator;
      }

      try {
        accumulator[key] = decodeURIComponent(value);
      } catch {
        // Keep raw value if malformed encoding is received from client/proxy.
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
};

export { parseCookieHeader };
