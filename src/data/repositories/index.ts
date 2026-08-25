import { createLocalStorageStore } from "../storage";
import { createConfigRepository } from "./configRepository";

const store = createLocalStorageStore();

export const configRepository = createConfigRepository(store);
