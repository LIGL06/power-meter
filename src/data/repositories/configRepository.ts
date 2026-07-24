import type { AppConfig } from "@/domain/types";
import type { KeyValueStore } from "../storage";

const CONFIG_KEY = "power-meter:config";

export function createConfigRepository(store: KeyValueStore) {
  return {
    getConfig(): AppConfig | null {
      return store.get<AppConfig>(CONFIG_KEY);
    },
    saveConfig(config: AppConfig): void {
      store.set(CONFIG_KEY, config);
    },
  };
}

export type ConfigRepository = ReturnType<typeof createConfigRepository>;
