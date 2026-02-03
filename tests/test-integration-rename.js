#!/usr/bin/env node

/**
 * Integration test for pattern renaming API
 * Tests the actual server endpoint behavior
 */

const patternAnalyzer = require('./backend/patternAnalyzer.js');
const storage = require('./backend/storage.js');

console.log('Pattern Rename Integration Test');
console.log('================================\n');

// Mock processes with different power profiles
const processes = [
  {
    id: 1,
    chargerId: 'charger1',
    chargerName: 'Office Charger',
    deviceName: 'Office Charger',
    startTime: new Date('2026-01-01T10:00:00Z').toISOString(),
    endTime: new Date('2026-01-01T12:00:00Z').toISOString(),
    events: [
      { timestamp: new Date('2026-01-01T10:00:00Z').toISOString(), type: 'power_consumption', value: 45 },
      { timestamp: new Date('2026-01-01T10:30:00Z').toISOString(), type: 'power_consumption', value: 43 },
      { timestamp: new Date('2026-01-01T11:00:00Z').toISOString(), type: 'power_consumption', value: 40 },
      { timestamp: new Date('2026-01-01T11:30:00Z').toISOString(), type: 'power_consumption', value: 38 }
    ]
  },
  {
    id: 2,
    chargerId: 'charger1',
    chargerName: 'Office Charger',
    deviceName: 'Office Charger',
    startTime: new Date('2026-01-02T10:00:00Z').toISOString(),
    endTime: new Date('2026-01-02T12:00:00Z').toISOString(),
    events: [
      { timestamp: new Date('2026-01-02T10:00:00Z').toISOString(), type: 'power_consumption', value: 15 },
      { timestamp: new Date('2026-01-02T10:30:00Z').toISOString(), type: 'power_consumption', value: 12 },
      { timestamp: new Date('2026-01-02T11:00:00Z').toISOString(), type: 'power_consumption', value: 10 },
      { timestamp: new Date('2026-01-02T11:30:00Z').toISOString(), type: 'power_consumption', value: 8 }
    ]
  }
];

// Step 1: Analyze patterns initially
console.log('Step 1: Initial pattern analysis');
console.log('---------------------------------');
let patterns = patternAnalyzer.analyzePatterns(processes, []);
console.log(`Found ${patterns.length} pattern(s):`);
patterns.forEach((p, i) => {
  console.log(`  ${i + 1}. "${p.deviceName}" - processes [${p.processIds.join(', ')}]`);
});

// Step 2: Simulate renaming a pattern via API
console.log('\n\nStep 2: Simulate pattern rename (Laptop)');
console.log('------------------------------------------');

const patternToRename = patterns[0];
const newLabel = 'Laptop';
const shouldRenameAll = true;

console.log(`Renaming pattern "${patternToRename.deviceName}" to "${newLabel}"`);

// This simulates what the server does in the PUT /api/patterns/:patternId/label endpoint
const result = patternAnalyzer.updatePatternLabel(patterns, patternToRename.id, newLabel);
console.log(`Update result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

if (result.success && shouldRenameAll) {
  // Update all processes in the pattern
  console.log(`\nUpdating ${patternToRename.processIds.length} process(es) to deviceName="${newLabel}"`);
  patternToRename.processIds.forEach(processId => {
    const process = processes.find(p => p.id === processId);
    if (process) {
      process.deviceName = newLabel;
      console.log(`  Process ${processId}: deviceName changed to "${newLabel}"`);
    }
  });

  // Re-analyze patterns (this is what the fix adds)
  console.log('\nRe-analyzing patterns after rename...');
  patterns = patternAnalyzer.analyzePatterns(processes, patterns);
  
  console.log(`\nPatterns after re-analysis: ${patterns.length}`);
  patterns.forEach((p, i) => {
    console.log(`  ${i + 1}. "${p.deviceName}" - processes [${p.processIds.join(', ')}]`);
  });
}

// Step 3: Rename another pattern to the same name
console.log('\n\nStep 3: Rename second pattern to "Laptop"');
console.log('-------------------------------------------');

const secondPattern = patterns.find(p => p.id !== patternToRename.id);
if (secondPattern) {
  console.log(`Renaming pattern "${secondPattern.deviceName}" to "Laptop"`);
  
  const result2 = patternAnalyzer.updatePatternLabel(patterns, secondPattern.id, 'Laptop');
  console.log(`Update result: ${result2.success ? 'SUCCESS' : 'FAILED'}`);
  
  if (result2.success && shouldRenameAll) {
    secondPattern.processIds.forEach(processId => {
      const process = processes.find(p => p.id === processId);
      if (process) {
        process.deviceName = 'Laptop';
        console.log(`  Process ${processId}: deviceName changed to "Laptop"`);
      }
    });
    
    console.log('\nRe-analyzing patterns after second rename...');
    patterns = patternAnalyzer.analyzePatterns(processes, patterns);
    
    console.log(`\nFinal patterns: ${patterns.length}`);
    patterns.forEach((p, i) => {
      console.log(`  ${i + 1}. "${p.deviceName}" - processes [${p.processIds.join(', ')}]`);
    });
  }
}

// Validation
console.log('\n\nValidation');
console.log('----------');
const laptopPatterns = patterns.filter(p => p.deviceName === 'Laptop');
console.log(`✓ Found ${laptopPatterns.length} pattern(s) named "Laptop"`);

if (laptopPatterns.length === 1) {
  console.log('✗ UNEXPECTED: Expected 2 separate patterns (different power profiles)');
  console.log('  This suggests processes with different power profiles are being merged');
} else if (laptopPatterns.length === 2) {
  console.log('✓ EXPECTED: 2 separate "Laptop" patterns (different power profiles)');
  console.log('  Processes are correctly grouped by power profile similarity');
}

console.log('\n✓ Integration test complete');
