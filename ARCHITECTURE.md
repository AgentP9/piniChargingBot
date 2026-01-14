# Recognition Service Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐                    ┌────────────────────┐   │
│  │ PatternManager │                    │   ProcessList      │   │
│  │  (RDL View)    │                    │   (CPL View)       │   │
│  │                │                    │                    │   │
│  │  • List RDs    │◄──────────────────►│  • List CPIs      │   │
│  │  • Rerun       │   Bidirectional    │  • Edit (✏️)      │   │
│  │  • Delete      │   Updates          │  • Edit All (✏️✏️)│   │
│  └────────────────┘                    └────────────────────┘   │
│         │                                        │               │
│         │                                        │               │
│         ▼                                        ▼               │
│  ┌────────────────┐                    ┌────────────────────┐   │
│  │DeviceLabelModal│                    │ProcessLabelModal   │   │
│  │  (Pattern)     │                    │  (Single Process)  │   │
│  └────────────────┘                    └────────────────────┘   │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/REST API
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      Backend (Express.js)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  API Endpoints:                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ POST   /api/patterns/rerun                               │   │
│  │ PUT    /api/patterns/:id/label                           │   │
│  │ POST   /api/patterns/merge                               │   │
│  │ DELETE /api/patterns/:id                                 │   │
│  │ PUT    /api/processes/:id/device-name ◄── NEW           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Core Logic:                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Pattern Analysis (patternAnalyzer.js)                    │   │
│  │  • calculatePowerProfile()                               │   │
│  │  • calculateProfileSimilarity()                          │   │
│  │  • analyzePatterns()                                     │   │
│  │  • mergePatterns()                                       │   │
│  │  • updatePatternLabel()                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Storage (storage.js):                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • charging-processes.json                                │   │
│  │ • charging-patterns.json                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Recognized Device (RD) - Pattern
```javascript
{
  id: "pattern_1234567890_abc",
  chargerId: "charger_id",
  chargerName: "Office Charger",
  deviceName: "Hugo",              // ◄── User-editable device name
  count: 4,
  processIds: [1, 3, 7, 9],        // ◄── Links to processes
  averageProfile: { ... },
  statistics: { ... },
  firstSeen: "2026-01-01T...",
  lastSeen: "2026-01-10T..."
}
```

### Charging Process Item (CPI) - Process
```javascript
{
  id: 1,
  chargerId: "charger_id",
  chargerName: "Office Charger",
  deviceName: "Hugo",              // ◄── Charged device name (from pattern)
  startTime: "2026-01-01T...",
  endTime: "2026-01-01T...",
  events: [ ... ]
}
```

## Operation Flows

### 1. Rerun Recognition
```
User Action (RDL)
    │
    ▼
[Rerun Button] → Confirm Dialog
    │
    ▼
POST /api/patterns/rerun
    │
    ├─► Clear chargingPatterns = []
    │
    ├─► analyzePatterns(allProcesses)
    │   │
    │   ├─► For each completed process
    │   │   └─► Calculate power profile
    │   │       └─► Compare with existing patterns
    │   │           ├─► Similar? → Add to pattern
    │   │           └─► Different? → Create new pattern
    │   │
    │   └─► Return new patterns
    │
    └─► Save patterns to disk
    │
    ▼
UI Refresh (both RDL and CPL)
```

### 2. Rename Single Process (Split Pattern)
```
User Action (CPL)
    │
    ▼
[Single Edit ✏️] → ProcessLabelModal
    │
    ▼
Enter new device name
    │
    ▼
PUT /api/processes/:id/device-name
    │
    ├─► Update process.deviceName
    │
    ├─► Find current pattern
    │   │
    │   ├─► Remove process from pattern.processIds
    │   │
    │   └─► If pattern empty → Delete pattern
    │
    ├─► Check if new device name exists
    │   │
    │   ├─► Exists? → Add to existing pattern
    │   │
    │   └─► New? → Create new pattern
    │       │
    │       ├─► Calculate power profile
    │       ├─► Set deviceName
    │       └─► Add process ID
    │
    └─► Save all changes
    │
    ▼
UI Refresh (both RDL and CPL)
```

### 3. Rename Pattern (Edit All)
```
User Action (CPL or RDL)
    │
    ▼
[Double Edit ✏️✏️] → DeviceLabelModal
    │
    ▼
Enter new device name + shouldRenameAll
    │
    ▼
PUT /api/patterns/:id/label
    │
    ├─► Check if label exists
    │   │
    │   ├─► Exists? → Offer merge
    │   │   └─► User confirms?
    │   │       └─► POST /api/patterns/merge
    │   │
    │   └─► New? → Update pattern
    │
    ├─► If shouldRenameAll:
    │   └─► For each process in pattern.processIds
    │       └─► Update process.deviceName
    │
    └─► Save all changes
    │
    ▼
UI Refresh (both RDL and CPL)
```

## Bidirectional Linking

### RDL → CPL Updates
```
Pattern.deviceName changed
    │
    ▼
Update Pattern in storage
    │
    ▼
For each processId in Pattern.processIds:
    └─► Update Process.deviceName
    │
    ▼
CPL shows updated device names
```

### CPL → RDL Updates
```
Process.deviceName changed
    │
    ▼
Update Process in storage
    │
    ▼
Remove from old Pattern.processIds
    │
    ├─► Pattern empty? → Delete
    │
Add to new/existing Pattern.processIds
    │
    ├─► Exists? → Join pattern
    │
    └─► New? → Create pattern
    │
    ▼
RDL shows updated patterns
```

## Key Design Principles

1. **Single Source of Truth**
   - Processes stored in charging-processes.json
   - Patterns stored in charging-patterns.json
   - Process IDs link them together

2. **Bidirectional Updates**
   - Changes in RDL propagate to CPL
   - Changes in CPL propagate to RDL
   - UI refreshes after every operation

3. **Atomic Operations**
   - All changes saved atomically
   - Temp files used for safety
   - Rollback on failure

4. **User Control**
   - Explicit confirmations for destructive actions
   - Clear distinction between single/bulk operations
   - Helpful tooltips and explanations

5. **Performance**
   - O(n) algorithms for filtering
   - Efficient pattern matching
   - Throttled saves (5 seconds)
   - Async pattern analysis

## Edge Cases Handled

✅ Empty pattern cleanup after single process rename
✅ Merge confirmation when renaming to existing device
✅ Validation of all inputs
✅ Atomic saves with temp files
✅ Pattern recreation on rerun
✅ Active processes excluded from editing
✅ Processes without patterns handled gracefully
