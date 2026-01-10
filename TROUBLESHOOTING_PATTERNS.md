# Pattern Recognition Troubleshooting Guide

## Why am I not seeing device names?

The pattern recognition feature assigns friendly names (Hugo, Egon, Tom, Jerry, etc.) to charging processes based on their power consumption patterns. If you're not seeing device names, here are the common reasons and solutions:

### Requirements for Pattern Recognition

For a charging process to get a device name, it must meet ALL of these criteria:

1. **Process must be completed** (has an `endTime`)
2. **Process must have at least 3 power consumption events** 
3. **Pattern analysis must have run**
4. **Process must be included in a pattern**

### Diagnostic Steps

#### 1. Check the Diagnostic Endpoint

Visit: `http://your-server:port/api/patterns/debug`

This endpoint shows:
- Total number of processes
- How many are completed
- How many have power consumption data
- Which processes have patterns assigned

Example response:
```json
{
  "totalProcesses": 6,
  "completedProcesses": 6,
  "processesWithPowerData": 6,
  "totalPatterns": 2,
  "processDetails": [
    {
      "id": 1,
      "deviceName": "Kitchen Charger",
      "completed": true,
      "powerEventsCount": 15,
      "hasProfile": true,
      "hasPattern": true,
      "patternId": "pattern_xxx",
      "duration": 120.5
    }
  ]
}
```

#### 2. Check Server Logs

When pattern analysis runs, you'll see logs like:
```
Pattern analysis: Starting with 6 total processes
Pattern analysis: 6 completed processes with power data
Pattern analysis: 4 processes with valid profiles
Process 3: Insufficient power data (2 events, need 3+)
Pattern pattern_xxx: 3 sessions, processes: [1, 2, 4]
Pattern analysis complete: Found 2 patterns
```

#### 3. Manually Trigger Pattern Analysis

If the server was running when your processes completed, pattern analysis might not have run automatically.

**Via API:**
```bash
curl -X POST http://your-server:port/api/patterns/analyze
```

**Via Frontend:** Restart the backend server to trigger analysis on startup.

#### 4. Check Pattern List

Visit: `http://your-server:port/api/patterns`

This shows all identified patterns and which process IDs belong to each pattern.

### Common Issues and Solutions

#### Issue: "Process X: Insufficient power data (N events, need 3+)"

**Cause:** The charging session was too short or power readings weren't captured frequently enough.

**Solution:** 
- Ensure your MQTT power plug is publishing power readings regularly
- Check that charging sessions last long enough to capture multiple readings
- Verify MQTT connection is stable during charging

#### Issue: No patterns found despite having completed processes

**Cause:** Not enough power consumption events in any process.

**Solution:**
- Check the diagnostic endpoint to see `powerEventsCount` for each process
- Processes with fewer than 3 power events will be skipped
- Ensure power readings are being recorded (check `/api/processes/:id` for a process)

#### Issue: Patterns exist but device names not showing in UI

**Cause:** Frontend might not be fetching patterns or patterns don't include your process IDs.

**Solution:**
- Check browser console for errors
- Verify `/api/patterns` returns patterns with your process IDs
- Clear browser cache and reload
- Check that processes are **completed** (not active)

### Understanding Pattern Analysis

**How it works:**
1. Analyzes completed processes with at least 3 power readings
2. Creates a "fingerprint" based on power consumption characteristics
3. Groups similar processes together (same device type)
4. Assigns a friendly name to each pattern
5. All processes in the same pattern get the same device name

**Similarity threshold:** Processes must have 65% or higher similarity to be grouped together.

**Power profile includes:**
- Average, min, max power consumption
- Power consumption curve (early/middle/late phases)
- Standard deviation and percentiles
- Peak power behavior

### Testing Pattern Recognition

To test if pattern recognition is working:

1. **Create test processes** with different charging patterns:
   - Fast charger: starts high (15-18W), tapers down
   - Slow charger: steady low power (5-6W)

2. **Ensure each has multiple power readings** (at least 3, ideally 10+)

3. **Complete the processes** (turn off charging)

4. **Trigger pattern analysis** (manual or wait for automatic)

5. **Check the debug endpoint** to verify patterns were created

### Need More Help?

If you've tried all the above and still have issues:

1. Share the output of `/api/patterns/debug`
2. Share relevant server logs showing pattern analysis
3. Provide details about:
   - How many processes you have
   - How long they typically run
   - Whether they're completed or active
   - Your MQTT setup and power reading frequency
