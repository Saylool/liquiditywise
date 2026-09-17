import type { Dictionary } from "../lib/i18n/dictionaries";
import {
  alterSwapEconomics,
  alterWithdrawals,
  chargeWithdrawals,
  groupedHookPermissions,
  hookPermissionsOf,
} from "../schemas";

/**
 * What a hook is permitted to do, in plain words, from its address alone.
 *
 * Shared by the pool that names a hook and the directory of every hook the v4
 * net saw, because they must say the same thing about the same address. A
 * second copy of this would be a second reading of the same fourteen bits, and
 * the two would drift the first time a sentence was reworded in one of them.
 *
 * The warnings come before the list rather than after it. A hook that may
 * rewrite what a swap costs, or stand in the way of a withdrawal, changes what
 * every other figure about that pool means — and a reader who stops after the
 * first paragraph should have been told the thing that matters most.
 */
export function HookPermissions({
  hookAddress,
  t,
}: {
  hookAddress: string;
  t: Dictionary;
}) {
  const permissions = hookPermissionsOf(hookAddress);
  const groups = groupedHookPermissions(hookAddress);

  return (
    <>
      {alterSwapEconomics(hookAddress) ? (
        <p className="rounded-md border border-warning-border bg-warning-surface px-4 py-3 text-sm leading-relaxed text-warning-foreground">
          {t.v4.alterSwapWarning}
        </p>
      ) : null}

      {alterWithdrawals(hookAddress) ? (
        <p className="rounded-md border border-warning-border bg-warning-surface px-4 py-3 text-sm leading-relaxed text-warning-foreground">
          {t.v4.withdrawalWarning(chargeWithdrawals(hookAddress))}
        </p>
      ) : null}

      <h3 className="text-xs uppercase tracking-widest text-muted">{t.v4.hookMay}</h3>
      {/*
       * A sentence per permission, under the moment a reader can picture it at:
       * swaps, their own deposits and withdrawals, the pool's creation,
       * donations. The protocol's own names — where in its code the hook is
       * called — are folded beneath, for the reader checking against the address.
       */}
      {groups.length === 0 ? (
        <p className="text-sm leading-relaxed">{t.v4.noPermissions}</p>
      ) : (
        groups.map((group) => (
          <div key={group.topic} className="flex flex-col gap-1">
            <h4 className="text-sm font-medium">{t.v4.permissionTopics[group.topic]}</h4>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
              {group.permissions.map((permission) => (
                <li key={permission}>{t.v4.permissionWords[permission]}</li>
              ))}
            </ul>
          </div>
        ))
      )}

      {permissions.length === 0 ? null : (
        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer text-xs uppercase tracking-widest text-muted">
            {t.v4.permissionNames}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-sm">
            {permissions.map((permission) => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
