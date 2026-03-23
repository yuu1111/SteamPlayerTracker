# SteamPlayerTracker

[English](README.md) | [日本語](README-JP.md)

Steam Web APIを通じてゲームの同時接続プレイヤー数を定期取得し、SQLiteに記録するBun製TypeScriptアプリケーション。Google Sheetsへの同期にも対応。

## 特徴

- `Bun.cron`によるスケジュール収集
- SQLiteストレージ (WALモード) と自動スキーママイグレーション
- 日次統計: 平均、最大/最小プレイヤー数とタイムスタンプ
- Google Sheetsへのレート制限付き同期 (100ms)
- 指数バックオフによる自動リトライ
- 外部データのZodバリデーション (設定、APIレスポンス)
- グレースフルシャットダウン

## 必要な環境

- [Bun](https://bun.sh/) v1.1+
- (任意) Google Cloud Platformサービスアカウント (Sheets連携時)

## セットアップ

```bash
git clone https://github.com/yuu1111/SteamPlayerTracker.git
cd SteamPlayerTracker
bun install
```

`.env.example`を`.env`にコピーして編集:

```bash
cp .env.example .env
```

最低限`STEAM_APP_ID`を設定すれば動く。SteamストアのURLからApp IDを確認できる:

```
https://store.steampowered.com/app/730/ → STEAM_APP_ID=730 (Counter-Strike 2)
```

## 使い方

```bash
bun run dev          # watchモードで開発
bun run build        # dist/にビルド
bun run start        # ビルド済みファイルを実行
```

### ツール

```bash
bun run import-csv           # 既存CSVデータをSQLiteにインポート
bun run export-csv           # SQLiteデータをCSVにエクスポート
bun run generate-charts      # チャート画像を生成
```

### 品質管理

```bash
bun run typecheck    # TypeScript型チェック (tsc --noEmit)
bun run lint         # Biome lint
bun run format       # Biome format (--write --unsafe)
```

## 設定

設定はすべて`.env`で管理。全項目は[`.env.example`](.env.example)を参照。

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `STEAM_APP_ID` | 追跡するSteam App ID | (必須) |
| `DB_PATH` | SQLiteデータベースファイルパス | `data/steam-tracker.db` |
| `COLLECTION_MINUTES` | データ取得する分 (カンマ区切り) | `0,30` |
| `DAILY_AVERAGE_HOUR` | 日次平均を計算する時刻 (0-23) | `0` |
| `SHEETS_SYNC_MINUTES` | Google Sheets同期する分 (カンマ区切り) | `5,35` |
| `LOG_LEVEL` | ログレベル (debug/info/warn/error) | `info` |
| `GOOGLE_SHEETS_ENABLED` | Google Sheets連携の有効化 | `false` |

### Google Sheets連携

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Google Sheets APIを有効化
3. サービスアカウントを作成しJSONキーをダウンロード
4. スプレッドシートをサービスアカウントのメールアドレスに共有
5. `.env`に以下を設定:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=path/to/key.json
```

## データストレージ

データはSQLiteに保存される (デフォルト: `data/steam-tracker.db`)。

**プレイヤー数テーブル** (`player_data`):

| カラム | 型 | 説明 |
|--------|------|------|
| `timestamp` | TEXT | UTCタイムスタンプ (YYYY-MM-DD HH:mm:ss) |
| `player_count` | INTEGER | 同時接続プレイヤー数 |
| `synced_at` | TEXT | Google Sheets同期タイムスタンプ (未同期はNULL) |

**日次平均テーブル** (`daily_averages`):

| カラム | 型 | 説明 |
|--------|------|------|
| `date` | TEXT (PK) | 日付 (YYYY-MM-DD) |
| `average_player_count` | INTEGER | 平均プレイヤー数 |
| `sample_count` | INTEGER | サンプル数 |
| `max_player_count` | INTEGER | 最大プレイヤー数 |
| `max_timestamp` | TEXT | 最大時のタイムスタンプ |
| `min_player_count` | INTEGER | 最小プレイヤー数 |
| `min_timestamp` | TEXT | 最小時のタイムスタンプ |

プレイヤー数0のレコードは平均計算から除外される (API取得失敗とみなす)。

## プロジェクト構成

```
src/
├── main.ts              # エントリーポイント、Bun.cron登録
├── config.ts            # Zod判別共用体による環境変数パース
├── db.ts                # SQLite初期化、マイグレーション、クエリヘルパー
├── logger.ts            # 構造化JSONロガー (stdout出力)
├── retry.ts             # 指数バックオフ付きリトライハンドラ
├── googleSheets.ts      # 汎用Google Sheetsアクセサ (SheetAccessor<T>)
├── schemas/             # Zodスキーマ (Steam API, Google認証情報)
├── jobs/                # cronジョブ (collectData, dailyAverage, syncSheets)
└── tools/               # CLIツール (importCsv, exportCsv, generateCharts)
scripts/
├── build.ts             # Bun.buildスクリプト
├── release.ts           # バージョン更新、CHANGELOG、gitタグ
├── setup.ps1            # セットアップ (PowerShell)
├── start.ps1            # 起動 (PowerShell)
└── sync-google-sheets.ps1  # Google Sheets同期 (PowerShell)
```

## リリース

```bash
bun run release              # パッチ (1.0.0 → 1.0.1)
bun run release:minor        # マイナー (1.0.0 → 1.1.0)
bun run release:major        # メジャー (1.0.0 → 2.0.0)
```

リリーススクリプトが品質チェック、ビルド、バージョン更新、gitタグ作成を行う。タグをpushするとGitHub Actionsのリリースワークフローが実行される。

## ライセンス

[MIT](LICENCE)
