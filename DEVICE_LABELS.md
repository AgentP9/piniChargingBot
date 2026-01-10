# Device Label Management

## Overview

The device label management feature allows you to manage the labels (names) assigned to recognized charging device patterns. Each pattern represents a unique device that has been identified through its power consumption fingerprint.

## Features

### 1. Edit Device Labels

You can rename any recognized device pattern:
- Click the edit button (✏️) next to a device name in the charging process list
- Enter a new name or select from existing devices
- Choose whether to rename all historical charging sessions

### 2. Unique Label Constraint

Each device pattern must have a unique label:
- Attempting to rename a device to an existing name will prompt you to merge the patterns
- This ensures clear identification of devices in your system

### 3. Merge Patterns

When renaming a device to match an existing device name:
- The system automatically detects the conflict
- Prompts you to confirm merging the two patterns
- Combines all charging sessions from both patterns
- Recalculates statistics based on the merged data
- Removes the source pattern, keeping only the merged result

### 4. Bulk Rename

When updating a device label, you can choose to:
- **Rename all sessions** (default): Updates all historical charging processes with the old label to use the new label
- **Rename pattern only**: Only the pattern label changes; historical processes keep their original labels

### 5. Delete Patterns

Remove patterns that are no longer needed:
- Click the delete button (🗑️) in the Pattern Manager
- Charging processes are NOT deleted; they keep their labels
- The pattern is removed from the system

## User Interface

### Pattern Manager

Located in the "Connected Chargers" section, below the charger list:
- Shows all recognized device patterns
- Displays session count for each pattern
- Expand button (▶) to view detailed statistics
- Delete button (🗑️) to remove patterns

#### Pattern Details (when expanded)
- **Average Power**: Mean power consumption during charging
- **Average Duration**: Typical charging time
- **Total Sessions**: Number of times this device has been charged
- **Last Seen**: Most recent charging session
- **Charging Profile**: Power consumption curve (Early/Middle/Late phases)

### Edit Label Modal

Appears when clicking the edit button (✏️) on a device label:
- **Input field**: Enter new device name
  - Shows autocomplete suggestions as you type
  - Click a suggestion to select it
- **Existing devices dropdown**: Lists all current device names
  - Click to select and automatically merge if confirmed
- **Rename all sessions checkbox**: 
  - Checked (default): Updates all historical data
  - Unchecked: Only updates the pattern label
- **Pattern Info box**: Shows statistics about the current pattern
- **Cancel button**: Discard changes
- **Save Changes button**: Apply the new label

## How It Works

### Device Recognition

1. When devices are charged, the system records power consumption data
2. After charging completes, pattern analysis identifies the device based on its "fingerprint"
3. Similar charging sessions are automatically grouped into patterns
4. Each pattern is assigned a default label (e.g., Hugo, Egon, Tom, Jerry)

### Label Management Flow

#### Simple Rename
```
User edits label "Hugo" → "iPhone 12"
↓
System updates pattern label
↓
If "rename all" checked: All processes with "Hugo" → "iPhone 12"
↓
UI refreshes to show new label
```

#### Merge Patterns
```
User edits label "Hugo" → "Egon" (existing device)
↓
System detects conflict
↓
Prompts user to confirm merge
↓
If confirmed:
  - Combines pattern data (processIds, statistics)
  - Updates all "Hugo" processes to "Egon"
  - Removes "Hugo" pattern
  - Recalculates "Egon" statistics
↓
UI refreshes to show merged pattern
```

#### Delete Pattern
```
User clicks delete on "Hugo" pattern
↓
Confirmation dialog appears
↓
If confirmed:
  - Pattern removed from system
  - Processes keep their "Hugo" label
  - Pattern no longer available for filtering
↓
UI refreshes
```

## API Endpoints

### Update Pattern Label
```http
PUT /api/patterns/:patternId/label
Content-Type: application/json

{
  "newLabel": "My Device Name",
  "shouldRenameAll": true
}
```

**Response:**
- `200 OK`: Label updated successfully
- `404 Not Found`: Pattern doesn't exist
- `409 Conflict`: Label already exists (should merge)

### Merge Patterns
```http
POST /api/patterns/merge
Content-Type: application/json

{
  "sourcePatternId": "pattern_123",
  "targetPatternId": "pattern_456"
}
```

**Response:**
- `200 OK`: Patterns merged successfully
- `404 Not Found`: One or both patterns don't exist
- `400 Bad Request`: Invalid input (e.g., trying to merge a pattern with itself)

### Delete Pattern
```http
DELETE /api/patterns/:patternId
```

**Response:**
- `200 OK`: Pattern deleted successfully
- `404 Not Found`: Pattern doesn't exist

## Data Storage

### Pattern Data
Stored in: `backend/data/charging-patterns.json`

Contains:
- Pattern ID
- Device name (label)
- Device ID (physical charger)
- Process IDs (linked charging sessions)
- Average power profile
- Statistics (duration, sessions, etc.)

### Process Data
Stored in: `backend/data/charging-processes.json`

Contains:
- Process ID
- Device ID (physical charger)
- Device name (label from pattern)
- Start/end times
- Power consumption events

## Best Practices

### Naming Conventions
- Use descriptive, unique names: "John's iPhone", "Kitchen TonieBox"
- Avoid generic names: "Device 1", "Phone"
- Consider the device owner: "Alice's iPad", "Bob's Laptop"

### When to Merge
Merge patterns when:
- You accidentally created duplicate patterns for the same device
- You want to consolidate historical data under one name
- Pattern recognition split one device into multiple patterns

### When to Delete
Delete patterns when:
- You no longer use that device
- Pattern was incorrectly identified
- You want to clean up old data

### Bulk Rename Consideration
- Use "rename all" when you want consistent historical data
- Don't use "rename all" if you want to preserve the original context of old sessions

## Troubleshooting

### Can't see edit button
- Edit button only appears on completed processes with matched patterns
- Active (ongoing) processes don't have edit buttons
- Processes without patterns don't have edit buttons

### Changes don't save
- Check that the backend is running
- Verify write permissions on `backend/data/` directory
- Check browser console for errors
- Check backend logs for error messages

### Pattern merge doesn't work
- Verify both patterns exist
- Check that you're not trying to merge a pattern with itself
- Ensure the backend API is responding correctly

### Lost data after merge
- Merged data is preserved in the target pattern
- All process IDs are combined
- Statistics are recalculated based on all sessions
- To recover: restore from backup if available

## Technical Details

### Pattern Merging Algorithm

When patterns are merged:
1. All process IDs from source added to target
2. Count updated (sum of both patterns)
3. Average profile recalculated (weighted average based on session counts)
4. Min/Max values updated (take actual min/max)
5. Timestamps updated (earliest first seen, latest last seen)
6. Statistics recalculated (weighted averages)
7. Source pattern removed from array

### Label Uniqueness Check

On label update:
1. Search for existing pattern with same deviceName
2. If found (and different pattern): return conflict error
3. If not found: update label
4. Save patterns to disk

### Process Updates

When shouldRenameAll is true:
1. Find all processes in pattern's processIds array
2. Update each process's deviceName field
3. Save processes to disk
4. UI automatically refreshes to show updates

## See Also

- [Pattern Recognition Documentation](PATTERN_RECOGNITION.md)
- [Testing Guide](DEVICE_LABELS_TESTING.md)
- [Troubleshooting Patterns](TROUBLESHOOTING_PATTERNS.md)
