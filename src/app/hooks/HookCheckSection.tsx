import { Suspense } from "react";

import { HookCheckLines, HookCheckPending } from "@/components/HookCheck";
import type { HookCheck } from "@/lib/advisor/hookCheck";
import type { Locale } from "@/lib/i18n/locales";

/**
 * One hook's check, awaited inside a boundary of its own.
 *
 * Lives in the route because it waits on data, and components there do not.
 * Shared by the hooks directory, one per hook, and the v4 pool page, which
 * imports it from here. The promise never rejects and never outlasts
 * `HOOK_CHECK_WAIT_MS` (advisor/getHookChecks.ts), so the boundary always
 * resolves, at worst into "could not be checked just now".
 */
export async function HookCheckAnswer({ check, locale }: { check: Promise<HookCheck>; locale: Locale }) {
  return <HookCheckLines check={await check} locale={locale} />;
}

export function HookCheckSection({ check, locale }: { check: Promise<HookCheck>; locale: Locale }) {
  return (
    <Suspense fallback={<HookCheckPending locale={locale} />}>
      <HookCheckAnswer check={check} locale={locale} />
    </Suspense>
  );
}
