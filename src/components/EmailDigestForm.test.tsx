import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { chainBySlug, ETHEREUM, V3_POSITION_CHAINS } from "../lib/chains/chains";
import type { EmailFormStatus } from "../lib/email/formStatus";
import { getEmailDigestCopy } from "../lib/i18n/emailDigestCopy";
import type { Locale } from "../lib/i18n/locales";
import { EmailDigestForm } from "./EmailDigestForm";

const render = ({ chain = ETHEREUM, status = null as EmailFormStatus | null, offered = true, locale = "en" as Locale } = {}) =>
  renderToStaticMarkup(
    <EmailDigestForm
      chain={chain}
      chains={V3_POSITION_CHAINS}
      copy={getEmailDigestCopy(locale)}
      networkLabel="Network"
      status={status}
      offered={offered}
      action={async () => {}}
    />,
  );

describe("the form for the digest by e-mail", () => {
  it("asks for an address, and offers the chains the smart money is measured on with the page's own chosen", () => {
    const html = render({ chain: chainBySlug("base")! });

    expect(html).toContain('<input id="digest-email" type="email" required=""');
    expect(html).toContain('name="email"');
    expect(html).toContain('<select id="digest-chain" name="chain">');
    expect(html).toContain('<option value="base" selected="">Base</option>');
    expect(html).toContain('<option value="ethereum">Ethereum</option>');
    expect(html).not.toContain('value="unichain"');
    expect(html).not.toContain('value="celo"');
    expect(html).toContain("Send me the digest");
  });

  it("sits at the anchor the action sends the reader back to", () => {
    expect(render()).toContain('<section id="email"');
  });

  it("says exactly what is kept, and how to change the network", () => {
    const html = render();
    const copy = getEmailDigestCopy("en");

    expect(html).toContain(copy.privacy);
    expect(html).toContain(copy.changeNetwork);
  });

  it("shows what the last submission came to, in a live region, and nothing when none did", () => {
    for (const status of ["sent", "invalid", "busy", "unavailable"] as const) {
      expect(render({ status })).toContain(`<p role="status" class="rounded-md border border-border bg-surface-sunken px-4 py-3 text-sm leading-relaxed">${getEmailDigestCopy("en").status[status]}</p>`);
    }
    expect(render()).not.toContain('role="status"');
  });

  it("is one sentence where the digest by e-mail is not set up, with no field to fill", () => {
    const html = render({ offered: false });

    expect(html).toContain(getEmailDigestCopy("en").notConfigured);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
  });

  it("speaks the reader's language", () => {
    const html = render({ locale: "tr" });

    expect(html).toContain("Özet e-postayla");
    expect(html).toContain("Özeti bana gönder");
  });
});
