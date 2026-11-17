/**
 * Safety checks for chat messages, shared by the composer (warn before sending)
 * and the thread view (warn the reader). Pure functions, no I/O.
 */
export type Risk = { key: string; label: string };

/** Luhn checksum: true for plausible card numbers. */
function luhn(digits: string) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const RULES: { key: string; label: string; re: RegExp }[] = [
  { key: "secret", label: "asks for or shares a password or security code", re: /\b(pass ?words?|passcodes?|pin (?:number|code)|one[- ]time (?:pass)?code|verification code|2fa code|otp|login details|sign[- ]in code)\b/i },
  { key: "bank", label: "includes bank account or wire-transfer details", re: /\b(account (?:number|no\.?|#)|routing number|transit number|institution number|iban|swift(?: code)?|wire transfer|bank details|void cheque|direct deposit form)\b/i },
  { key: "sin", label: "mentions a Social Insurance Number", re: /\b(sin(?: number)?|social insurance)\b/i },
  { key: "gift", label: "asks for gift cards", re: /\bgift ?cards?\b/i },
  { key: "crypto", label: "asks for cryptocurrency", re: /\b(bitcoin|btc|crypto(?:currency)?|usdt|tether|ethereum|wallet address)\b/i },
  { key: "untraceable", label: "asks for payment by an untraceable method", re: /\b(western union|moneygram|pay (?:upfront|up front|in advance)|advance (?:fee|payment) (?:by|via)|send (?:the )?money (?:first|now))\b/i },
  { key: "shortlink", label: "contains a shortened or disguised link", re: /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|rb\.gy)\/\S+/i },
];

/** Everything in a message that looks like a scam pattern or sensitive data. */
export function messageRisks(text: string): Risk[] {
  const found: Risk[] = [];
  for (const r of RULES) if (r.re.test(text)) found.push({ key: r.key, label: r.label });
  // 13–19 digit runs (spaces/dashes allowed) that pass the card checksum
  for (const m of text.matchAll(/\b(?:\d[ -]?){13,19}\b/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      found.push({ key: "card", label: "looks like it contains a credit or debit card number" });
      break;
    }
  }
  return found;
}

/* ---------------- Password strength (guidance only; the server enforces the rules) ---------------- */

const COMMON = new Set(["password", "password1", "password12", "password123", "password1234", "qwerty123", "qwertyuiop", "1234567890", "123456789a", "iloveyou12", "welcome123", "letmein123", "abc1234567", "admin12345", "agrihub123", "blueberry1", "farmer1234", "canada1234"]);

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; checks: { ok: boolean; text: string }[] };

export function passwordStrength(pw: string, email?: string): Strength {
  const user = email?.split("@")[0]?.toLowerCase();
  const checks = [
    { ok: pw.length >= 10, text: "At least 10 characters" },
    { ok: /[a-zA-Z]/.test(pw) && /\d/.test(pw), text: "Letters and numbers" },
    { ok: pw.length > 0 && !COMMON.has(pw.toLowerCase()) && !(user && user.length >= 3 && pw.toLowerCase().includes(user)), text: "Not a common password or your email" },
  ];
  if (!pw) return { score: 0, label: "", checks };
  let score = 0;
  if (checks.every((c) => c.ok)) {
    score = 2;
    if (pw.length >= 14) score++;
    if ((/[a-z]/.test(pw) && /[A-Z]/.test(pw)) || /[^a-zA-Z0-9]/.test(pw)) score++;
  } else if (pw.length >= 6) score = 1;
  const s = Math.min(4, score) as Strength["score"];
  return { score: s, label: ["Too weak", "Weak", "Good", "Strong", "Very strong"][s]!, checks };
}
