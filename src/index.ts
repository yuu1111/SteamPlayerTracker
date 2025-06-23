import { SteamPlayerTracker } from './steamPlayerTracker';

// Set window title for Windows
function setWindowTitle(title: string) {
  if (process.platform === 'win32') {
    process.title = title;
  }
}

async function main() {
  try {
    // Set initial window title
    setWindowTitle('Steam Player Tracker - Starting...');
    
    const tracker = new SteamPlayerTracker();
    
    // Update title when tracker starts
    setWindowTitle('Steam Player Tracker - Running');
    
    await tracker.start();
  } catch (error) {
    setWindowTitle('Steam Player Tracker - Error');
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}