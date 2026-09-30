import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LearnTopic } from "@/components/LearnTopic";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getInterfaceCopy } from "@/lib/i18n/interface";
import { localePath } from "@/lib/i18n/localePath";
import { getOpenPageAlternates, getRequestDictionary } from "@/lib/i18n/requestLocale";
import { getSmartLiquidityCopy } from "@/lib/i18n/smartLiquidityCopy";
import { type BriefId, BRIEF_IDS, getLearnCopy } from "@/lib/learn/briefs";
import { getTopicCopy } from "@/lib/learn/topics";

/*
 * One quick-guide topic on a page of its own, in every language.
 *
 * Like the guide it reads nothing and is the same page for everybody, so it
 * is open to search engines: this is the page somebody searching for one of
 * these ideas in their own language should land on.
 */

const isBriefId = (value: string): value is BriefId => (BRIEF_IDS as readonly string[]).includes(value);

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  if (!isBriefId(topic)) return {};
  const { locale } = await getRequestDictionary();
  const brief = getLearnCopy(locale).briefs.find(({ id }) => id === topic)!;

  return {
    title: `${brief.title} · LiquidityWise`,
    description: `${brief.points[0]} ${brief.points[1]}`,
    alternates: await getOpenPageAlternates(`/learn/${topic}`),
  };
}

export default async function LearnTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!isBriefId(topic)) notFound();

  const { locale, t } = await getRequestDictionary();
  const copy = getLearnCopy(locale);
  const brief = copy.briefs.find(({ id }) => id === topic)!;

  return (
    <WorkspaceShell locale={locale} t={t} heading={brief.title}>
      <LearnTopic
        brief={brief}
        more={getTopicCopy(locale).more[topic]}
        others={copy.briefs
          .filter(({ id }) => id !== topic)
          .map(({ id, title }) => ({ href: localePath(locale, `/learn/${id}`), title }))}
        otherTopics={getTopicCopy(locale).otherTopics}
        onward={
          topic === "hooks"
            ? { href: localePath(locale, "/hooks"), label: t.hooks.fromHome }
            : topic === "smart-money"
              ? { href: localePath(locale, "/smart-money"), label: getSmartLiquidityCopy(locale).link }
              : { href: "/pool", label: getInterfaceCopy(locale).pools }
        }
      />
      <p>
        <Link href={localePath(locale, "/learn")} prefetch={false} className="text-link text-sm">
          {getTopicCopy(locale).backToGuide}
        </Link>
      </p>
    </WorkspaceShell>
  );
}
