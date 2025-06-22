import { SteamPlayerTracker } from './steamPlayerTracker';

async function main() {
  try {
    const tracker = new SteamPlayerTracker();
    await tracker.start();
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}