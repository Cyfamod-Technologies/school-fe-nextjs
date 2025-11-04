const COOKIE_SECRET =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_COOKIE_SECRET) ||
  "lynx-cookie-secret";

function base64Encode(input: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(input);
  }

  return Buffer.from(input, "utf-8").toString("base64");
}

function base64Decode(input: string): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(input);
  }

  return Buffer.from(input, "base64").toString("utf-8");
}

function xorCipher(value: string, secret: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const valueCode = value.charCodeAt(index);
    const secretCode = secret.charCodeAt(index % secret.length);
    output += String.fromCharCode(valueCode ^ secretCode);
  }
  return output;
}

function encryptCookieValue(value: string): string {
  if (!value) {
    return value;
  }

  try {
    const obfuscated = xorCipher(value, COOKIE_SECRET);
    return base64Encode(obfuscated);
  } catch (error) {
    console.error("Unable to encrypt cookie value", error);
    return value;
  }
}

function decryptCookieValue(value: string): string | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = base64Decode(value);
    return xorCipher(decoded, COOKIE_SECRET);
  } catch {
    return null;
  }
}

export function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === "undefined") {
    return;
  }

  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);

  const encryptedValue = encryptCookieValue(value);

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    encryptedValue,
  )}; expires=${date.toUTCString()}; path=/`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const target = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";");

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      const rawValue = decodeURIComponent(trimmed.slice(target.length));
      const decrypted = decryptCookieValue(rawValue);
      return decrypted ?? rawValue ?? null;
    }
  }

  return null;
}

export function deleteCookie(name: string): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${encodeURIComponent(
    name,
  )}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
}
