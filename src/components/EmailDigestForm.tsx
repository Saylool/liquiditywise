import { CHAIN_PARAMETER } from "../lib/advisor/requestedParameters";
import type { Chain } from "../lib/chains/chains";
import { EMAIL_FORM_ANCHOR, type EmailFormStatus } from "../lib/email/formStatus";
import type { EmailDigestCopy } from "../lib/i18n/emailDigestCopy";

/*
 * The form that asks for the Monday digest by e-mail, under the digest it is
 * about.
 *
 * Three fields, the way the holdings box is built: an address, the network
 * as a select of the chains the smart money is measured on — the page's own
 * chain chosen — and the language, which is the page's and is not a field at
 * all. A plain `<form>` behind a Server Action (email/subscribeAction.ts), so
 * it works with scripts off; what the action had to say comes back in the
 * address and is shown over the form, in a live region so a screen reader
 * hears it where the page has reloaded.
 *
 * The privacy sentence is on the form, not behind a link: it names exactly
 * what is kept, and that the link in every digest deletes it. Where the
 * digest by e-mail is not set up on this deployment the form is one sentence
 * saying so, as the Telegram section is.
 */
export function EmailDigestForm({
  chain,
  chains,
  copy,
  networkLabel,
  status,
  offered,
  action,
}: {
  /** The chain the page is on, which the select starts at. */
  chain: Chain;
  /** The chains the smart money is measured on: the ones a digest exists for. */
  chains: readonly Chain[];
  copy: EmailDigestCopy;
  networkLabel: string;
  /** What the last submission came to, from the address; `null` when none did. */
  status: EmailFormStatus | null;
  /** Whether this deployment can send: `false` shows the sentence saying it cannot. */
  offered: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <section id={EMAIL_FORM_ANCHOR} className="flex max-w-2xl flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-lg font-medium tracking-tight">{copy.heading}</h2>
      {!offered ? (
        <p className="text-sm leading-relaxed text-muted">{copy.notConfigured}</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{copy.body}</p>
          {status === null ? null : (
            <p role="status" className="rounded-md border border-border bg-surface-sunken px-4 py-3 text-sm leading-relaxed">
              {copy.status[status]}
            </p>
          )}
          <form action={action} className="flex flex-col gap-3">
            <label htmlFor="digest-email" className="text-xs font-medium">
              {copy.emailLabel}
            </label>
            <div className="flex flex-wrap gap-3">
              <input
                id="digest-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface-sunken px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on transition-[filter] hover:brightness-110"
              >
                {copy.submit}
              </button>
            </div>
            <p className="lookup-network">
              <label htmlFor="digest-chain">{networkLabel}</label>
              <select id="digest-chain" name={CHAIN_PARAMETER} defaultValue={chain.slug}>
                {chains.map(({ slug, name }) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </p>
          </form>
          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">{copy.privacy}</p>
          <p className="text-xs leading-relaxed text-muted">{copy.changeNetwork}</p>
        </>
      )}
    </section>
  );
}
