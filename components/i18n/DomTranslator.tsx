"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { translateLiteral } from "@/lib/i18n/dictionaries";

const originalText = new WeakMap<Text, string>();
const translatedAttributes = ["placeholder", "aria-label", "title"] as const;

function translateTextNode(node: Text, locale: Locale) {
  const original = originalText.get(node) ?? node.nodeValue ?? "";
  if (!originalText.has(node)) originalText.set(node, original);

  const trimmed = original.trim();
  if (!trimmed) return;
  const translated = locale === "en" ? original : translateLiteral(locale, trimmed);
  /**
   * When locale is Arabic, `translateLiteral("ar", arabicText)` returns the same string if there is
   * no English key — then `translated === trimmed`. The old code restored `original` (English from
   * the WeakMap), which re-triggered `characterData` and caused an infinite EN↔AR loop / freeze.
   * Only restore `original` when switching back to English (`locale === "en"`).
   */
  if (translated === trimmed) {
    if (locale !== "en") {
      return;
    }
    node.nodeValue = original;
    return;
  }
  node.nodeValue = `${original.match(/^\s*/)?.[0] ?? ""}${translated}${original.match(/\s*$/)?.[0] ?? ""}`;
}

function translateElementAttributes(element: Element, locale: Locale) {
  for (const attr of translatedAttributes) {
    const current = element.getAttribute(attr);
    if (!current) continue;
    const originalAttr = `data-i18n-original-${attr}`;
    const original = element.getAttribute(originalAttr) ?? current;
    if (!element.hasAttribute(originalAttr)) {
      element.setAttribute(originalAttr, original);
    }
    element.setAttribute(attr, locale === "en" ? original : translateLiteral(locale, original));
  }
}

function shouldSkipElement(element: Element) {
  const tag = element.tagName.toLowerCase();
  return (
    tag === "script" ||
    tag === "style" ||
    tag === "noscript" ||
    tag === "textarea" ||
    element.hasAttribute("data-no-translate") ||
    (element as HTMLElement).isContentEditable
  );
}

/** Avoid translating text inside editable fields — conflicts with React controlled inputs and user typing. */
function shouldSkipTextNode(textNode: Text): boolean {
  let el: HTMLElement | null = textNode.parentElement;
  while (el) {
    if (shouldSkipElement(el)) return true;
    el = el.parentElement;
  }
  return false;
}

function translateTree(root: ParentNode, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (shouldSkipElement(element)) {
        node = walker.nextSibling();
        continue;
      }
      translateElementAttributes(element, locale);
    } else if (
      node.nodeType === Node.TEXT_NODE &&
      node.parentElement &&
      !shouldSkipTextNode(node as Text)
    ) {
      translateTextNode(node as Text, locale);
    }
    node = walker.nextNode();
  }
}

/**
 * Translate visible DOM once when locale or route changes.
 * A global MutationObserver on `document.body` was removed: it fired on almost every React update
 * (clicks, hover, transitions) and ran heavy synchronous work, freezing the tab ("Page Unresponsive").
 */
export function DomTranslator({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      translateTree(document.body, locale);
    });
    return () => cancelAnimationFrame(frame);
  }, [locale, pathname]);

  return null;
}
