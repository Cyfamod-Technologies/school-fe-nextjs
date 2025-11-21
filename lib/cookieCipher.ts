const COOKIE_SECRET =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_COOKIE_SECRET || process.env.COOKIE_SECRET)) ||
  "lynx-cookie-secret";

const hasWindow = () => typeof window !== "undefined";
const hasBuffer = () => typeof Buffer !== "undefined";

const base64Encode = (input: string): string => {
  if (hasWindow() && typeof window.btoa === "function") {
    return window.btoa(input);
  }
  if (hasBuffer()) {
    return Buffer.from(input, "utf-8").toString("base64");
  }
  throw new Error("Base64 encoding is not supported in this environment.");
};

const base64Decode = (input: string): string => {
  if (hasWindow() && typeof window.atob === "function") {
    return window.atob(input);
  }
  if (hasBuffer()) {
    return Buffer.from(input, "base64").toString("utf-8");
  }
  throw new Error("Base64 decoding is not supported in this environment.");
};

const xorCipher = (value: string, secret: string): string => {
  if (!secret) {
    return value;
  }
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const valueCode = value.charCodeAt(index);
    const secretCode = secret.charCodeAt(index % secret.length);
    output += String.fromCharCode(valueCode ^ secretCode);
  }
  return output;
};

export function encryptCookieValue(value: string): string {
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

export function decryptCookieValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = base64Decode(value);
    return xorCipher(decoded, COOKIE_SECRET);
  } catch (error) {
    console.error("Unable to decrypt cookie value", error);
    return null;
  }
}
