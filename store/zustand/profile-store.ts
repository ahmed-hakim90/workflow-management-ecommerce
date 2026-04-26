"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProfileState = {
  firstName: string;
  lastName: string;
  bio: string;
  timezone: string;
  language: string;
  setProfile: (p: Partial<Pick<ProfileState, "firstName" | "lastName" | "bio" | "timezone" | "language">>) => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      firstName: "Alex",
      lastName: "Rivers",
      bio: "Operations lead focused on SLA-backed fulfillment.",
      timezone: "America/Los_Angeles",
      language: "en",
      setProfile: (p) => set(p),
    }),
    { name: "Store-oms-profile" },
  ),
);
