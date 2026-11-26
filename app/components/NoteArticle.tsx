"use client";

import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";

/** Rendered Markdown links otherwise reload the entire reader and sidebar. */
export default function NoteArticle({ html, lexicon, className }: {
  html: string; lexicon: string; className: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function follow(event: MouseEvent<HTMLElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement) || anchor.download || anchor.hasAttribute("download") ||
      (anchor.target && anchor.target !== "_self") || !anchor.getAttribute("href")?.startsWith("/")) return;

    const url = new URL(anchor.href);
    const root = `/${encodeURIComponent(lexicon)}`;
    if (url.origin !== window.location.origin || (url.pathname !== root && !url.pathname.startsWith(`${root}/`))) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;

    event.preventDefault();
    startTransition(() => router.push(`${url.pathname}${url.search}${url.hash}`));
  }

  return <article className={className} onClick={follow} aria-busy={pending}
    dangerouslySetInnerHTML={{ __html: html }} />;
}
