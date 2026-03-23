import { parseConfig } from "../schemas/config";

/**
 * @description 環境変数からパース済みのアプリケーション設定
 */
export const config = parseConfig(process.env);
