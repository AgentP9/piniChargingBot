import React from 'react';
import './ProcessList.css';

function ProcessList({ processes, selectedProcess, onSelectProcess }) {
  if (processes.length === 0) {
    return <div className="empty-state">No charging processes yet</div>;
  }

  // Sort processes by start time (most recent first)
  const sortedProcesses = [...processes].sort((a, b) => 
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
          className={`process-item ${selectedProcess?.id === process.id ? 'selected' : ''}`}
          onClick={() => onSelectProcess(process)}
        >
          <div className="process-header">
            <span className="process-id">Process #{process.id}</span>
            <span className={`process-badge ${process.endTime ? 'badge-completed' : 'badge-active'}`}>
              {process.endTime ? 'Completed' : 'Active'}
            </span>
          </div>
          
          <div className="process-details">
            <div className="detail-item">
              <span className="detail-icon">🔌</span>
              <span>{process.deviceName || process.deviceId}</span>
            </div>
            
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
      ))}
    </div>
  );
}

export default ProcessList;
