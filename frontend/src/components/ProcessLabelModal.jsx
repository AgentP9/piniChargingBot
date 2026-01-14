import React, { useState, useEffect } from 'react';
import './DeviceLabelModal.css'; // Reuse the same styles

function ProcessLabelModal({ process, patterns, onClose, onSave }) {
  const [newLabel, setNewLabel] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (process) {
      setNewLabel(process.deviceName || '');
      setError('');
    }
  }, [process]);

  if (!process) return null;

  // Get all unique device names from patterns
  const allDeviceNames = patterns
    .map(p => p.deviceName)
    .filter((name, index, self) => self.indexOf(name) === index); // unique names

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      setError('Please enter a device name');
      return;
    }

    const trimmedLabel = newLabel.trim();
    onSave(process.id, trimmedLabel);
  };

  const handleDeviceSelect = (deviceName) => {
    setNewLabel(deviceName);
    setShowDropdown(false);
  };

  const filteredSuggestions = allDeviceNames.filter(name =>
    name.toLowerCase().includes(newLabel.toLowerCase())
  );

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
              <p>Renaming this individual charging process will remove it from its current pattern and either:</p>
              <ul>
                <li>Add it to an existing pattern with the same name, or</li>
                <li>Create a new pattern if the name doesn't exist</li>
              </ul>
            </div>

            <div className="form-group">
              <label htmlFor="device-label">Device Name:</label>
              <div className="input-container">
                <input
                  id="device-label"
                  type="text"
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    setShowDropdown(true);
                    setError(''); // Clear error on change
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Enter device name"
                  autoComplete="off"
                  className="label-input"
                />
                
                {showDropdown && filteredSuggestions.length > 0 && (
                  <div className="dropdown-menu" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="dropdown-header">Existing devices:</div>
                    {filteredSuggestions.map((name, index) => (
                      <div
                        key={index}
                        className="dropdown-item"
                        onClick={() => handleDeviceSelect(name)}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <small className="help-text">
                Choose an existing device name to add this process to that pattern, or enter a new name to create a new pattern.
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
