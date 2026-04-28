"use client";

import { useEffect } from "react";
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
  node.nodeValue =
    translated === trimmed
      ? original
      : `${original.match(/^\s*/)?.[0] ?? ""}${translated}${original.match(/\s*$/)?.[0] ?? ""}`;
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
  return tag === "script" || tag === "style" || tag === "noscript" || element.hasAttribute("data-no-translate");
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
    } else if (node.nodeType === Node.TEXT_NODE && node.parentElement && !shouldSkipElement(node.parentElement)) {
      translateTextNode(node as Text, locale);
    }
    node = walker.nextNode();
  }
}

export function DomTranslator({ locale }: { locale: Locale }) {
  useEffect(() => {
    translateTree(document.body, locale);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text, locale);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateTree(node as Element, locale);
          }
        }
        if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(mutation.target as Text, locale);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
