import { parseConfig } from "./schemas/config";

export const config = parseConfig(process.env);
