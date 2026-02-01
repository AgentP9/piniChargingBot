# Pattern Recognition Improvements

## Overview

This document describes improvements made to the pattern recognition system to address two key issues:

1. **Pattern Preservation**: Manually identified devices and assigned patterns are now preserved during pattern re-analysis and rerun
2. **Auto-Assignment**: High-confidence pattern matches are automatically assigned as valid device names when charging completes

## Issue 1: Pattern Preservation

### Problem
When users manually customized device names (e.g., changing "Hugo" to "Alice's iPhone" or manually assigning a device name to a process), running pattern recognition would sometimes overwrite these manual customizations with auto-generated names. This was especially problematic when using the "rerun recognition" feature which clears all patterns.

### Solution
The pattern analysis algorithm now:
1. Detects which device names are manually customized vs. auto-generated
2. Preserves manually customized names when patterns are merged during re-analysis
3. Gives preference to manual customizations over auto-generated names
4. **NEW**: Checks if individual processes have manually assigned device names and uses those when creating patterns, even during "rerun recognition"

### Implementation Details

#### `isManuallyCustomized(deviceName)` Function
Determines if a device name appears to be manually customized:
- Returns `false` for default names: "Hugo", "Egon", "Tom", "Jerry", "Alice", "Bob", etc.
- Returns `false` for auto-generated numbered variants: "Hugo 2", "Egon 3", etc.
- Returns `true` for all other names (e.g., "Alice's iPhone", "Kitchen TonieBox")

#### Pattern Analysis Logic - Existing Patterns
When re-analyzing patterns with existing patterns in memory:
```javascript
// If process had a manually customized pattern and current pattern doesn't,
// preserve the manual name
if (existingPatternForProcess && 
    isManuallyCustomized(existingPatternForProcess.deviceName) &&
    !isManuallyCustomized(matchedPattern.deviceName)) {
  matchedPattern.deviceName = existingPatternForProcess.deviceName;
}
```

#### Pattern Analysis Logic - Process Device Names (NEW)
When creating new patterns or no existing patterns are available (e.g., during "rerun recognition"):
```javascript
// Check if the process has a manually assigned device name
const processDeviceName = process.deviceName;
const processChargerName = process.chargerName || ...;

if (processDeviceName && 
    processDeviceName !== processChargerName && 
    isManuallyCustomized(processDeviceName)) {
  // Use the manually assigned device name from the process
  deviceName = processDeviceName;
}
```

This ensures that manually assigned device names on individual processes are preserved even when patterns are completely cleared and recreated.

### Example Scenarios

**Scenario 1: Pattern rename (Original fix)**

Before fix:
1. User manually names a pattern "My iPhone"
2. User runs pattern re-analysis
3. Pattern gets renamed back to "Hugo" (auto-generated) ❌

After fix:
1. User manually names a pattern "My iPhone"
2. User runs pattern re-analysis
3. Pattern keeps the name "My iPhone" ✓

**Scenario 2: Process device name assignment + rerun (NEW fix)**

Before fix:
1. User manually assigns device name "Alice's iPhone" to process 1 via `/api/processes/1/device-name`
2. User manually assigns device name "Alice's iPhone" to process 2
3. User runs "rerun recognition" (POST /api/patterns/rerun)
4. All patterns cleared, processes re-analyzed
5. New pattern created with auto-generated name "Hugo" ❌
6. Manual work lost!

After fix:
1. User manually assigns device name "Alice's iPhone" to process 1 via `/api/processes/1/device-name`
2. User manually assigns device name "Alice's iPhone" to process 2
3. User runs "rerun recognition" (POST /api/patterns/rerun)
4. All patterns cleared, processes re-analyzed
5. New pattern created with name "Alice's iPhone" from the process ✓
6. Manual work preserved!

## Issue 2: High-Confidence Auto-Assignment

### Problem
When a charging process completed with a high-confidence pattern match (e.g., 92% similarity), the system would show a "guess" but never actually save it to the process. Users had to manually assign the device name.

### Solution
The system now automatically assigns device names when:
- A charging process completes (either via MQTT or manual completion)
- A pattern match is found with confidence ≥ 85% (`HIGH_CONFIDENCE_THRESHOLD`)
- The matched pattern's device name is automatically set on the process

### Implementation Details

#### Configuration
```javascript
// High confidence threshold for auto-assigning device names
// When a charging process completes with a pattern match above this threshold,
// automatically assign the device name
const HIGH_CONFIDENCE_THRESHOLD = 0.85;
```

#### Auto-Assignment Logic
Added to both charging completion paths:
1. **MQTT power-off event** (automatic charging end detection)
2. **Manual completion endpoint** (`PUT /api/processes/:id/complete`)

```javascript
// Check if there's a high-confidence pattern match
const match = patternAnalyzer.findMatchingPattern(process, chargingPatterns);
if (match && match.similarity >= patternAnalyzer.HIGH_CONFIDENCE_THRESHOLD) {
  // Auto-assign the device name
  process.deviceName = match.pattern.deviceName;
  console.log(`Auto-assigned device name "${match.pattern.deviceName}" to process ${processId} (confidence: ${match.similarity})`);
}
```

### Example Scenario

**Before fix:**
1. Device charges and completes
2. System finds 92% confidence match to "Hugo" pattern
3. User has to manually check the guess and assign the name ❌

**After fix:**
1. Device charges and completes
2. System finds 92% confidence match to "Hugo" pattern
3. Device name is automatically set to "Hugo" ✓
4. User can still manually rename if needed

## Testing

Three comprehensive test suites were created to validate the implementation:

### Test 1: Basic Pattern Preservation (`test-pattern-preservation.js`)
- Validates `isManuallyCustomized()` function with various inputs
- Tests that `HIGH_CONFIDENCE_THRESHOLD` is exported correctly
- Verifies manual customizations are preserved during re-analysis

### Test 2: Edge Case Testing (`test-pattern-edge-case.js`)
- Tests scenario where new processes match an existing manually customized pattern
- Ensures manual names are preserved when patterns grow

### Test 3: Pattern Merging (`test-pattern-merge.js`)
- Tests complex scenario where two separate patterns are merged
- Verifies that manual customization is preserved when patterns are merged
- Confirms the manually customized name takes precedence

**All tests pass successfully ✓**

## Benefits

1. **Better User Experience**: Users don't lose their manual customizations
2. **Reduced Manual Work**: High-confidence matches are automatically assigned
3. **Maintains Flexibility**: Users can still manually override any auto-assignments
4. **Backward Compatible**: Works with existing pattern data without migration

## Configuration

### Adjusting the Confidence Threshold

If you find that the auto-assignment is too aggressive or too conservative, you can adjust the `HIGH_CONFIDENCE_THRESHOLD` constant in `backend/patternAnalyzer.js`:

```javascript
// Current value: 0.85 (85% confidence)
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

// For more conservative auto-assignment (only very confident matches):
const HIGH_CONFIDENCE_THRESHOLD = 0.90;

// For more aggressive auto-assignment (more matches):
const HIGH_CONFIDENCE_THRESHOLD = 0.80;
```

**Recommended range:** 0.80 - 0.90

## API Changes

No breaking changes to the API. All endpoints continue to work as before, with enhanced behavior:

- `POST /api/patterns/analyze` - Now preserves manual customizations
- `POST /api/patterns/rerun` - Now preserves manual customizations
- `PUT /api/processes/:id/complete` - Now auto-assigns high-confidence matches

## Backward Compatibility

The changes are fully backward compatible:
- Existing pattern files will work without modification
- Processes without patterns continue to work as before
- The guess endpoint (`GET /api/processes/:id/guess`) still works for in-progress processes
- All existing functionality is preserved

## Future Enhancements

Potential future improvements could include:
1. User-configurable confidence threshold via environment variable
2. Option to enable/disable auto-assignment per charger
3. Notification when auto-assignment occurs
4. History log of auto-assignments for review
