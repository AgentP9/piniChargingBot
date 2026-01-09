import React from 'react';
import './DeviceList.css';

function DeviceList({ devices }) {
  if (devices.length === 0) {
    return <div className="empty-state">No devices configured</div>;
  }

  return (
    <div className="device-list">
      {devices.map(device => (
        <div key={device.id} className="device-item">
          <div className="device-header">
            <h3 className="device-name">{device.id}</h3>
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
