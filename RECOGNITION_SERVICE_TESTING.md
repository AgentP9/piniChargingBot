# Recognition Service Testing Guide

This document describes how to test the new recognition service functionality.

## Test Scenarios

### 1. Rerun Recognition

**Setup:**
- Ensure you have several completed charging processes with patterns identified
- Note the current pattern names and process associations

**Test Steps:**
1. Navigate to the "Recognized Devices" section
2. Click the "🔄 Rerun Recognition" button
3. Confirm the action in the dialog

**Expected Results:**
- All patterns should be cleared and recreated
- Patterns should be reassigned based on power consumption fingerprints
- Process associations should be updated to match new patterns
- Device names should reset to default friendly names (Hugo, Egon, Tom, etc.)

### 2. Rename Individual Process (Pattern Split)

**Setup:**
- Have at least one pattern with multiple charging processes

**Test Steps:**
1. In the Charging Process List, find a completed process with a device name
2. Click the single pencil edit button (✏️) next to the device name
3. Enter a new device name (different from the current pattern)
4. Click "Save Changes"

**Expected Results:**
- The selected process should be removed from its original pattern
- A new pattern should be created with the new device name (if it doesn't exist)
- OR the process should be added to an existing pattern with that name
- The original pattern's count should decrease by 1
- The process should show the new device name in the list
- If the original pattern had only 1 process, it should be deleted

### 3. Rename All Processes in Pattern

**Setup:**
- Have at least one pattern with one or more charging processes

**Test Steps:**
1. In the Charging Process List, find a completed process with a device name
2. Click the double pencil edit button (✏️✏️) next to the device name
3. Enter a new device name
4. Check "Rename all charging sessions" checkbox
5. Click "Save Changes"

**Expected Results:**
- The pattern's device name should update
- All processes in that pattern should show the new device name
- Pattern statistics should remain unchanged
- Process IDs in the pattern should remain the same

### 4. Rename Pattern from Pattern Manager

**Setup:**
- Have at least one recognized pattern

**Test Steps:**
1. In the Recognized Devices section, find a pattern
2. From the ProcessList, click the double pencil button (✏️✏️) for a process in that pattern
3. Enter a new device name
4. Check or uncheck "Rename all charging sessions" as desired
5. Click "Save Changes"

**Expected Results (with "Rename all" checked):**
- Pattern name updates
- All associated process device names update
- Pattern shows in both RDL and CPL with new name

**Expected Results (with "Rename all" unchecked):**
- Pattern name updates
- Process device names remain unchanged
- Historical data preserved with old names

### 5. Merge Patterns via Rename

**Setup:**
- Have at least two different patterns (e.g., "Hugo" and "Egon")

**Test Steps:**
1. Click edit on a process from pattern "Hugo"
2. Enter the name of another existing pattern (e.g., "Egon")
3. Confirm merge when prompted

**Expected Results:**
- Pattern "Hugo" should be merged into "Egon"
- All processes from "Hugo" should now show device name "Egon"
- Pattern "Hugo" should be deleted
- Pattern "Egon" should show increased count
- Statistics should be recalculated for merged pattern

### 6. Bidirectional Updates - RDL to CPL

**Setup:**
- Have at least one pattern visible in RDL

**Test Steps:**
1. From a charging process, click double pencil (✏️✏️) to edit the pattern
2. Change the device name
3. Check the charging process list

**Expected Results:**
- All processes in CPL that belonged to the pattern should show the new name
- RDL should show the pattern with the new name
- Association between RD and processes maintained

### 7. Bidirectional Updates - CPL to RDL

**Setup:**
- Have at least one pattern with processes

**Test Steps:**
1. From ProcessList, rename a single process (single pencil ✏️)
2. Give it a new unique name
3. Check the RDL (Recognized Devices)

**Expected Results:**
- New pattern appears in RDL with the new name
- Original pattern in RDL shows decreased count
- Both patterns visible and selectable in RDL

## Edge Cases

### Empty Pattern Cleanup
**Test:** Rename the only process in a pattern to a different name
**Expected:** Original pattern should be automatically deleted

### Merge to Self
**Test:** Try to rename a pattern to its own name
**Expected:** No changes should occur

### Invalid Input
**Test:** Try to save with empty device name
**Expected:** Error message should appear

### Process Without Pattern
**Test:** Try to edit a process that has no pattern
**Expected:** Edit button should not appear

### Active Process
**Test:** Try to edit an active (ongoing) charging process
**Expected:** Edit button should not appear (only completed processes can be edited)

## Verification Checklist

After running tests, verify:
- [ ] All processes maintain their power consumption data
- [ ] Pattern statistics (avg power, duration) are recalculated correctly after splits/merges
- [ ] No orphaned processes (all completed processes should have a pattern or no pattern)
- [ ] UI refreshes correctly after all operations
- [ ] Data persists after page refresh
- [ ] Backend logs show correct operations

## Common Issues

**Issue:** Pattern count doesn't update immediately
**Solution:** Refresh the page or wait for the 5-second auto-refresh

**Issue:** Can't see edit buttons
**Solution:** Edit buttons only appear for completed processes with patterns

**Issue:** Changes don't persist
**Solution:** Check backend server is running and accessible

**Issue:** Patterns don't reappear after rerun
**Solution:** Ensure processes have sufficient power consumption data (at least 3 power events)
