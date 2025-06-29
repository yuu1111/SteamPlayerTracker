# 変更履歴

このプロジェクトの全ての重要な変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に準拠しています。

**言語:** [English](CHANGELOG.md) | [日本語](CHANGELOG-JP.md)  

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