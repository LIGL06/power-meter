import type { AppConfig } from "@/domain/types";

export function generateSeedConfig(): AppConfig {
  return {
    profile: {
      firstName: "Alex",
      lastName: "Rivera",
      address: "123 Maple Street, Springfield",
      password: "changeme123",
    },
  };
}
