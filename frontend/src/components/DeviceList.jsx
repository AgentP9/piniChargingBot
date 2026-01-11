import React from 'react';
import './DeviceList.css';

function DeviceList({ devices, selectedDeviceId, onSelectDevice }) {
  if (devices.length === 0) {
    return <div className="empty-state">No devices configured</div>;
  }

  const handleDeviceClick = (deviceId) => {
    // If clicking the already selected device, deselect it
    if (selectedDeviceId === deviceId) {
      onSelectDevice(null);
    } else {
      onSelectDevice(deviceId);
    }
  };

  return (
    <div className="device-list">
      {devices.map(device => (
        <div 
          key={device.id} 
          className={`device-item ${selectedDeviceId === device.id ? 'selected' : ''}`}
          onClick={() => handleDeviceClick(device.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
              e.preventDefault();
              handleDeviceClick(device.id);
            }
          }}
          aria-pressed={selectedDeviceId === device.id}
          aria-label={`Select ${device.name}`}
        >
          <div className="device-header">
            <h3 className="device-name">{device.name}</h3>
            <span className={`device-status ${device.isOn ? 'status-on' : 'status-off'}`}>
              {device.isOn ? '● ON' : '○ OFF'}
            </span>
          </div>
          <div className="device-details">
            <div className="detail-row">
              <span className="detail-label">Power:</span>
              <span className="detail-value">{device.power.toFixed(2)} W</span>
            </div>
            {device.currentProcessId !== null && (
              <div className="detail-row">
                <span className="detail-label">Current Process:</span>
                <span className="detail-value">#{device.currentProcessId}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DeviceList;
