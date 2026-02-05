#!/usr/bin/env node

/**
 * Test for auto-off state persistence
 * Tests that auto-off settings are correctly saved and loaded
 */

const fs = require('fs');
const path = require('path');

// Use a test data directory - set BEFORE requiring storage
const testDataDir = path.join(__dirname, 'test-data');
process.env.DATA_DIR = testDataDir;

// Now require storage after setting the env var
const storage = require('../backend/storage.js');

console.log('Auto-Off State Persistence Test');
console.log('================================\n');

// Clean up test directory if it exists
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}

// Test 1: Save auto-off state
console.log('Test 1: Save auto-off state');
const testState = {
  'charger1': {
    enabled: true
  },
  'charger2': {
    enabled: false
  },
  'charger3': {
    enabled: true
  }
};

storage.saveAutoOffState(testState);
console.log('✓ Saved auto-off state');

// Verify file was created
const autoOffFile = path.join(testDataDir, 'auto-off-state.json');
if (!fs.existsSync(autoOffFile)) {
  console.log('✗ FAIL: Auto-off state file was not created');
  console.log('Expected location:', autoOffFile);
  console.log('Test data dir:', testDataDir);
  const dirContents = fs.existsSync(testDataDir) 
    ? fs.readdirSync(testDataDir) 
    : 'directory does not exist';
  console.log('Files in test dir:', dirContents);
  process.exit(1);
}
console.log('✓ Auto-off state file created');

// Test 2: Load auto-off state
console.log('\nTest 2: Load auto-off state');
const loadedState = storage.loadAutoOffState();
console.log('Loaded state:', JSON.stringify(loadedState, null, 2));

// Verify loaded state matches saved state
if (Object.keys(loadedState).length !== 3) {
  console.log('✗ FAIL: Wrong number of chargers loaded');
  process.exit(1);
}

if (loadedState.charger1.enabled !== true) {
  console.log('✗ FAIL: charger1 state not loaded correctly');
  process.exit(1);
}

if (loadedState.charger2.enabled !== false) {
  console.log('✗ FAIL: charger2 state not loaded correctly');
  process.exit(1);
}

if (loadedState.charger3.enabled !== true) {
  console.log('✗ FAIL: charger3 state not loaded correctly');
  process.exit(1);
}

console.log('✓ Auto-off state loaded correctly');

// Test 3: Update state and save again
console.log('\nTest 3: Update and save state');
testState.charger1.enabled = false;
testState.charger4 = { enabled: true };
storage.saveAutoOffState(testState);

const updatedState = storage.loadAutoOffState();
if (updatedState.charger1.enabled !== false) {
  console.log('✗ FAIL: charger1 state not updated');
  process.exit(1);
}

if (!updatedState.charger4 || updatedState.charger4.enabled !== true) {
  console.log('✗ FAIL: charger4 not added');
  process.exit(1);
}

console.log('✓ State updated and persisted correctly');

// Clean up
console.log('\nCleaning up test directory...');
fs.rmSync(testDataDir, { recursive: true, force: true });
console.log('✓ Test directory cleaned up');

console.log('\n================================');
console.log('All tests passed! ✓');
console.log('================================\n');
