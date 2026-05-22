const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

const port = parseInt(process.env.BACKEND_PORT || '8000', 10);
const backendDir = path.resolve(__dirname, '..', 'backend');

// 1. Sync Env Files
try {
  const rootEnv = path.resolve(__dirname, '..', '.env');
  const frontendEnv = path.resolve(__dirname, '.env');
  const backendEnv = path.resolve(backendDir, '.env');

  if (fs.existsSync(rootEnv)) {
    fs.copyFileSync(rootEnv, frontendEnv);
    fs.copyFileSync(rootEnv, backendEnv);
    console.log('[Neural Link] Central .env synced to frontend/ and backend/');
  }
} catch (e) {
  console.warn('[Neural Link] Warning: Env sync skipped:', e.message);
}

// 2. Check if port is in use
const checkPort = (portToCheck) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is occupied -> backend is running
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free -> backend is offline
    });
    server.listen(portToCheck);
  });
};

const main = async () => {
  const isBackendRunning = await checkPort(port);
  
  if (!isBackendRunning) {
    console.log(`[Neural Link] Backend is offline. Starting FastAPI core concurrently...`);
    
    // Detect python executable path
    const isWin = process.platform === 'win32';
    let pythonPath = 'python';
    if (isWin) {
      pythonPath = '.venv\\Scripts\\python.exe';
      if (!fs.existsSync(path.join(backendDir, '.venv', 'Scripts', 'python.exe'))) {
        if (fs.existsSync(path.join(backendDir, 'venv_jarvis', 'Scripts', 'python.exe'))) {
          pythonPath = 'venv_jarvis\\Scripts\\python.exe';
        } else {
          pythonPath = 'python';
        }
      }
    } else {
      pythonPath = '.venv/bin/python';
      if (!fs.existsSync(path.join(backendDir, '.venv', 'bin', 'python'))) {
        if (fs.existsSync(path.join(backendDir, 'venv_jarvis', 'bin', 'python'))) {
          pythonPath = 'venv_jarvis/bin/python';
        } else {
          pythonPath = 'python3';
        }
      }
    }

    console.log(`[Neural Link] Starting backend process: ${pythonPath} main.py`);
    const backendProc = spawn(pythonPath, ['main.py'], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: isWin
    });

    backendProc.on('error', (err) => {
      console.error('[Neural Link] Failed to start backend process:', err);
    });

    backendProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[Neural Link] Backend process exited with error code ${code}`);
      } else {
        console.log(`[Neural Link] Backend process stopped.`);
      }
    });
  } else {
    console.log(`[Neural Link] J.A.R.V.I.S Backend is already active on port ${port}. Skipping backend startup.`);
  }

  // Start Frontend
  console.log(`[Neural Link] Starting React HUD...`);
  
  const frontendProc = spawn('npm', ['run', 'react-start'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  frontendProc.on('error', (err) => {
    console.error('[Neural Link] Failed to start frontend process:', err);
  });

  frontendProc.on('exit', (code) => {
    console.log(`[Neural Link] Frontend process stopped (code ${code}).`);
    process.exit(code || 0);
  });
};

main();
