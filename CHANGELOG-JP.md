# 変更履歴

このプロジェクトの全ての重要な変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に準拠しています。

**言語:** [English](CHANGELOG.md) | [日本語](CHANGELOG-JP.md)

## [2.0.0] - 2026-03-25 JST

### 破壊的変更
- **ランタイム**: Node.js → Bun に完全移行。`bun install` / `bun run` で実行
- **ストレージ**: CSV ファイル → SQLite (WAL モード) に全面移行。データは `data/tracker.db` に保存
- **ビルド**: tsc → Bun.build (ESM, コード分割有効) に変更
- **Lint/Format**: ESLint + Prettier → Biome に統一
- **モジュール**: CommonJS → ESM に変更
- **ロガー**: Winston → 構造化JSON stdout ロガーに置換。ファイル出力はプロセスマネージャに委譲
- **スケジューラ**: node-cron → setInterval ベースのスケジューリングに変更
- **設定**: dotenv 手動パース → Zod スキーマバリデーションに変更。判別共用体で Google Sheets 有効/無効を型安全に分岐

### 追加
- **SQLite ストレージ**: bun:sqlite による依存ゼロのデータベース。WAL モード、prepared statements、トランザクション対応
- **Zod バリデーション**: 設定、Steam API レスポンスの型安全なバリデーション
- **CSV インポート/エクスポートツール**: 既存 CSV データと SQLite 間の双方向変換 (`bun run import-csv` / `bun run export-csv`)
- **テストスイート**: bun test による 114 テスト、カバレッジ 97%
- **DB 駆動の Google Sheets 同期**: `synced_at IS NULL` で未同期レコードを追跡。プロセス再起動でもデータ損失なし
- **日次平均同期の batchAppend**: N 回の API コール → 1 回に削減
- **並行実行ガード**: setInterval の重複実行を防止
- **グレースフルシャットダウン**: シグナルリスナーで cron ジョブ解除 + DB close
- **リリーススクリプト TypeScript 化**: release.cjs → scripts/release.ts

### 変更
- **アーキテクチャ全面刷新**: クラスベースのサービス → 関数ベース/ファクトリパターンに変換
- **依存注入**: サービスコンテナなし。main.ts で組み立てて関数引数で渡すシンプルな DI
- **Google Sheets アクセサ**: 汎用 SheetAccessor\<T> による型安全な Sheets 操作
- **リトライ**: 指数バックオフ (5倍乗数, 最大30秒) に統一
- **CI/CD**: Node.js/npm → Bun に移行。`typecheck` → `lint` → `build` のパイプライン
- **ツール実行**: ビルド不要、Bun で TypeScript を直接実行
- **日次平均同期**: upsert (append) 方式で重複行を防止
- **TypeScript 5.9 strict モード**: `@yuu1111/tsconfig` 継承、using 宣言対応

### 削除
- **CSV ストレージ**: SQLite に完全置換
- **Winston ロガー**: 軽量構造化ロガーに置換
- **node-cron**: setInterval に置換
- **ESLint / Prettier**: Biome に統一
- **bat/sh/ps1 起動スクリプト**: 削除
- **steamApi.ts**: retry.ts に統合・簡素化
- **@types/node**: @types/bun に置換

### 修正
- 日次平均 sync の重複行防止 (upsert 化)
- API レート制限の統一的なハンドリング
- チャートの日付範囲境界の修正
- DDL null ガード修正
- markSynced の statement finalize 安全化

## [1.3.0] - 2025-06-25 JST

### 追加
- **グラフ生成機能**: CSVデータから視覚的なグラフを生成する新機能
  - プレイヤー数推移グラフ（1日、7日、30日期間）
  - 平均値、最大値、最小値を含む日次統計グラフ（7日、30日、60日期間）
  - Chart.jsを使用した高解像度PNG出力（1600x900px）
  - グラフ生成用の `npm run generate-charts` コマンド
  - 特定のグラフタイプと期間指定のための柔軟なコマンドラインオプション
- **セッションベースのログ記録**: セッション固有のログファイル用の新しいWinstonトランスポート
  - セッションタイムスタンプ（YYYY-MM-DD-HHmm形式）でログを整理
  - 古いログの自動クリーンアップユーティリティ
  - デバッグ向上のための個別エラーログファイル
- **プロセス管理スクリプト**: Windows用プロセス管理のための `Kill-SteamTracker.ps1` を追加

### 変更
- **ログシステムのリファクタリング**: レガシーLoggerクラスから統一されたcreateLogger関数への移行
  - TypeScriptによる型安全性の向上
  - 子ロガーによるモジュール分離の改善
  - モジュールコンテキストを含む強化されたログフォーマット
- **パフォーマンス最適化**:
  - ts-nodeから事前コンパイルされたJavaScript実行への置き換え（起動高速化）
  - 個別リクエストの代わりにバルクアップロードを使用するGoogle Sheets同期の最適化
  - バッチ処理によるAPIレート制限問題の削減
- **ツールスクリプトの強化**:
  - `calculate-daily-averages` がバルクGoogle Sheetsアップロードを実行
  - `sync-google-sheets` に明示的なプロセス終了を追加
  - 全ツールがパフォーマンス向上のためコンパイル済みJavaScriptを使用

### 修正
- 日次平均計算でのGoogle Sheetsレート制限問題
- Google Sheets操作後のプロセスハング（明示的な終了を追加）
- コードベース内のESLintエラーと警告
- Winstonロガー統合での型安全性問題

### 技術的変更
- 関数型アプローチを優先してレガシーLoggerクラスを削除
- LoggerからcreateLoggerへの全インポートを更新
- chart.js、chartjs-node-canvas、date-fns依存関係を追加
- コードベース全体でTypeScript型定義を改善

## [1.2.0] - 2025-06-25 JST

### 追加
- 日次統計に最高値・最低値のプレイヤー数とその時刻を追加
- データの差異を処理するCSVとGoogle Sheetsの同期機能
- 手動データ同期用の `npm run sync-google-sheets` コマンド
- 起動時自動同期のための `GOOGLE_SHEETS_SYNC_ON_STARTUP` 環境変数
- max_player_count、max_timestamp、min_player_count、min_timestampカラムを含む拡張日次平均CSVフォーマット
- 重複検出とデータ更新機能を備えた強化されたGoogle Sheets統合

### 強化
- 日次平均レコードにピークと最低プレイヤー数の正確な時刻を含める
- Google Sheetsサービスがタイムスタンプをチェックして重複エントリを自動的に防止
- 起動プロセスで任意でローカルCSVデータをGoogle Sheetsと同期
- 日次統計ログに最大値・最小値とその時刻を含める

### 技術的変更
- 最大値・最小値追跡フィールドを含む `DailyAverageRecord` インターフェースの拡張
- `findRecordByTimestamp` と `findDailyAverageRecordByDate` メソッドを含む改良された `GoogleSheetsService`
- 包括的なデータ同期のための `syncGoogleSheets.ts` ツールの追加
- 拡張日次平均フォーマットの下位互換性を持つCSVライターの強化

## [1.1.4] - 2025-06-24 JST

### 追加
- Google Sheetsヘッダーに UTC時間基準の明記
- setup.bat/setup.ps1のウィンドウタイトルをより分かりやすく更新（「設定中...」表示）
- build.bat/build.ps1のウィンドウタイトルをより分かりやすく更新（「ビルド中...」表示）

### 修正
- データ収集スケジュール更新時に日別平均計算タスクが継続実行されるよう修正
- スケジューラーがデータ収集の再スケジュール時に日別タスクを停止しないよう修正

### 変更
- すべてのプラットフォーム用スクリプトでウィンドウタイトルの一貫性を向上
- Google Sheetsヘッダーが「timestamp (UTC)」と「date (UTC)」を明確に表示

## [1.1.3] - 2025-06-24 JST

### 追加
- ゲーム名と現在のプレイヤー数を表示するWindowsでの動的ウィンドウタイトル更新
- ユーザー体験向上のためのSteam Store APIからのゲーム名検出
- 改善されたウィンドウタイトルの進行（開始中... → ゲーム名 → ゲーム名: X人のプレイヤー）

### 変更
- アプリケーションがタイトルを引き継ぐ前に「開始中...」を表示するよう起動スクリプトを強化
- 最新のプレイヤー数データでリアルタイムに更新されるウィンドウタイトル

## [1.1.2] - 2025-06-24 JST

### 修正
- ESLint設定の最新化と最適化による高速化（35秒 → 15秒）
- TypeScript ESLintプラグインとパーサーをv7.18.0に更新
- 非推奨警告を解決するためrimrafをv6.0.1にアップグレード
- Google Sheets API呼び出しで正しいrequestBodyパラメータを使用するよう修正
- リリーススクリプトのハング防止のためコマンドにタイムアウトを追加

### パフォーマンス改善
- 大幅な速度向上のためESLintからTypeScriptプロジェクト解析を削除
- 必須チェックのみにESLintルールを合理化
- 不要なチェックを防ぐためscriptsディレクトリをESLintから除外

### 技術的負債
- 非推奨パッケージ警告（inflight、config-arrayなど）を解決
- コード品質を維持しながらCI/CDパイプラインのパフォーマンスを向上

## [1.1.1] - 2025-06-24 JST

### 修正
- 適切なフォルダ命名によるリリースアーカイブ構造の改善
- 開発用スクリプト（release.js）をリリースパッケージから除外
- ユーザーの設定を簡単にするため .env.example をリリースアーカイブに追加

### 変更
- リリースアーカイブで一貫した命名を使用（steam-player-tracker-vX.X.X/）
- 本番環境で必要なファイルのみを含むリリースパッケージに合理化

## [1.1.0] - 2024-06-23

### 追加
- GitHub Actions を使用した自動リリース管理システム
- コード品質向上のための ESLint 設定
- パッチ、マイナー、メジャーバージョン用のリリーススクリプト
- プルリクエストとプッシュ用の継続的インテグレーション（CI）ワークフロー
- 成果物付きの GitHub リリースを自動作成するリリースワークフロー
- 英語と日本語のドキュメント（README.md と README-JP.md）
- 両言語での変更履歴ドキュメント
- CLAUDE.md に Conventional Commit メッセージ形式のガイドライン

### 変更
- 新しいリリース関連 npm スクリプトで package.json を更新
- リリース管理の手順を含む README の改善
- プロジェクトドキュメント構造の改善

### 修正
- 適切な TypeScript 型を使用して全ての ESLint 警告を解決
- dailyAverageService.ts のエラーハンドリングを修正
- GoogleSheetsService と Logger の型安全性を向上

### 技術的改善
- リリースプロセスでの自動型チェックと静的解析の追加
- リリース用の tar.gz と zip 成果物生成の実装
- 適切な Node.js バージョンマトリックステスト（18, 20）の設定
- CI パイプラインでの起動検証の追加
- GitHub リリースに変更履歴の内容を含めるリリースワークフローの強化

## [1.0.0] - 初回リリース

### 追加
- プレイヤー数取得のための Steam Web API 統合
- タイムスタンプ付き CSV データエクスポート機能
- Google スプレッドシート統合（オプション）
- 自動バックフィル付き日次平均計算
- カスタマイズ可能なインターバルを持つ柔軟なスケジューリングシステム
- 指数バックオフリトライによる包括的エラーハンドリング
- ファイルローテーション付き Winston ベースロギング
- アプリケーション全体での TypeScript 型安全性
- クロスプラットフォーム起動スクリプト（Windows、Linux、macOS）
- 環境ベース設定システム
- 起動時の即座データ収集
- 不足している日次平均の自動計算

### 機能
- **データ収集**: Steam Web API からの同時プレイヤー数の定期取得
- **ストレージオプション**: ローカル CSV ファイルとオプションの Google スプレッドシート同期
- **スケジューリング**: カスタマイズ可能なデータ収集インターバル（分ベースの cron スケジューリング）
- **データ処理**: ゼロ値（API 失敗）を除外した日次平均計算
- **エラー耐性**: 指数バックオフによる自動リトライメカニズム
- **監視**: 設定可能なレベルとローテーション付きの包括的ログ記録
- **クロスプラットフォーム**: Windows（バッチ/PowerShell）、Linux、macOS のサポート
- **型安全性**: 厳密な型チェック付きの完全な TypeScript 実装

### 設定
- ゲーム追跡用の Steam App ID 指定
- 柔軟な出力設定（CSV ファイルパス、Google スプレッドシート設定）
- カスタマイズ可能なスケジューリング（収集分、日次平均計算時間）
- リトライ動作設定（最大リトライ数、基本遅延）
- ログ設定（レベル、ファイルパス）
- サービスアカウント認証付きオプションの Google スプレッドシート統合

### 技術スタック
- **ランタイム**: TypeScript 付き Node.js 18+
- **API**: Steam Web API、Google Sheets API
- **データストレージ**: CSV ファイル、Google スプレッドシート
- **スケジューリング**: node-cron
- **ログ記録**: ファイルローテーション付き Winston
- **HTTP クライアント**: リトライロジック付き Axios
- **設定**: 検証付き dotenv