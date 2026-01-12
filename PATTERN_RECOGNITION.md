# Pattern Recognition Feature

## Overview

The pattern recognition feature automatically analyzes completed charging processes to identify patterns and group similar charging sessions. This enables the system to recognize the same **devices being charged** (like iPhones, TonieBoxes) based on their power consumption characteristics, even without explicit device identification.

## Key Terminology

- **Charger**: Physical charging device (e.g., ShellyPlug) that provides power
- **Device**: Item being charged (e.g., iPhone, TonieBox, etc.)
- **Charging Process**: A session when a device is connected to a charger
- **Pattern**: A unique fingerprint of a device's charging behavior

## How It Works

### Device Fingerprinting

The system creates a "fingerprint" for each charging session based on:

1. **Power Consumption Statistics**:
   - Average, median, min, max power consumption
   - Standard deviation (variation in power)
   - Percentiles (25th, 50th, 75th)

2. **Charging Curve Shape**:
   - Early phase power consumption
   - Middle phase power consumption
   - Late phase power consumption
   
   This captures characteristic charging behaviors:
   - **Fast charging devices** (e.g., iPhones): High initial power that tapers off
   - **Steady charging devices** (e.g., TonieBoxes): Consistent power throughout
   - **Other patterns**: Each device type has unique characteristics

3. **Peak Power Behavior**:
   - Ratio of time spent at high power
   - Helps distinguish devices with burst vs. steady charging

### Pattern Grouping

Charging sessions with similar power profiles (similarity score > 65%) are automatically grouped into patterns. Each pattern represents a likely unique device being charged.

### Pattern Matching

When a new charging session completes, it can be matched against existing patterns to:
- Identify which device was likely charged
- Predict expected charging duration based on historical data
- Track charging history for specific devices

## API Endpoints

### GET /api/patterns

Get all identified charging patterns.

**Response:**
```json
[
  {
    "id": "pattern_xxx",
    "chargerId": "charger_id",
    "chargerName": "Office Charger",
    "deviceName": "Hugo",
    "count": 4,
    "processIds": [1, 3, 7, 9],
    "averageProfile": {
      "mean": 11.5,
      "stdDev": 4.2,
      "min": 5.0,
      "max": 18.0,
      "median": 12.5,
      "p25": 8.0,
      "p75": 16.0,
      "peakPowerRatio": 0.25,
      "curveShape": {
        "early": 17.0,
        "middle": 12.0,
        "late": 7.0
      }
    },
    "statistics": {
      "averageDuration": 120.5,
      "minDuration": 110.0,
      "maxDuration": 130.0,
      "medianDuration": 120.0,
      "totalSessions": 4
    },
    "firstSeen": "2026-01-01T10:00:00.000Z",
    "lastSeen": "2026-01-10T15:30:00.000Z"
  }
]
```

### GET /api/patterns/charger/:chargerId

Get patterns for a specific charger (charging port).

**Example:** `GET /api/patterns/charger/kitchen_charger`

### POST /api/patterns/analyze

Manually trigger pattern analysis on all completed charging processes.

**Response:**
```json
{
  "success": true,
  "message": "Pattern analysis completed",
  "patternsFound": 3
}
```

### GET /api/processes/:id/pattern

Get the matching pattern for a specific charging process.

**Example:** `GET /api/processes/42/pattern`

**Response:**
```json
{
  "processId": 42,
  "matchFound": true,
  "pattern": { /* pattern object */ },
  "similarity": 0.92
}
```

## Automatic Analysis

Pattern analysis runs automatically in the following scenarios:

1. **On Server Startup**: Analyzes all existing completed processes
2. **When a Process Completes**: Immediately after a charging session ends
3. **Periodically**: Every 1 hour to catch any updates

## Data Storage

Identified patterns are stored persistently in:
- File: `data/charging-patterns.json`
- Format: JSON
- Updated: Automatically after each analysis

## Use Cases

### Current Capabilities

1. **Device Identification**: Recognize which device was charged based on power consumption
2. **Pattern Statistics**: Track average charging duration and power consumption for each device type
3. **Historical Tracking**: See how many times each device has been charged

### Future Enhancements (Foundation Laid)

1. **Charging Time Forecasting**: Predict remaining charging time based on:
   - Current power consumption profile
   - Matched pattern's average duration
   - Progress through charging curve

2. **Anomaly Detection**: Alert when charging behaves differently than expected

3. **Device Naming**: Allow users to label identified patterns with device names (e.g., "John's iPhone", "Kids' TonieBox")

## Example Patterns

### iPhone-like Pattern
- High initial power (15-18W)
- Gradually decreasing power consumption
- Typical duration: 90-120 minutes
- Curve: Early 17W → Middle 12W → Late 6W

### TonieBox-like Pattern
- Steady low power (5-6W)
- Minimal variation throughout charging
- Typical duration: 180-240 minutes
- Curve: Consistent 5.5W throughout

### Other Devices
Each device creates its own unique "fingerprint" based on its charging controller's behavior.

## Technical Details

### Similarity Algorithm

Patterns are matched using a weighted similarity score:
- Mean power: 20%
- Median power: 15%
- Standard deviation: 10%
- Peak power ratio: 15%
- Curve shape: 40% (most important)

Similarity threshold: 0.65 (65%)

### Pattern Updates

When a new process matches an existing pattern:
- Pattern statistics are updated with running averages
- Process is added to the pattern's process list
- Duration statistics are recalculated

### Performance

- Analysis is efficient even with thousands of processes
- Runs asynchronously to avoid blocking the main thread
- Throttled to prevent excessive disk I/O
