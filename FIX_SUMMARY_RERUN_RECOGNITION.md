# Fix Summary: Rerun Recognition Override Issue

## Problem Reported
User commented: "Rerun recognition still overrides already assigned patterns."

## Root Cause Analysis

The issue occurred when:
1. User manually assigned device names to individual processes (e.g., "Alice's iPhone")
2. User triggered "rerun recognition" (POST /api/patterns/rerun)
3. The rerun endpoint clears all patterns: `chargingPatterns = []`
4. Pattern analysis is called with an empty patterns array
5. The `analyzePatterns()` function only checked the existing patterns array to preserve manual names
6. Since the array was empty, it generated new patterns with auto-generated names ("Hugo", "Egon", etc.)
7. Manual assignments were lost

## Solution Implemented

Modified the `analyzePatterns()` function to check **process objects themselves** for manually assigned device names, not just existing patterns.

### Key Changes

1. **When creating new patterns**: Check if the process has a manually assigned `deviceName` that:
   - Differs from its `chargerName` (not just the charger name)
   - Is manually customized (verified via `isManuallyCustomized()`)
   - If so, use that name instead of generating "Hugo", "Egon", etc.

2. **When adding to existing patterns**: Also check process device names and prefer manual names over auto-generated ones.

### Code Changes

**File**: `backend/patternAnalyzer.js`

Added in pattern creation block (lines 326-354):
```javascript
// Check if the process has a manually assigned device name
const processDeviceName = process.deviceName;
const processChargerName = process.chargerName || process.deviceName || process.chargerId || process.deviceId;

if (processDeviceName && 
    processDeviceName !== processChargerName && 
    isManuallyCustomized(processDeviceName)) {
  // Use the manually assigned device name from the process
  deviceName = processDeviceName;
  console.log(`Pattern analysis: Using manually assigned device name "${deviceName}" from process ${process.id}`);
} else {
  // Generate unique friendly name...
}
```

Added in pattern matching block (lines 296-307):
```javascript
// Check if the process itself has a manually assigned device name
const processDeviceName = process.deviceName;
const processChargerName = process.chargerName || process.deviceName || process.chargerId || process.deviceId;

if (processDeviceName && 
    processDeviceName !== processChargerName && 
    isManuallyCustomized(processDeviceName) &&
    !isManuallyCustomized(matchedPattern.deviceName)) {
  console.log(`Pattern analysis: Using manually assigned device name "${processDeviceName}" from process ${process.id} over "${matchedPattern.deviceName}"`);
  matchedPattern.deviceName = processDeviceName;
}
```

## Testing

Created `test-rerun-recognition.js` that simulates:
1. Processes with manually assigned device names ("Alice's iPhone")
2. Process without manual name (uses charger name)
3. "Rerun recognition" scenario (empty patterns array)
4. Verification that manual names are preserved

**Test Result**: ✓ PASSED

## Verification

- ✓ Syntax validation passed
- ✓ Code review: No issues found
- ✓ Security scan (CodeQL): 0 vulnerabilities
- ✓ Test coverage: New test created and passing

## Impact

**Before this fix**:
- User assigns "Alice's iPhone" to process 1
- User assigns "Alice's iPhone" to process 2
- User runs "rerun recognition"
- Pattern created with name "Hugo" ❌
- Manual work lost

**After this fix**:
- User assigns "Alice's iPhone" to process 1
- User assigns "Alice's iPhone" to process 2
- User runs "rerun recognition"
- Pattern created with name "Alice's iPhone" ✓
- Manual work preserved

## Backward Compatibility

Fully backward compatible:
- No API changes
- No breaking changes to existing behavior
- Enhances existing functionality
- All previous fixes remain intact

## Commit

**Hash**: e921e8e
**Message**: Fix rerun recognition to preserve manually assigned device names from processes
**Files**: backend/patternAnalyzer.js, test-rerun-recognition.js

## Documentation

Updated `PATTERN_IMPROVEMENTS.md` with:
- Explanation of the fix
- New code examples
- Scenario comparison (before/after)
- Implementation details

## User Response

Replied to user comment (ID: 3735663765) with:
- Fix commit hash
- Brief explanation of the issue and solution
- Reference to included test
