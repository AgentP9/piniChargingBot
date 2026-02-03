# Charging End Detection Feature

## Overview
This feature automatically detects when a device charging session is nearing completion and provides visual feedback by changing the charger color from green to yellow.

## How It Works

### Detection Logic
The system monitors power consumption patterns during active charging sessions. A charger is considered to be in the "completion phase" when:

1. **Power drops below threshold**: Power consumption falls below 5 Watts
2. **Stable low power**: Power remains below the threshold for at least 5 minutes
3. **Sufficient data**: At least 10 power consumption events recorded, with at least 3 recent events

This pattern is typical of devices that have finished their fast-charging phase and are only maintaining trickle charge.

### Visual Feedback

The charger display changes color based on its status:

- **Green (#10b981)**: Normal active charging
- **Yellow (#f59e0b)**: Charging nearing completion (completion phase detected)
- **Gray**: Charger is off

Both the charger card background and the toggle switch change to yellow when completion is detected.

### Technical Implementation

#### Backend
- **Endpoint**: `GET /api/chargers/:chargerId/completion-status`
- **Function**: Uses `patternAnalyzer.isInCompletionPhase(process)` to analyze power events
- **Response**: Returns whether the charger is active and if it's in completion phase

Example response:
```json
{
  "chargerId": "charger_id",
  "processId": 123,
  "isActive": true,
  "isInCompletionPhase": true,
  "message": "Charging is nearing completion"
}
```

#### Frontend
- **Component**: `DeviceList.jsx`
- **Polling interval**: Every 30 seconds
- **State management**: Uses React hooks to track completion status for each active charger
- **Rendering**: Applies conditional CSS classes based on completion status

#### CSS Classes
- `.device-item.device-completing`: Yellow gradient background for charger cards
- `.toggle-switch.toggle-completing`: Yellow background for toggle switches

## Benefits

1. **User convenience**: Quickly see which devices are almost done charging
2. **Energy efficiency**: Know when to unplug devices to avoid unnecessary power consumption
3. **Time management**: Better planning when waiting for devices to charge
4. **Pattern-based**: Uses actual power consumption data, not just time estimates

## Testing

Run the test suite to verify the feature:
```bash
node tests/test-completion-detection.js
```

The test verifies:
- Active charging with high power is not marked as completing
- Charging with sustained low power is correctly identified as completing
- Insufficient data scenarios are handled properly
- Completed processes are not marked as completing

## Future Enhancements

Potential improvements for future versions:
- Configurable power threshold and time duration
- Notifications when charging completes
- Auto-off functionality when completion is detected
- Historical completion time tracking for better predictions
