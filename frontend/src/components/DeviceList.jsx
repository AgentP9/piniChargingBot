import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DeviceList.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// DeviceList displays connected chargers (physical charging devices like ShellyPlugs)
function DeviceList({ devices, selectedDeviceId, onSelectDevice }) {
  const [deviceGuesses, setDeviceGuesses] = useState({});

  // Fetch educated guesses for active processes
  useEffect(() => {
    const fetchGuesses = async () => {
      const activeDevices = devices.filter(d => d.isOn && d.currentProcessId !== null);
      
      if (activeDevices.length === 0) {
        setDeviceGuesses({});
        return;
      }
      
      const guesses = {};
      await Promise.all(
        activeDevices.map(async (device) => {
          try {
            const response = await axios.get(`${API_URL}/processes/${device.currentProcessId}/guess`);
            if (response.data.hasGuess) {
              guesses[device.id] = {
                deviceName: response.data.guessedDevice,
                confidence: response.data.confidence
              };
            }
          } catch (error) {
            console.error(`Error fetching guess for device ${device.id}:`, error);
          }
        })
      );
      
      setDeviceGuesses(guesses);
    };
    
    // Only set up interval if there are active devices
    const activeDevices = devices.filter(d => d.isOn && d.currentProcessId !== null);
    if (activeDevices.length === 0) {
      setDeviceGuesses({});
      return;
    }
    
    fetchGuesses();
    // Refresh guesses every 10 seconds while there are active devices
    const interval = setInterval(fetchGuesses, 10000);
    return () => clearInterval(interval);
  }, [devices]);

  if (devices.length === 0) {
    return <div className="empty-state">No chargers configured</div>;
  }

  const handleDeviceClick = (deviceId) => {
    // If clicking the already selected charger, deselect it
    if (selectedDeviceId === deviceId) {
      onSelectDevice(null);
    } else {
      onSelectDevice(deviceId);
    }
  };

  return (
    <div className="device-list">
      {devices.map(device => {
        const guess = deviceGuesses[device.id];
        
        return (
        <div 
          key={device.id} 
          className={`device-item ${selectedDeviceId === device.id ? 'selected' : ''}`}
          onClick={() => handleDeviceClick(device.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
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
            {guess && (
              <div className="detail-row guess-row">
                <span className="detail-label">Likely Device:</span>
                <span className="detail-value guess-value">
                  {guess.deviceName} 
                  <span className="confidence-badge">
                    {Math.round(guess.confidence * 100)}%
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      );
      })}
    </div>
  );
}

export default DeviceList;
