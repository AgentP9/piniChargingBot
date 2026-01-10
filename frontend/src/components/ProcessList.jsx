import React, { useMemo } from 'react';
import ChartPreview from './ChartPreview';
import { FRIENDLY_DEVICE_NAMES } from '../constants/deviceNames';
import './ProcessList.css';

function ProcessList({ processes, patterns, selectedProcess, onSelectProcess, onDeleteProcess, onCompleteProcess, filters }) {
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
  
  // Create a mapping of pattern IDs to friendly names
  const patternNames = {};
  if (patterns && patterns.length > 0) {
    patterns.forEach((pattern, index) => {
      patternNames[pattern.id] = FRIENDLY_DEVICE_NAMES[index % FRIENDLY_DEVICE_NAMES.length];
    });
  }
  
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

  // Apply filters
  const filteredProcesses = processes.filter(process => {
    // State filter - A process is completed if it has an endTime, active otherwise
    const isCompleted = process.endTime !== null && process.endTime !== undefined;
    if (filters?.state === 'active' && isCompleted) return false;
    if (filters?.state === 'completed' && !isCompleted) return false;

    // Charger filter (physical charging device)
    if (filters?.charger && filters.charger !== 'all' && process.deviceId !== filters.charger) return false;

    // Device filter (charged device from pattern recognition)
    if (filters?.device && filters.device !== 'all') {
      const assumedDevice = getAssumedDevice(process);
      // Get the pattern ID that matches this device name
      const matchingPattern = patterns?.find((pattern, index) => {
        const deviceName = FRIENDLY_DEVICE_NAMES[index % FRIENDLY_DEVICE_NAMES.length];
        return deviceName === assumedDevice;
      });
      
      if (!matchingPattern || matchingPattern.id !== filters.device) {
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
            <div className="process-header">
              <span className="process-id">Process #{process.id}</span>
              <div className="process-header-actions">
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
            
            <div className="process-details">
              <div className="detail-item">
                <span className="detail-icon">🔌</span>
                <span>{process.deviceName || process.deviceId}</span>
              </div>
              
              {getAssumedDevice(process) && (
                <div className="detail-item">
                  <span className="detail-icon">📱</span>
                  <span>Device: {getAssumedDevice(process)}</span>
                </div>
              )}
              
              <div className="detail-item">
                <span className="detail-icon">🕐</span>
                <span>{formatDate(process.startTime)}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-icon">⏱️</span>
                <span>{formatDuration(process.startTime, process.endTime)}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-icon">⚡</span>
                <span>{calculateTotalEnergy(process)} Wh</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProcessList;
