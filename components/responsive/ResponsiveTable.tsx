"use client";

import type { ReactNode } from "react";

type ResponsiveTableProps = {
  /** md+ table / wide layout */
  desktop: ReactNode;
  /** Narrow screens: card stack */
  mobile: ReactNode;
};

export function ResponsiveTable({ desktop, mobile }: ResponsiveTableProps) {
  return (
    <>
      <div className="hidden md:block">{desktop}</div>
      <div className="md:hidden">{mobile}</div>
    </>
  );
}
