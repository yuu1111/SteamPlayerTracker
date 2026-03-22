# SteamPlayerTracker

[English](README.md) | [日本語](README-JP.md)

Steam Web APIを通じてゲームの同時接続プレイヤー数を定期取得し、CSVに記録するBun製TypeScriptアプリケーション。Google Sheetsへの同期にも対応。

## 特徴

- `Bun.cron`によるスケジュール収集
- タイムスタンプ付きCSV記録
- 日次統計: 平均、最大/最小プレイヤー数とタイムスタンプ
- Google Sheetsへのレート制限付きキュー同期 (100ms)
- 指数バックオフによる自動リトライ
- 外部データのZodバリデーション (設定、CSV、APIレスポンス)
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
bun run calculate-daily-averages   # 全日次平均をCSVから再計算
bun run sync-google-sheets         # CSVデータをGoogle Sheetsに同期
bun run generate-charts            # チャート画像を生成
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
| `COLLECTION_MINUTES` | データ取得する分 (カンマ区切り) | `0,30` |
| `DAILY_AVERAGE_HOUR` | 日次平均を計算する時刻 (0-23) | `0` |
| `CSV_OUTPUT_ENABLED` | CSV出力の有効化 | `true` |
| `DAILY_AVERAGE_CSV_ENABLED` | 日次平均CSVの有効化 | `true` |
| `MAX_RETRIES` | 最大リトライ回数 | `3` |
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

## CSVフォーマット

**プレイヤー数データ** (`steam_concurrent_players.csv`):

```csv
timestamp,player_count
2024-06-23 10:00:00,12345
2024-06-23 10:30:00,13456
```

**日次平均** (`steam_daily_averages.csv`):

```csv
date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp
2024-06-22,12890,48,15420,2024-06-22 18:30:00,8450,2024-06-22 05:00:00
```

プレイヤー数0のレコードは平均計算から除外される (API取得失敗とみなす)。

## プロジェクト構成

```
src/
├── main.ts                    # エントリーポイント、Bun.cron登録
├── config/config.ts           # Zodによる環境変数パース
├── schemas/                   # Zodスキーマ (設定, CSV, Steam API, Google認証)
├── services/
│   ├── steamApi.ts            # Steam Web APIクライアント
│   ├── csvWriter.ts           # CSVファイル書き込み
│   ├── dailyAverageService.ts # 日次平均計算
│   ├── googleSheets.ts        # Google Sheets APIサービス
│   └── queuedGoogleSheets.ts  # レート制限付きSheetsキュー
├── workers/
│   ├── collect-data.ts        # スケジュールデータ収集
│   └── daily-average.ts       # スケジュール日次平均計算
├── tools/                     # CLIツール (Bunで直接実行)
└── utils/                     # ロガー、リトライ、CSVパーサー
scripts/
├── build.ts                   # Bun.buildスクリプト
├── release.ts                 # バージョン更新、CHANGELOG、gitタグ
├── setup.ps1                  # セットアップ (PowerShell)
├── start.ps1                  # 起動 (PowerShell)
└── sync-google-sheets.ps1     # Google Sheets同期 (PowerShell)
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
