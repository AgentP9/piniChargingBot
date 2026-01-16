import React, { useMemo, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ChartPreview from './ChartPreview';
import ProcessLabelModal from './ProcessLabelModal';
import './ProcessList.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function ProcessList({ processes, patterns, selectedProcesses, onSelectProcess, onDeleteProcess, onCompleteProcess, filters, onPatternUpdate, onProcessUpdate }) {
  const [editingProcess, setEditingProcess] = useState(null);
  const [processGuesses, setProcessGuesses] = useState({});

  // Fetch educated guesses for active processes
  useEffect(() => {
    // Check for active processes first to avoid unnecessary work
    const activeProcesses = processes.filter(p => !p.endTime);
    
    if (activeProcesses.length === 0) {
      setProcessGuesses({});
      return; // No interval needed
    }
    
    const fetchGuesses = async () => {
      const guesses = {};
      await Promise.all(
        activeProcesses.map(async (process) => {
          try {
            const response = await axios.get(`${API_URL}/processes/${process.id}/guess`);
            if (response.data.hasGuess) {
              guesses[process.id] = {
                deviceName: response.data.guessedDevice,
                confidence: response.data.confidence
              };
            }
          } catch (error) {
            console.error(`Error fetching guess for process ${process.id}:`, error);
          }
        })
      );
      
      setProcessGuesses(guesses);
    };
    
    fetchGuesses();
    // Refresh guesses every 10 seconds while there are active processes
    const interval = setInterval(fetchGuesses, 10000);
    return () => clearInterval(interval);
  }, [processes]);
  
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

  const handleEditProcess = (e, process) => {
    e.stopPropagation(); // Prevent selecting the process when clicking edit
    
    // Edit just this single process
    setEditingProcess(process);
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
  
  const handleCloseModal = () => {
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

  // Get the educated guess for an active process
  const getGuessedDevice = (process) => {
    if (process.endTime) {
      return null; // Only for active processes
    }
    
    return processGuesses[process.id] || null;
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

  // Pre-compute process ID to device name mapping for O(1) lookup during filtering
  const processIdToDeviceName = useMemo(() => {
    if (!patterns || patterns.length === 0) return {};
    
    const mapping = {};
    patterns.forEach(pattern => {
      // Only create mappings for patterns that have both processIds and a deviceName
      if (pattern.processIds && pattern.deviceName) {
        pattern.processIds.forEach(processId => {
          mapping[processId] = pattern.deviceName;
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
      const deviceName = processIdToDeviceName[process.id];
      if (!deviceName || deviceName !== filters.device) {
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
    const duration = endTime 
      ? new Date(endTime) - new Date(startTime)
      : Date.now() - new Date(startTime);
    
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Update duration for active processes every second
  const [, setTick] = useState(0);
  const hasActiveProcesses = useMemo(() => 
    processes.some(p => !p.endTime),
    [processes]
  );
  
  useEffect(() => {
    if (!hasActiveProcesses) return;
    
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [hasActiveProcesses]);

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

  // Check if last MQTT update is older than one hour
  const isLastUpdateOlderThanOneHour = useCallback((process) => {
    if (!process.events || process.events.length === 0) return false;
    
    // Get the most recent event timestamp
    const lastEvent = process.events[process.events.length - 1];
    const lastUpdateTime = new Date(lastEvent.timestamp);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    return lastUpdateTime < oneHourAgo;
  }, []);

  // Determine if complete button should be shown
  const shouldShowCompleteButton = useCallback((process) => {
    return !process.endTime && isLastUpdateOlderThanOneHour(process);
  }, [isLastUpdateOlderThanOneHour]);

  return (
    <div className="process-list">
      {sortedProcesses.map(process => {
        // Cache these values to avoid redundant function calls
        const assumedDevice = getAssumedDevice(process);
        const guessedDevice = getGuessedDevice(process);
        const showCompleteButton = shouldShowCompleteButton(process);
        const isSelected = selectedProcesses.some(p => p.id === process.id);
        
        return (
        <div 
          key={process.id} 
          className={`process-item ${isSelected ? 'selected' : ''} ${process.endTime ? 'has-preview' : ''}`}
          onClick={() => onSelectProcess(process)}
        >
          {process.endTime && <ChartPreview process={process} />}
          
          <div className="process-content">
            {/* Row 1: Process ID | State + Complete Button | Delete Button */}
            <div className="process-row process-row-1">
              <div className="process-cell">
                <input 
                  type="checkbox" 
                  className="process-checkbox"
                  checked={isSelected}
                  onChange={() => onSelectProcess(process)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select process #${process.id}`}
                />
                <span className="process-id">Process #{process.id}</span>
              </div>
              <div className="process-cell process-cell-center">
                {/* Empty center cell */}
              </div>
              <div className="process-cell process-cell-right">
                {!process.endTime && !showCompleteButton && (
                  <div className="charging-animation" title="Charging in progress">
                    <div className="charging-bolt">⚡</div>
                  </div>
                )}
                {showCompleteButton && (
                  <button 
                    className="complete-button"
                    onClick={(e) => handleComplete(e, process.id)}
                    title="Mark this process as complete (last update > 1 hour ago)"
                    aria-label={`Mark charging process #${process.id} as complete`}
                  >
                    ✓
                  </button>
                )}
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
                <span className="info-icon">🔌</span>
                <span>{process.chargerName || process.deviceName || process.chargerId || process.deviceId}</span>
              </div>
              <div className="process-cell">
                <span className="info-icon">📱</span>
                {assumedDevice ? (
                  <span>{assumedDevice}</span>
                ) : guessedDevice ? (
                  <span className="device-guess">
                    {guessedDevice.deviceName}?
                    <span className="guess-confidence">
                      {Math.round(guessedDevice.confidence * 100)}%
                    </span>
                  </span>
                ) : process.deviceName ? (
                  <span>{process.deviceName}</span>
                ) : (
                  <span>-</span>
                )}
              </div>
              <div className="process-cell process-cell-right">
                {/* Show edit button for completed processes or interrupted processes ready to complete */}
                {(process.endTime || showCompleteButton) && (
                  <button
                    className="edit-button"
                    onClick={(e) => handleEditProcess(e, process)}
                    title="Rename this process"
                    aria-label="Rename this process"
                  >
                    ✏️
                  </button>
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
      );
      })}

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
