# SteamPlayerTracker

**言語:** [English](README.md) | [日本語](README-JP.md)

SteamPlayerTracker は、指定されたSteamゲームの現在の同時接続数（プレイヤー数）を定期的に取得し、そのデータをCSV形式で記録するアプリケーションです。オプションでGoogleスプレッドシートへの連携機能も提供します。

## 機能

- 🎮 **Steam Web API からのプレイヤー数取得**: 指定したゲームの現在のプレイヤー数を自動取得
- 📊 **CSV形式での記録**: タイムスタンプ付きでプレイヤー数をCSVファイルに保存
- 📈 **拡張日次統計**: 日次平均と最大・最小プレイヤー数およびそれらのタイムスタンプを記録
- 🔄 **CSV-Googleシート同期**: データ不整合を解決する手動同期ツール
- 📋 **Googleスプレッドシート連携**: レート制限対応付きのスプレッドシート直接書き込み
- ⏰ **柔軟なスケジューリング**: 任意の分指定で定期実行
- 🔄 **エラーハンドリング・リトライ機能**: 指数関数的バックオフによる自動リトライ
- 📝 **詳細なロギング**: ログレベル管理・ローテーション対応
- 🛡️ **型安全性**: TypeScript による型チェック
- 🚀 **起動時の即座データ取得**: スクリプト開始時に現在のプレイヤー数を取得
- 📊 **未計算の日次平均を自動補完**: 起動時に過去の未計算分を自動計算
- 🖥️ **クロスプラットフォームスクリプト**: すべての操作用のPowerShell、Bash、Batchスクリプト

## 必要な環境

- Node.js 18.x 以上
- (Windows) PowerShell Core (pwsh) - [https://aka.ms/PSWindows](https://aka.ms/PSWindows) からインストール
- (オプション) Google Cloud Platform アカウント（スプレッドシート連携時）

## セットアップ

### クイックセットアップ（推奨）

**Windows:**
```batch
setup.bat
```

**Linux/macOS:**
```bash
./setup.sh
```

### 手動セットアップ

#### 1. プロジェクトのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd SteamPlayerTracker
npm install
```

#### 2. 環境変数の設定

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
DAILY_AVERAGE_CSV_ENABLED=true
DAILY_AVERAGE_CSV_FILE_PATH=steam_daily_averages.csv

# Scheduling Settings (分を指定: カンマ区切り)
COLLECTION_MINUTES=0,30
# 日次平均を計算する時刻 (0-23)
DAILY_AVERAGE_HOUR=0

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
GOOGLE_SHEETS_DAILY_AVERAGE_SHEET_NAME=DailyAverages
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=
```

#### 3. ゲームIDの確認

Steam ストアページのURLからApp IDを確認できます：
- 例: `https://store.steampowered.com/app/730/` → App ID は `730` (Counter-Strike 2)

## 使用方法

### クイックスタート（Windows）

```batch
# ビルドのみ
build.bat

# ビルドして起動
start.bat
```

### クイックスタート（Linux/macOS）

```bash
# ビルドのみ
./build.sh

# ビルドして起動
./start.sh
```

### 開発環境での実行

```bash
npm run dev
```

### 本番環境での実行

```bash
npm run build
npm start
```

### 日次平均の手動計算

過去のデータから全ての日次平均を計算：

```bash
npm run calculate-daily-averages
```

### Googleシート同期

ローカルCSVデータをGoogleシートと手動で同期：

```bash
# npmコマンドを使用
npm run sync-google-sheets

# プラットフォーム固有スクリプトを使用
sync-google-sheets.bat    # Windows（Batch）
sync-google-sheets.ps1    # Windows（PowerShell）
./sync-google-sheets.sh   # Linux/macOS
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

## リリース管理

### 自動リリース

```bash
npm run release          # パッチリリース（1.0.0 → 1.0.1）
npm run release:minor    # マイナーリリース（1.0.0 → 1.1.0）
npm run release:major    # メジャーリリース（1.0.0 → 2.0.0）
```

リリーススクリプトは以下を自動実行します：
- 型チェックと静的解析
- アプリケーションのビルド
- package.jsonのバージョン更新
- Gitコミットとタグの作成
- GitHub Actions デプロイメントの準備

### GitHub Actions

ローカルでリリーススクリプトを実行後：
1. `git push origin main`
2. `git push origin v1.0.1`（作成されたタグをプッシュ）
3. GitHub Actions が自動でリリース成果物を作成

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
GOOGLE_SHEETS_DAILY_AVERAGE_SHEET_NAME=DailyAverages
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
| `DAILY_AVERAGE_CSV_ENABLED` | 日次平均CSV出力の有効/無効 | `true` |
| `DAILY_AVERAGE_CSV_FILE_PATH` | 日次平均CSV出力ファイルパス | `steam_daily_averages.csv` |
| `COLLECTION_MINUTES` | データ取得する分（カンマ区切り） | `0,30` |
| `DAILY_AVERAGE_HOUR` | 日次平均を計算する時刻（0-23） | `0` |
| `MAX_RETRIES` | 最大リトライ回数 | `3` |
| `RETRY_BASE_DELAY` | リトライ基本遅延時間（ms） | `1000` |
| `LOG_LEVEL` | ログレベル（debug/info/warn/error） | `info` |
| `LOG_FILE_PATH` | ログファイルパス | `logs/steam-tracker.log` |

## CSVファイル構造

### メインデータファイル
```csv
timestamp,player_count
2024-06-23 10:00:00,12345
2024-06-23 10:30:00,13456
```

### 日次平均ファイル（拡張フォーマット）
```csv
date,average_player_count,sample_count,max_player_count,max_timestamp,min_player_count,min_timestamp
2024-06-22,12890,48,15420,2024-06-22 18:30:00,8450,2024-06-22 05:00:00
2024-06-23,13245,48,16890,2024-06-23 19:00:00,9120,2024-06-23 04:30:00
```

**注意**: 日次平均計算時、プレイヤー数が0のデータは除外されます（API取得失敗とみなすため）。拡張フォーマットでは最大・最小プレイヤー数とその正確なタイムスタンプが含まれます。

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
npm run calculate-daily-averages  # 全日次平均を計算
npm run sync-google-sheets       # CSVデータをGoogleシートに同期
```

### 起動スクリプト

| ファイル | 説明 | プラットフォーム |
|---------|------|------------------|
| `setup.bat` | 初回セットアップ用バッチファイル | Windows |
| `build.bat` | ビルド用バッチファイル | Windows |
| `start.bat` | 起動用バッチファイル | Windows |
| `sync-google-sheets.bat` | Googleシート同期用バッチファイル | Windows |
| `setup.ps1` | 初回セットアップ用PowerShell Coreスクリプト | Windows |
| `build.ps1` | ビルド用PowerShell Coreスクリプト | Windows |
| `start.ps1` | 起動用PowerShell Coreスクリプト | Windows |
| `sync-google-sheets.ps1` | Googleシート同期用PowerShellスクリプト | Windows |
| `setup.sh` | 初回セットアップ用シェルスクリプト | Linux/macOS |
| `build.sh` | ビルド用シェルスクリプト | Linux/macOS |
| `start.sh` | 起動用シェルスクリプト | Linux/macOS |
| `sync-google-sheets.sh` | Googleシート同期用シェルスクリプト | Linux/macOS |

### ディレクトリ構造

```
src/
├── config/          # 設定管理
├── services/        # 各種サービス
│   ├── csvWriter.ts
│   ├── dailyAverageService.ts
│   ├── googleSheets.ts
│   ├── scheduler.ts
│   └── steamApi.ts
├── tools/           # コマンドラインツール
│   └── calculateAllDailyAverages.ts
├── types/           # 型定義
├── utils/           # ユーティリティ
├── steamPlayerTracker.ts  # メインクラス
└── index.ts         # エントリーポイント
```

## ライセンス

MIT License