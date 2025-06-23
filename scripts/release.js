#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} 完了`);
  } catch (error) {
    console.error(`❌ ${description} 失敗:`, error.message);
    process.exit(1);
  }
}

function updateVersion(type = 'patch') {
  console.log(`\n📦 バージョンを${type}更新中...`);
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;
  const versionParts = currentVersion.split('.').map(Number);
  
  switch (type) {
    case 'major':
      versionParts[0]++;
      versionParts[1] = 0;
      versionParts[2] = 0;
      break;
    case 'minor':
      versionParts[1]++;
      versionParts[2] = 0;
      break;
    case 'patch':
    default:
      versionParts[2]++;
      break;
  }
  
  const newVersion = versionParts.join('.');
  packageJson.version = newVersion;
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log(`📈 バージョンを ${currentVersion} → ${newVersion} に更新`);
  return newVersion;
}

function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';
  const skipTests = args.includes('--skip-tests');
  
  console.log('🚀 自動リリースプロセスを開始...');
  
  // Git statusチェック
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim()) {
      console.warn('⚠️  未コミットの変更があります:');
      console.log(gitStatus);
      console.log('変更をコミットしてから再実行してください。');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Git status確認エラー:', error.message);
    process.exit(1);
  }
  
  // 依存関係のインストール
  runCommand('npm ci', '依存関係のクリーンインストール');
  
  // TypeScript型チェック
  runCommand('npm run typecheck', 'TypeScript型チェック');
  
  // ESLint実行（警告は許可）
  if (!skipTests) {
    try {
      runCommand('npm run lint', 'ESLint静的解析');
    } catch (error) {
      console.log('⚠️  ESLintで問題が検出されましたが、続行します');
    }
  }
  
  // ビルド
  runCommand('npm run clean', 'dist ディレクトリのクリーンアップ');
  runCommand('npm run build', 'TypeScriptコンパイル');
  
  // バージョン更新
  const newVersion = updateVersion(versionType);
  
  // Gitコミット
  runCommand('git add .', 'Gitステージング');
  runCommand(`git commit -m "chore(release): v${newVersion}"`, 'リリースコミット作成');
  
  // Gitタグ作成
  runCommand(`git tag -a v${newVersion} -m "Release v${newVersion}"`, 'Gitタグ作成');
  
  console.log('\n🎉 リリース準備完了！');
  console.log(`📦 新しいバージョン: v${newVersion}`);
  console.log('\n次のステップ:');
  console.log('  1. git push origin main');
  console.log(`  2. git push origin v${newVersion}`);
  console.log('  3. GitHub Releasesページでリリースノートを作成');
}

main();