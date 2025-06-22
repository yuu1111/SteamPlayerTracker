# SteamPlayerTracker

SteamPlayerTracker は、指定されたSteamゲームの現在の同時接続数（プレイヤー数）を定期的に取得し、そのデータをCSV形式で記録するアプリケーションです。オプションでGoogleスプレッドシートへの連携機能も提供します。

## 機能

- 🎮 **Steam Web API からのプレイヤー数取得**: 指定したゲームの現在のプレイヤー数を自動取得
- 📊 **CSV形式での記録**: タイムスタンプ付きでプレイヤー数をCSVファイルに保存
- 📋 **Googleスプレッドシート連携**: オプションでスプレッドシートに直接データを書き込み
- ⏰ **柔軟なスケジューリング**: 任意の分指定で定期実行
- 🔄 **エラーハンドリング・リトライ機能**: 指数関数的バックオフによる自動リトライ
- 📝 **詳細なロギング**: ログレベル管理・ローテーション対応
- 🛡️ **型安全性**: TypeScript による型チェック

## 必要な環境

- Node.js 18.x 以上
- (オプション) Google Cloud Platform アカウント（スプレッドシート連携時）

## セットアップ

### 1. プロジェクトのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd SteamPlayerTracker
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして設定してください：

```bash
cp .env.example .env
```

`.env` ファイルを編集：

```env
# Steam Settings
STEAM_APP_ID=730

# Output Settings
CSV_OUTPUT_ENABLED=true
CSV_FILE_PATH=steam_concurrent_players.csv

# Scheduling Settings (分を指定: カンマ区切り)
COLLECTION_MINUTES=0,30

# Retry Settings
MAX_RETRIES=3
RETRY_BASE_DELAY=1000

# Logging Settings
LOG_LEVEL=info
LOG_FILE_PATH=logs/steam-tracker.log

# Google Sheets Integration (Optional)
GOOGLE_SHEETS_ENABLED=false
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_SHEET_NAME=PlayerData
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=
```

### 3. ゲームIDの確認

Steam ストアページのURLからApp IDを確認できます：
- 例: `https://store.steampowered.com/app/730/` → App ID は `730` (Counter-Strike 2)

## 使用方法

### 開発環境での実行

```bash
npm run dev
```

### 本番環境での実行

```bash
npm run build
npm start
```

### バックグラウンド実行（Linux/Mac）

```bash
nohup npm start > output.log 2>&1 &
```

### Windows でのバックグラウンド実行

```bash
# PowerShell
Start-Process npm -ArgumentList "start" -WindowStyle Hidden
```

## Googleスプレッドシート連携（オプション）

### 1. Google Cloud Platform 設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Sheets API を有効化
3. サービスアカウントを作成してキーファイル（JSON）をダウンロード

### 2. 環境変数設定

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_SHEET_NAME=PlayerData
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=path/to/service-account-key.json
```

### 3. スプレッドシート共有

作成したスプレッドシートをサービスアカウントのメールアドレスと共有してください。

## 設定オプション

| 設定項目 | 説明 | デフォルト値 |
|---------|------|-------------|
| `STEAM_APP_ID` | 追跡するゲームのApp ID | 必須 |
| `CSV_OUTPUT_ENABLED` | CSV出力の有効/無効 | `true` |
| `CSV_FILE_PATH` | CSV出力ファイルパス | `steam_concurrent_players.csv` |
| `COLLECTION_MINUTES` | データ取得する分（カンマ区切り） | `0,30` |
| `MAX_RETRIES` | 最大リトライ回数 | `3` |
| `RETRY_BASE_DELAY` | リトライ基本遅延時間（ms） | `1000` |
| `LOG_LEVEL` | ログレベル（debug/info/warn/error） | `info` |
| `LOG_FILE_PATH` | ログファイルパス | `logs/steam-tracker.log` |

## CSVファイル構造

```csv
timestamp,player_count
2024-06-23 10:00:00,12345
2024-06-23 10:30:00,13456
```

## トラブルシューティング

### よくある問題

1. **Steam API エラー**
   - App IDが有効か確認
   - ネットワーク接続を確認

2. **ファイル書き込みエラー**
   - ディスクの空き容量を確認
   - ファイル・ディレクトリの権限を確認

3. **Googleスプレッドシートエラー**
   - サービスアカウントキーファイルのパスが正しいか確認
   - スプレッドシートIDが正しいか確認
   - スプレッドシートがサービスアカウントと共有されているか確認

### ログの確認

```bash
# ログファイルの確認
tail -f logs/steam-tracker.log

# エラーのみフィルタ
grep "ERROR" logs/steam-tracker.log
```

## 開発者向け

### スクリプト

```bash
npm run build      # TypeScriptをコンパイル
npm run dev        # 開発モードで実行
npm run watch      # ファイル変更を監視してコンパイル
npm run clean      # distディレクトリをクリア
npm run lint       # ESLintによる静的解析
npm run typecheck  # TypeScriptの型チェック
```

### ディレクトリ構造

```
src/
├── config/          # 設定管理
├── services/        # 各種サービス
├── types/           # 型定義
├── utils/           # ユーティリティ
├── steamPlayerTracker.ts  # メインクラス
└── index.ts         # エントリーポイント
```

## ライセンス

MIT License