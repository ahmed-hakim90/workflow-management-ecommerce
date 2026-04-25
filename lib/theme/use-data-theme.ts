"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  mq.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    mq.removeEventListener("change", onChange);
  };
}

function getSnapshot() {
  return document.documentElement.getAttribute("data-theme") ?? "dark";
}

function getServerSnapshot() {
  return "dark";
}

/** Resolved visual theme on `<html data-theme>`. */
export function useDataTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
