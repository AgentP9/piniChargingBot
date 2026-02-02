import React, { useState, useEffect } from 'react';
import './DeviceLabelModal.css'; // Reuse the same styles

function ProcessLabelModal({ process, patterns, onClose, onSave }) {
  const [selectedPattern, setSelectedPattern] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (process) {
      // Set the current device name as the default selection if it exists in patterns
      const currentPattern = patterns.find(p => p.deviceName === process.deviceName);
      if (currentPattern) {
        setSelectedPattern(process.deviceName);
      } else {
        setSelectedPattern('');
      }
      setError('');
    }
  }, [process, patterns]);

  if (!process) return null;

  // Get all unique device names from patterns, sorted alphabetically
  const allDeviceNames = [...new Set(patterns.map(p => p.deviceName))].sort();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPattern) {
      setError('Please select a device pattern');
      return;
    }

    onSave(process.id, selectedPattern);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Rename Charging Process</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}
            
            <div className="info-box" style={{ marginBottom: '1rem' }}>
              <strong>Note:</strong>
              <p>Select an existing device pattern to assign this charging process to it. The process will be removed from its current pattern (if any).</p>
            </div>

            <div className="form-group">
              <label htmlFor="device-select">Device Pattern:</label>
              <select
                id="device-select"
                value={selectedPattern}
                onChange={(e) => {
                  setSelectedPattern(e.target.value);
                  setError('');
                }}
                className="label-input"
              >
                <option value="">-- Select a device pattern --</option>
                {allDeviceNames.map((name, index) => (
                  <option key={index} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <small className="help-text">
                Choose an existing device pattern to assign this process to. To create a new pattern, use the "New Pattern" button in the Recognized Devices section.
              </small>
            </div>

            <div className="info-box">
              <strong>Process Info:</strong>
              <ul>
                <li>Process ID: #{process.id}</li>
                <li>Current Device: {process.deviceName || 'Unknown'}</li>
                <li>Charger: {process.chargerName || process.chargerId}</li>
              </ul>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProcessLabelModal;
