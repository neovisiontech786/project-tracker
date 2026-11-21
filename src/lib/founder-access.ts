// Pure authorization helpers: never trust an unverified email for founder onboarding.
export type FounderName = 'Kabir' | 'Naushad';

export function parseFounderEmails(raw: string | undefined): readonly [string, string] | null {
  const emails = (raw ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (emails.length !== 2 || emails[0] === emails[1]) return null;
  if (!emails.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return null;
  return [emails[0], emails[1]];
}

export function founderForVerifiedEmails(
  verifiedEmails: readonly string[],
  allowed: readonly [string, string],
): FounderName | null {
  const verified = new Set(verifiedEmails.map(email => email.trim().toLowerCase()));
  if (verified.has(allowed[0])) return 'Kabir';
  if (verified.has(allowed[1])) return 'Naushad';
  return null;
}
