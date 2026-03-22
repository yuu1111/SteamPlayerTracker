# プロジェクト概要

Steamゲームの同時接続プレイヤー数を定期取得し、CSVに記録、オプションでGoogle Sheetsに同期するBun製TypeScriptアプリケーション。

# 開発コマンド

```bash
bun install          # 依存関係インストール
bun run dev          # watchモードで開発実行
bun run build        # dist/にビルド (Bun.build)
bun run typecheck    # TypeScript型チェック (tsc --noEmit)
bun run lint         # Biomeによるlintチェック
bun run format       # Biomeによるフォーマット適用 (--write --unsafe)
bun run start        # ビルド済みファイルを実行
```

テストフレームワークは未導入。品質管理は`typecheck`と`lint`で行う。

# リリース

```bash
bun run release              # パッチバージョン (1.0.0 → 1.0.1)
bun run release:minor        # マイナーバージョン
bun run release:major        # メジャーバージョン
```

リリーススクリプトがバージョン更新、CHANGELOG同期、gitタグ作成を自動化する。

# ツールコマンド

ツールは`src/tools/`にあり、ビルドせずBunで直接実行する。

```bash
bun run calculate-daily-averages   # 全日次平均を再計算
bun run sync-google-sheets         # Google Sheetsへ同期
bun run generate-charts            # チャート画像生成
```

# アーキテクチャ

## ランタイム・ツールチェイン

- **ランタイム**: Bun (Node.jsではない)
- **ビルド**: Bun.build (ESM, コード分割有効) - `scripts/build.ts`
- **Lint/Format**: Biome (`@yuu1111/biome-config`を継承)
- **型チェック**: TypeScript 5.9 strict (`@yuu1111/tsconfig`を継承, `noEmit: true`)
- **バリデーション**: Zod (設定、CSV、API応答すべて)

## ソースコード構成

- `src/main.ts` - エントリーポイント。SteamPlayerTrackerクラスがサービスを組み立て、Bun.cronでスケジュール登録
- `src/config/config.ts` - 環境変数をZodスキーマでパースし設定オブジェクトを生成
- `src/schemas/` - Zodバリデーションスキーマ (config, CSV, Steam API, Google認証情報)
- `src/services/` - コアサービス群:
  - `steamApi.ts` - Steam Web APIからプレイヤー数取得
  - `csvWriter.ts` - CSVファイルへの書き込み
  - `dailyAverageService.ts` - 日次平均の計算 (0値=API失敗として除外)
  - `googleSheets.ts` / `queuedGoogleSheets.ts` - Google Sheets連携 (100msレート制限付きキュー)
- `src/workers/` - Bun.cronワーカー (collect-data.ts, daily-average.ts)
- `src/utils/` - ユーティリティ (logger, retry, csv-parser, カスタムWinstonトランスポート)
- `scripts/` - ビルド・リリーススクリプト (TypeScript, Bunで直接実行)

## 設計パターン

- **設定管理**: 全設定は`.env`経由。Zodの判別共用体(discriminated union)でGoogle Sheets有効/無効を型安全に分岐
- **リトライ**: 指数バックオフ (5倍乗数, 最大30秒)
- **グレースフルシャットダウン**: シグナルリスナーでcronジョブを解除して終了
- **ロギング**: Winston (JSONファイル出力 + カラーコンソール, 10MB回転, 7日自動削除)

## CI/CD

- `.github/workflows/ci.yml` - push/PRで`typecheck` → `lint` → `build`を実行
- `.github/workflows/release.yml` - `v*`タグでGitHubリリース作成 (tar.gz/zip)
