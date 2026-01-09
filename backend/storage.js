const fs = require('fs');
const path = require('path');

// Data directory for persistent storage
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PROCESSES_FILE = path.join(DATA_DIR, 'charging-processes.json');
const COUNTER_FILE = path.join(DATA_DIR, 'process-counter.json');

/**
 * Ensure the data directory exists
 */
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }
}

/**
 * Load charging processes from file
 * @returns {Array} Array of charging processes
 */
function loadProcesses() {
  ensureDataDirectory();
  
  try {
    if (fs.existsSync(PROCESSES_FILE)) {
      const data = fs.readFileSync(PROCESSES_FILE, 'utf8');
      const processes = JSON.parse(data);
      console.log(`Loaded ${processes.length} charging processes from storage`);
      return processes;
    }
  } catch (error) {
    console.error('Error loading processes from file:', error);
  }
  
  return [];
}

/**
 * Save charging processes to file
 * @param {Array} processes - Array of charging processes to save
 */
function saveProcesses(processes) {
  ensureDataDirectory();
  
  try {
    // Write to a temporary file first, then rename for atomic operation
    const tempFile = `${PROCESSES_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(processes, null, 2), 'utf8');
    fs.renameSync(tempFile, PROCESSES_FILE);
    console.log(`Saved ${processes.length} charging processes to storage`);
  } catch (error) {
    console.error('Error saving processes to file:', error);
  }
}

/**
 * Load process ID counter from file
 * @returns {number} The next process ID to use
 */
function loadProcessCounter() {
  ensureDataDirectory();
  
  try {
    if (fs.existsSync(COUNTER_FILE)) {
      const data = fs.readFileSync(COUNTER_FILE, 'utf8');
      const counter = JSON.parse(data);
      console.log(`Loaded process counter: ${counter.nextId}`);
      return counter.nextId;
    }
  } catch (error) {
    console.error('Error loading process counter from file:', error);
  }
  
  return 1;
}

/**
 * Save process ID counter to file
 * @param {number} counter - The next process ID to use
 */
function saveProcessCounter(counter) {
  ensureDataDirectory();
  
  try {
    const tempFile = `${COUNTER_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify({ nextId: counter }, null, 2), 'utf8');
    fs.renameSync(tempFile, COUNTER_FILE);
    console.log(`Saved process counter: ${counter}`);
  } catch (error) {
    console.error('Error saving process counter to file:', error);
  }
}

module.exports = {
  loadProcesses,
  saveProcesses,
  loadProcessCounter,
  saveProcessCounter
};
