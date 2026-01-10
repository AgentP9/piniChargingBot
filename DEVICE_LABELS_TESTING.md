# Device Label Management - Testing Guide

This guide explains how to test the new device label management features.

## Feature Overview

The device label management feature allows users to:
1. **Edit device labels** - Rename recognized device patterns
2. **Merge patterns** - Combine two patterns when renaming to an existing device name
3. **Delete patterns** - Remove a pattern from the system
4. **Bulk rename** - Update all historical charging processes with the new label

## Prerequisites

Before testing, you need:
1. Running backend server with MQTT connection
2. Running frontend
3. At least 2 completed charging processes with power consumption data
4. Pattern analysis run to create recognizable patterns

## Setup Test Environment

### 1. Start the Backend

```bash
cd backend
npm install
npm start
```

The server should start on port 3000 (or PORT from .env).

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend should start on port 5173.

### 3. Create Test Data

If you don't have real MQTT devices, you can manually create test patterns:

1. Check if patterns exist:
   ```bash
   curl http://localhost:3000/api/patterns
   ```

2. If no patterns exist, you'll need to:
   - Connect real MQTT devices and complete charging sessions, OR
   - Manually edit `backend/data/charging-patterns.json` to add test patterns

### 4. Trigger Pattern Analysis

```bash
curl -X POST http://localhost:3000/api/patterns/analyze
```

This will analyze completed charging processes and create patterns.

## Manual Testing Steps

### Test 1: View Pattern Manager

1. Open the frontend in your browser (http://localhost:5173)
2. Look for the "Connected Chargers" section
3. Below the charger list, you should see "Recognized Devices" with a count
4. If patterns exist, they should be listed with session counts

**Expected:** Pattern manager displays correctly with expand/collapse buttons

### Test 2: Expand Pattern Details

1. Click the expand button (▶) next to a pattern
2. The pattern should expand to show:
   - Average Power
   - Average Duration
   - Total Sessions
   - Last Seen date
   - Charging Profile (Early/Middle/Late power consumption)

**Expected:** Pattern details display correctly with all statistics

### Test 3: Edit Device Label (Simple Rename)

1. In the "Charging Processes" section, find a completed process with a device label (e.g., "Device: Hugo")
2. Click the edit button (✏️) next to the device name
3. A modal should appear with:
   - Current device name in the input field
   - Checkbox for "Rename all charging sessions"
   - Pattern info (sessions, duration, power)
4. Change the name to something new (e.g., "iPhone 12")
5. Keep the checkbox checked
6. Click "Save Changes"

**Expected:** 
- Modal closes
- Device label updates in the process list
- All other processes with the same label are also updated
- Pattern manager shows the new name

### Test 4: Edit Device Label (Merge Patterns)

1. Click edit on a device label
2. In the modal, type the name of a DIFFERENT existing device (e.g., if you have "Hugo" and "Egon", rename "Hugo" to "Egon")
3. A confirmation dialog should appear asking if you want to merge patterns
4. Click "OK" to confirm merge

**Expected:**
- Both patterns are merged into one
- All charging sessions from both patterns now have the same label
- Pattern count increases (sum of both patterns)
- Old pattern is removed from pattern manager

### Test 5: Edit Without Bulk Rename

1. Click edit on a device label
2. Change the name
3. UNCHECK the "Rename all charging sessions" checkbox
4. Click "Save Changes"

**Expected:**
- Pattern label updates
- Historical charging processes keep their old labels (only future matches will use new label)

### Test 6: Delete Pattern

1. In the Pattern Manager, find a pattern
2. Click the delete button (🗑️)
3. Confirm the deletion in the dialog

**Expected:**
- Pattern is removed from the Pattern Manager
- Charging processes are NOT deleted (they keep their labels)
- Pattern no longer appears in the device filter dropdown

### Test 7: Autocomplete Suggestions

1. Click edit on a device label
2. Start typing a partial name of another existing device
3. A dropdown should appear with matching device names
4. Click on a suggestion

**Expected:**
- Input field populates with the selected name
- Dropdown closes

### Test 8: Cancel Operations

1. Click edit on a device label
2. Make changes but click "Cancel"

**Expected:** No changes are made

### Test 9: Validation

1. Click edit on a device label
2. Clear the input field (leave it empty)
3. Try to save

**Expected:** Alert appears saying "Please enter a device name"

## API Testing

You can also test the API endpoints directly:

### List Patterns
```bash
curl http://localhost:3000/api/patterns
```

### Update Label
```bash
curl -X PUT http://localhost:3000/api/patterns/PATTERN_ID/label \
  -H "Content-Type: application/json" \
  -d '{"newLabel": "My Device", "shouldRenameAll": true}'
```

Replace `PATTERN_ID` with an actual pattern ID from the list.

### Merge Patterns
```bash
curl -X POST http://localhost:3000/api/patterns/merge \
  -H "Content-Type: application/json" \
  -d '{"sourcePatternId": "SOURCE_ID", "targetPatternId": "TARGET_ID"}'
```

### Delete Pattern
```bash
curl -X DELETE http://localhost:3000/api/patterns/PATTERN_ID
```

### Debug Info
```bash
curl http://localhost:3000/api/patterns/debug
```

## Troubleshooting

### No patterns appear
- Make sure you have completed charging processes
- Run pattern analysis: `curl -X POST http://localhost:3000/api/patterns/analyze`
- Check that processes have power consumption data (not just on/off events)
- Need at least 3 power consumption events per process

### Edit button doesn't appear
- Edit button only appears on completed processes that have a matched pattern
- Active (ongoing) processes don't have edit buttons

### Changes don't persist
- Check backend console for errors
- Check that data directory is writable: `backend/data/`
- Verify files are being saved: `ls -la backend/data/`

### Modal doesn't close after merge
- Check browser console for errors
- Verify the merge API call succeeded
- Try refreshing the page

## Expected Behaviors

### Unique Label Constraint
- Each pattern must have a unique device name
- Attempting to rename to an existing name triggers merge dialog
- After merge, only one pattern exists with the combined data

### Process Association
- Charging processes are linked to patterns via processIds array
- When a pattern is deleted, processes keep their labels but lose pattern association
- When patterns merge, all processes are reassigned to the target pattern

### Data Persistence
- All changes are immediately saved to disk
- Pattern data: `backend/data/charging-patterns.json`
- Process data: `backend/data/charging-processes.json`

## Success Criteria

The feature is working correctly if:
- ✓ You can view all recognized device patterns
- ✓ You can edit device labels through the UI
- ✓ You can merge patterns by renaming to existing names
- ✓ You can delete patterns
- ✓ Bulk rename updates all historical processes
- ✓ Changes persist across server restarts
- ✓ UI updates immediately after changes
- ✓ Autocomplete shows existing device names
