export function safeInternalRedirect(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value.includes("\\") || [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) {
    return fallback;
  }

  try {
    const base = new URL("https://internal.invalid");
    const target = new URL(value, base);
    if (target.origin !== base.origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function loginRedirectFor(location: { pathname: string; search: string; hash: string }): string {
  const requested = safeInternalRedirect(`${location.pathname}${location.search}${location.hash}`);
  return `/login?${new URLSearchParams({ redirect: requested }).toString()}`;
}
