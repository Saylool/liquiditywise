/*
 * What the form says after it was sent, carried back in the address.
 *
 * The form is a plain `<form>` behind a Server Action, so it works with
 * scripts off; what the action has to say comes back as one word in the
 * query string of the page it redirects to, and the page turns the word into
 * the sentence (i18n/emailDigestCopy.ts, `status`). Four words, and nothing
 * else is read: an address that says anything else shows the form as if
 * nothing had been sent. The address a reader typed is never in the URL — a
 * mailbox in a query string is a mailbox in every log on the way.
 */

export const EMAIL_STATUS_PARAMETER = "email";

/** Where the form sits on the page, so the redirect lands the reader on the answer. */
export const EMAIL_FORM_ANCHOR = "email";

export const EMAIL_FORM_STATUSES = ["sent", "invalid", "busy", "unavailable"] as const;
export type EmailFormStatus = (typeof EMAIL_FORM_STATUSES)[number];

export const readEmailStatus = (value: string | string[] | undefined): EmailFormStatus | null =>
  typeof value === "string" && (EMAIL_FORM_STATUSES as readonly string[]).includes(value) ? (value as EmailFormStatus) : null;
