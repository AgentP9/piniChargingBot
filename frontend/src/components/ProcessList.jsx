import React, { useMemo, useState } from 'react';
import ChartPreview from './ChartPreview';
import DeviceLabelModal from './DeviceLabelModal';
import ProcessLabelModal from './ProcessLabelModal';
import './ProcessList.css';

function ProcessList({ processes, patterns, selectedProcess, onSelectProcess, onDeleteProcess, onCompleteProcess, filters, onPatternUpdate, onProcessUpdate }) {
  const [editingPattern, setEditingPattern] = useState(null);
  const [editingProcess, setEditingProcess] = useState(null);
  
  const handleDelete = (e, processId) => {
    e.stopPropagation(); // Prevent selecting the process when clicking delete
    
    if (window.confirm('Are you sure you want to delete this charging process? This action cannot be undone.')) {
      onDeleteProcess(processId);
    }
  };

  const handleComplete = (e, processId) => {
    e.stopPropagation(); // Prevent selecting the process when clicking complete
    
    if (window.confirm('Are you sure you want to mark this process as complete? This will end the charging session.')) {
      onCompleteProcess(processId);
    }
  };

  const handleEditDevice = (e, process, editAll) => {
    e.stopPropagation(); // Prevent selecting the process when clicking edit
    
    if (editAll) {
      // Edit the entire pattern
      const matchingPattern = patterns.find(pattern => 
        pattern.processIds && pattern.processIds.includes(process.id)
      );
      
      if (matchingPattern) {
        setEditingPattern(matchingPattern);
      }
    } else {
      // Edit just this single process
      setEditingProcess(process);
    }
  };

  const handleSaveLabel = async (patternId, newLabel, shouldRenameAll) => {
    try {
      await onPatternUpdate('updateLabel', { patternId, newLabel, shouldRenameAll });
      setEditingPattern(null);
    } catch (error) {
      console.error('Error updating label:', error);
      alert('Failed to update device label. Please try again.');
    }
  };

  const handleSaveProcessLabel = async (processId, newLabel) => {
    try {
      await onProcessUpdate('updateDeviceName', { processId, newLabel });
      setEditingProcess(null);
    } catch (error) {
      console.error('Error updating process label:', error);
      alert('Failed to update process device name. Please try again.');
    }
  };

  const handleMergePatterns = async (sourcePatternId, targetPatternId) => {
    try {
      await onPatternUpdate('merge', { sourcePatternId, targetPatternId });
      setEditingPattern(null);
    } catch (error) {
      console.error('Error merging patterns:', error);
      alert('Failed to merge patterns. Please try again.');
    }
  };
  
  const handleCloseModal = () => {
    setEditingPattern(null);
    setEditingProcess(null);
  };
  
  // Create a mapping of pattern IDs to device names (memoized)
  const patternNames = useMemo(() => {
    const names = {};
    if (patterns && patterns.length > 0) {
      patterns.forEach((pattern) => {
        names[pattern.id] = pattern.deviceName;
      });
    }
    return names;
  }, [patterns]);
  
  // Get the assumed device name for a process based on pattern matching
  const getAssumedDevice = (process) => {
    if (!process.endTime || !patterns || patterns.length === 0) {
      return null; // No pattern for active processes or if no patterns available
    }
    
    // Find pattern that contains this process ID
    const matchingPattern = patterns.find(pattern => 
      pattern.processIds && pattern.processIds.includes(process.id)
    );
    
    if (matchingPattern && patternNames[matchingPattern.id]) {
      return patternNames[matchingPattern.id];
    }
    
    return null;
  };

  if (processes.length === 0) {
    return <div className="empty-state">No charging processes yet</div>;
  }

  // Parse filter dates once to avoid repeated parsing in the filter function
  const filterStartDate = useMemo(() => {
    if (!filters?.startDate) return null;
    const date = new Date(filters.startDate);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [filters?.startDate]);

  const filterEndDate = useMemo(() => {
    if (!filters?.endDate) return null;
    const date = new Date(filters.endDate);
    date.setHours(23, 59, 59, 999);
    return date;
  }, [filters?.endDate]);

  // Pre-compute process ID to pattern ID mapping for O(1) lookup during filtering
  const processIdToPatternId = useMemo(() => {
    if (!patterns || patterns.length === 0) return {};
    
    const mapping = {};
    patterns.forEach(pattern => {
      if (pattern.processIds) {
        pattern.processIds.forEach(processId => {
          mapping[processId] = pattern.id;
        });
      }
    });
    return mapping;
  }, [patterns]);

  // Apply filters
  const filteredProcesses = processes.filter(process => {
    // State filter - A process is completed if it has an endTime, active otherwise
    const isCompleted = process.endTime !== null && process.endTime !== undefined;
    if (filters?.state === 'active' && isCompleted) return false;
    if (filters?.state === 'completed' && !isCompleted) return false;

    // Charger filter (physical charging device like ShellyPlug)
    // Check both chargerId and deviceId for backward compatibility
    if (filters?.charger && filters.charger !== 'all') {
      const processChargerId = process.chargerId || process.deviceId;
      if (processChargerId !== filters.charger) return false;
    }

    // Device filter (charged device from pattern recognition)
    // Note: Only completed processes can be filtered by device since pattern recognition
    // requires a complete charging session to identify the device
    if (filters?.device && filters.device !== 'all') {
      // Use pre-computed mapping for O(1) lookup
      const patternId = processIdToPatternId[process.id];
      if (!patternId || patternId !== filters.device) {
        return false;
      }
    }

    // Start date filter
    if (filterStartDate) {
      const processDate = new Date(process.startTime);
      if (processDate < filterStartDate) return false;
    }

    // End date filter
    if (filterEndDate) {
      const processDate = new Date(process.startTime);
      if (processDate > filterEndDate) return false;
    }

    return true;
  });

  if (filteredProcesses.length === 0) {
    return <div className="empty-state">No charging processes match the current filters</div>;
  }

  // Sort processes by start time (most recent first)
  const sortedProcesses = [...filteredProcesses].sort((a, b) => 
    new Date(b.startTime) - new Date(a.startTime)
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'In progress';
    
    const duration = new Date(endTime) - new Date(startTime);
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const calculateTotalEnergy = (process) => {
    const powerEvents = process.events.filter(e => e.type === 'power_consumption');
    if (powerEvents.length === 0) return 0;
    
    // Simple approximation: average power * duration
    const avgPower = powerEvents.reduce((sum, e) => sum + e.value, 0) / powerEvents.length;
    const duration = process.endTime 
      ? new Date(process.endTime) - new Date(process.startTime)
      : Date.now() - new Date(process.startTime);
    
    // Convert to Wh (duration in ms / 1000 / 3600 = hours)
    return (avgPower * duration / 1000 / 3600).toFixed(2);
  };

  return (
    <div className="process-list">
      {sortedProcesses.map(process => (
        <div 
          key={process.id} 
          className={`process-item ${selectedProcess?.id === process.id ? 'selected' : ''} ${process.endTime ? 'has-preview' : ''}`}
          onClick={() => onSelectProcess(process)}
        >
          {process.endTime && <ChartPreview process={process} />}
          
          <div className="process-content">
            {/* Row 1: Process ID | State + Complete Button | Delete Button */}
            <div className="process-row process-row-1">
              <div className="process-cell">
                <span className="process-id">Process #{process.id}</span>
              </div>
              <div className="process-cell process-cell-center">
                <span className={`process-badge ${process.endTime ? 'badge-completed' : 'badge-active'}`}>
                  {process.endTime ? 'Completed' : 'Active'}
                </span>
                {!process.endTime && (
                  <button 
                    className="complete-button"
                    onClick={(e) => handleComplete(e, process.id)}
                    title="Mark this process as complete"
                    aria-label={`Mark charging process #${process.id} as complete`}
                  >
                    ✓
                  </button>
                )}
              </div>
              <div className="process-cell process-cell-right">
                <button 
                  className="delete-button"
                  onClick={(e) => handleDelete(e, process.id)}
                  title="Delete this charging process"
                  aria-label={`Delete charging process #${process.id}`}
                >
                  🗑️
                </button>
              </div>
            </div>
            
            {/* Row 2: Charger | Device + Edit Buttons */}
            <div className="process-row process-row-2">
              <div className="process-cell">
                <span>Charger: {process.chargerName || process.deviceName || process.chargerId || process.deviceId}</span>
              </div>
              <div className="process-cell">
                {getAssumedDevice(process) ? (
                  <span>Device: {getAssumedDevice(process)}</span>
                ) : (
                  <span>Device: -</span>
                )}
              </div>
              <div className="process-cell process-cell-right">
                {getAssumedDevice(process) && process.endTime && (
                  <div className="edit-buttons">
                    <button
                      className="edit-button"
                      onClick={(e) => handleEditDevice(e, process, false)}
                      title="Rename this process only"
                      aria-label="Rename this process only"
                    >
                      ✏️
                    </button>
                    <button
                      className="edit-button edit-all-button"
                      onClick={(e) => handleEditDevice(e, process, true)}
                      title="Rename all processes with this device"
                      aria-label="Rename all processes with this device"
                    >
                      ✏️✏️
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Row 3: Start datetime | Duration | Power consumption */}
            <div className="process-row process-row-3">
              <div className="process-cell">
                <span>{formatDate(process.startTime)}</span>
              </div>
              <div className="process-cell">
                <span>{formatDuration(process.startTime, process.endTime)}</span>
              </div>
              <div className="process-cell">
                <span>{calculateTotalEnergy(process)} Wh</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {editingPattern && (
        <DeviceLabelModal
          pattern={editingPattern}
          patterns={patterns}
          onClose={handleCloseModal}
          onSave={handleSaveLabel}
          onMerge={handleMergePatterns}
        />
      )}

      {editingProcess && (
        <ProcessLabelModal
          process={editingProcess}
          patterns={patterns}
          onClose={handleCloseModal}
          onSave={handleSaveProcessLabel}
        />
      )}
    </div>
  );
}

export default ProcessList;
