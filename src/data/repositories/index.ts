import { createLocalStorageStore } from "../storage";
import { createConfigRepository } from "./configRepository";
import { createReadingsRepository } from "./readingsRepository";

const store = createLocalStorageStore();

export const configRepository = createConfigRepository(store);
export const readingsRepository = createReadingsRepository(store);
