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
│  │  • Edit (✏️)   │   Bidirectional    │  • Edit (✏️)      │   │
│  │  • Rerun       │   Updates          │  • Delete         │   │
│  │  • Delete      │                    │  • Complete       │   │
│  └────────────────┘                    └────────────────────┘   │
│         │                                        │               │
│         │                                        │               │
│         ▼                                        ▼               │
│  ┌────────────────┐                    ┌────────────────────┐   │
│  │DeviceLabelModal│                    │ProcessLabelModal   │   │
│  │  (Pattern)     │                    │  (Single Process)  │   │
│  │  • Always      │                    │  • Split pattern   │   │
│  │    affects all │                    │  • Join/create     │   │
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
│  │ PUT    /api/processes/:id/device-name                    │   │
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
│  │ Docker Volume: backend-data → /app/data                  │   │
│  │  • charging-processes.json                               │   │
│  │  • charging-patterns.json                                │   │
│  │  • process-counter.json                                  │   │
│  │ ✅ Persists across container updates                     │   │
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

### 3. Edit Recognized Device (RDL)
```
User Action (RDL - Pattern Manager)
    │
    ▼
[Edit ✏️] → DeviceLabelModal
    │
    ▼
Enter new device name
    │
    ▼
Check if name exists → Merge prompt?
    │         │
    │         ├─► Yes → POST /api/patterns/merge
    │         │         (Combine patterns)
    │         │
    │         └─► No → Continue
    │
    ▼
PUT /api/patterns/:id/label
(Always with shouldRenameAll = true)
    │
    ├─► Update pattern.deviceName
    │
    ├─► Update ALL processes in pattern.processIds
    │   └─► Set process.deviceName = new name
    │
    └─► Save all changes
    │
    ▼
UI Refresh (both RDL and CPL)
All processes show new device name
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
   - Data persists in Docker volume (backend-data)

2. **Bidirectional Updates**
   - Changes in RDL propagate to CPL
   - Changes in CPL propagate to RDL
   - UI refreshes after every operation
   - Both views stay synchronized

3. **Clear Edit Separation**
   - **RDL (Pattern Manager)**: Edit ✏️ → affects ALL processes in pattern
   - **CPL (Process List)**: Edit ✏️ → affects ONLY that process (splits pattern)
   - No confusing dual buttons or toggles
   - Predictable, intuitive behavior

4. **Atomic Operations**
   - All changes saved atomically
   - Temp files used for safety
   - Rollback on failure
   - Graceful shutdown preserves data

5. **User Control**
   - Explicit confirmations for destructive actions
   - Merge prompts when renaming to existing device
   - Clear feedback on what will be affected
   - Rerun option to recreate patterns from scratch

6. **Performance**
   - O(n) algorithms for filtering
   - Efficient pattern matching
   - Throttled saves (5 seconds)
   - Async pattern analysis

7. **Data Persistence**
   - Docker volume ensures data survives updates
   - User changes (renames, splits, merges) preserved
   - Safe update procedure documented
   - Backup and recovery procedures provided

## Edit Operations Summary

### Edit in RDL (Pattern Manager) ✏️
**What:** Edit recognized device
**Opens:** DeviceLabelModal
**Behavior:**
- Always affects ALL processes in the pattern
- Can merge with existing patterns
- No toggle needed - clear, consistent behavior
- Updates both pattern.deviceName and all process.deviceName values

**Use when:** You want to rename a device across all its charging sessions

### Edit in CPL (Process List) ✏️
**What:** Edit individual charging process
**Opens:** ProcessLabelModal
**Behavior:**
- Affects ONLY the selected process
- Automatically splits from current pattern
- Joins existing pattern or creates new one
- Original pattern remains with other processes

**Use when:** You want to reclassify a single charging session to a different device

## Edge Cases Handled

✅ Empty pattern cleanup after single process rename
✅ Merge confirmation when renaming to existing device
✅ Validation of all inputs
✅ Atomic saves with temp files
✅ Pattern recreation on rerun
✅ Active processes excluded from editing
✅ Processes without patterns handled gracefully
✅ Data persistence across Docker container updates
✅ Split pattern when last process is renamed
✅ Prevent accidental data loss with confirmations
