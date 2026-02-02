# Pattern Reorganization on Rename - Implementation Documentation

## Overview

This implementation adds automatic pattern reorganization when charging patterns (RPs) are renamed. When a user renames a pattern, all charging process items (CPIs) in that pattern are updated with the new device name, and the system automatically re-analyzes patterns to ensure proper grouping.

## Problem Statement

Previously, when renaming a pattern:
- The pattern label would change
- All CPIs in the pattern would get the new device name (if shouldRenameAll=true)
- But patterns were NOT reorganized based on the new names

This caused issues:
1. Renaming "Laptop" to "Test" didn't create a new RP "Test" if one didn't exist
2. Renaming "iPhone" to "Laptop" didn't properly reorganize the patterns
3. Renaming the last "Test" CPI to something else didn't delete the "Test" pattern

## Solution

### Changes Made

#### 1. server.js (Lines 958-967)
Added automatic pattern re-analysis after renaming:
```javascript
if (shouldRenameAll) {
  console.log('Triggering pattern re-analysis after renaming processes');
  chargingPatterns = patternAnalyzer.analyzePatterns(chargingProcesses, chargingPatterns);
}
```

This ensures that after all CPIs are renamed, the system recalculates which processes should be grouped together.

#### 2. patternAnalyzer.js - Pattern Matching Logic (Lines 265-292)

Added device name filtering when matching patterns:
```javascript
// Check if this process has a manually customized device name
const processHasManualName = processDeviceName && 
                              processDeviceName !== processChargerName && 
                              isManuallyCustomized(processDeviceName);

// Find existing pattern that matches
for (const pattern of patterns) {
  // If process has a manual name, only match patterns with the same device name
  if (processHasManualName && pattern.deviceName !== processDeviceName) {
    continue; // Skip patterns with different device names
  }
  // ... similarity check
}
```

This ensures processes with different manual names are kept in separate patterns.

#### 3. patternAnalyzer.js - Pattern Restoration (Lines 338-344)

Updated restoration logic to check device name matches:
```javascript
if (existingPatternForProcess && 
    !restoredPatternIds.has(existingPatternForProcess.id) &&
    existingPatternForProcess.deviceName === processDeviceName) {
  // Only restore if device name matches (process hasn't been renamed)
}
```

This allows reorganization after renaming by not restoring patterns when device names don't match.

## How It Works

### Workflow Example: Renaming "Laptop" to "Test"

1. **User Action**: User renames pattern "Laptop" (with processes [1, 2]) to "Test"
   
2. **API Call**: `PUT /api/patterns/:id/label` with `{ newLabel: "Test", shouldRenameAll: true }`

3. **Server Processing**:
   - Pattern label is updated to "Test"
   - All processes [1, 2] get `deviceName = "Test"`
   - Pattern re-analysis is triggered

4. **Pattern Re-analysis**:
   - System analyzes all completed processes
   - For each process, checks if it has a manual name ("Test" is manual, "Hugo" is not)
   - Finds patterns that match both:
     - Device name (must be "Test")
     - Power profile similarity (>= 0.65 threshold)
   
5. **Results**:
   - If another "Test" pattern exists with similar power profile → processes merge into that pattern
   - If another "Test" pattern exists with different power profile → new "Test" pattern created
   - If no "Test" pattern exists → new "Test" pattern created
   - Old "Laptop" pattern is removed (no processes left)

### Key Principles

1. **Device Name Priority**: Processes with manually customized names are only grouped with patterns having the same device name

2. **Power Profile Similarity**: Within same-named patterns, processes are grouped by power profile similarity (threshold: 0.65)

3. **Pattern Cleanup**: Patterns with no processes are automatically removed during re-analysis

4. **Manual vs Auto Names**: 
   - Manual names: User-assigned names like "My iPhone", "Laptop", "Test"
   - Auto names: System-generated names like "Hugo", "Egon", "Tom", "Hugo 2"

## Testing

### Test Files

1. **test-rerun-recognition.js**: Validates manual names are preserved during pattern rerun (existing test, still passing)

2. **test-pattern-reorganization.js**: Tests core reorganization scenarios with power profile matching

3. **test-comprehensive-rename.js**: Tests all scenarios from the issue description

### Test Coverage

- ✅ Renaming pattern triggers re-analysis
- ✅ Processes are regrouped based on device names
- ✅ Processes are regrouped based on power profiles
- ✅ Empty patterns are deleted
- ✅ Manual names are preserved
- ✅ New patterns are created as needed

## Edge Cases Handled

1. **Duplicate Names**: Cannot rename to existing pattern name directly (returns 409 Conflict). User must merge patterns via merge API.

2. **Power Profile Mismatch**: Processes with same name but different power profiles may end up in separate patterns (e.g., two different "Test" devices).

3. **Charger Name Conflict**: Process `deviceName` matching `chargerName` is treated as auto-generated, not manual.

4. **Pattern Restoration**: Only restores pattern if device name matches, preventing stale pattern preservation after rename.

## API Behavior

### Renaming to New Name (Success)
```
PUT /api/patterns/:id/label
{ newLabel: "Test", shouldRenameAll: true }

Response 200:
{
  success: true,
  oldLabel: "Laptop",
  newLabel: "Test",
  processesUpdated: true
}
```
Result: Pattern renamed, processes updated, patterns reorganized

### Renaming to Existing Name (Conflict)
```
PUT /api/patterns/:id/label
{ newLabel: "iPhone", shouldRenameAll: true }

Response 409:
{
  error: "Label already exists",
  shouldMerge: true,
  targetPatternId: "pattern_123..."
}
```
Result: No change, client should prompt user to merge patterns

## Performance Considerations

- Re-analysis runs only when `shouldRenameAll=true`
- Pattern matching uses O(n*m) where n=processes, m=patterns (acceptable for typical dataset sizes)
- Pattern restoration uses Map for O(1) process lookup

## Backward Compatibility

- ✅ Existing API behavior unchanged
- ✅ Auto-generated pattern names still work
- ✅ Manual pattern renaming still supported
- ✅ Pattern merging still supported
- ✅ No database migration needed

## Security

- ✅ CodeQL scan: 0 vulnerabilities
- ✅ Input validation unchanged (newLabel trimming and validation)
- ✅ No new dependencies added
- ✅ No SQL injection risk (uses in-memory data structures)
