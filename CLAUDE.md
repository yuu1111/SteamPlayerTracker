# プロジェクト概要

Steamゲームの同時接続プレイヤー数を定期取得し、SQLiteに記録、オプションでGoogle Sheetsに同期するBun製TypeScriptアプリケーション。

# 開発コマンド

```bash
bun install          # 依存関係インストール
bun run dev          # watchモードで開発実行
bun run build        # dist/にビルド (Bun.build)
bun run typecheck    # TypeScript型チェック (tsc --noEmit)
bun run lint         # Biomeによるlintチェック
bun run format       # Biomeによるフォーマット適用 (--write --unsafe)
bun run start        # ビルド済みファイルを実行
bun run test         # bun testで全テスト実行
```

品質管理は`typecheck`、`lint`、`test`で行う。テストは`tests/`にsrc/のミラー構造で配置。

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
bun run import-csv           # 既存CSVデータをSQLiteにインポート
bun run export-csv           # SQLiteデータをCSVにエクスポート
bun run generate-charts      # チャート画像生成
```

# アーキテクチャ

## ランタイム・ツールチェイン

- **ランタイム**: Bun (Node.jsではない)
- **ビルド**: Bun.build (ESM, コード分割有効) - `scripts/build.ts`
- **Lint/Format**: Biome (`@yuu1111/biome-config`を継承)
- **型チェック**: TypeScript 5.9 strict (`@yuu1111/tsconfig`を継承, `noEmit: true`)
- **バリデーション**: Zod (設定、API応答)
- **ストレージ**: SQLite (`bun:sqlite`, 依存ゼロ)

## ソースコード構成

- `src/main.ts` - エントリーポイント。依存を直接組み立て、setIntervalで毎分スケジュール実行
- `src/config.ts` - 環境変数をZodスキーマでパースし設定オブジェクトを生成
- `src/db.ts` - SQLiteデータベース初期化、マイグレーション、クエリヘルパー
- `src/logger.ts` - 軽量構造化ロガー (JSON stdout出力)
- `src/retry.ts` - 指数バックオフ付きリトライハンドラ
- `src/googleSheets.ts` - 汎用Google Sheetsアクセサ (SheetAccessor<T>)
- `src/schemas/` - Zodバリデーションスキーマ (Steam API, Google認証情報)
- `src/jobs/` - cronジョブ (collectData, dailyAverage, syncSheets)
- `src/tools/` - CLIツール (importCsv, exportCsv, generateCharts)
- `scripts/` - ビルド・リリーススクリプト (TypeScript, Bunで直接実行)

## 設計パターン

- **設定管理**: 全設定は`.env`経由。Zodの判別共用体(discriminated union)でGoogle Sheets有効/無効を型安全に分岐
- **ストレージ**: SQLite (WALモード, prepared statements)。日次平均はSQLクエリで計算
- **Google Sheets同期**: DB駆動 (`synced_at IS NULL` で未同期レコードを追跡)。プロセス再起動でもデータ損失なし
- **依存注入**: サービスコンテナなし。main.tsで組み立てて関数引数で渡す
- **リトライ**: 指数バックオフ (5倍乗数, 最大30秒)
- **グレースフルシャットダウン**: シグナルリスナーでcronジョブ解除 + DB close
- **ロギング**: 構造化JSON (stdout出力, ファイル出力はプロセスマネージャに委譲)

## CI/CD

- `.github/workflows/ci.yml` - push/PRで`typecheck` → `lint` → `build`を実行
- `.github/workflows/release.yml` - `v*`タグでGitHubリリース作成 (tar.gz/zip)
