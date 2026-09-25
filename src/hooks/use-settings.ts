"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSettings,
  getSettings,
  subscribeToSettings,
  updateSettings,
} from "@/lib/settings";

export function useSettings() {
  const settings = useSyncExternalStore(subscribeToSettings, getSettings, getServerSettings);
  return [settings, updateSettings] as const;
}
