import React, { useState, useEffect } from 'react';
import './DeviceLabelModal.css';

function DeviceLabelModal({ pattern, patterns, onClose, onSave, onMerge }) {
  const [newLabel, setNewLabel] = useState(pattern?.deviceName || '');
  const [shouldRenameAll, setShouldRenameAll] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (pattern) {
      setNewLabel(pattern.deviceName || '');
    }
  }, [pattern]);

  if (!pattern) return null;

  // Get other device names (excluding current pattern)
  const otherDeviceNames = patterns
    .filter(p => p.id !== pattern.id)
    .map(p => p.deviceName)
    .filter((name, index, self) => self.indexOf(name) === index); // unique names

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      alert('Please enter a device name');
      return;
    }

    const trimmedLabel = newLabel.trim();
    
    // Check if the new label matches an existing pattern
    const existingPattern = patterns.find(p => p.id !== pattern.id && p.deviceName === trimmedLabel);
    
    if (existingPattern) {
      // Ask user if they want to merge
      const shouldMerge = window.confirm(
        `A device named "${trimmedLabel}" already exists. Do you want to merge this pattern with the existing one?\n\n` +
        `This will combine all charging sessions from both patterns.`
      );
      
      if (shouldMerge) {
        onMerge(pattern.id, existingPattern.id);
      }
    } else {
      // New label or same label - just update
      onSave(pattern.id, trimmedLabel, shouldRenameAll);
    }
  };

  const handleDeviceSelect = (deviceName) => {
    setNewLabel(deviceName);
    setShowDropdown(false);
  };

  const filteredSuggestions = otherDeviceNames.filter(name =>
    name.toLowerCase().includes(newLabel.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Device Label</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Enter device name"
                  autoComplete="off"
                  className="label-input"
                />
                
                {showDropdown && filteredSuggestions.length > 0 && (
                  <div className="dropdown-menu">
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
                Choose an existing device name to merge patterns, or enter a new name.
              </small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={shouldRenameAll}
                  onChange={(e) => setShouldRenameAll(e.target.checked)}
                />
                <span>
                  Rename all charging sessions labeled "{pattern.deviceName}" to the new name
                </span>
              </label>
              <small className="help-text">
                {shouldRenameAll 
                  ? `All ${pattern.count} charging sessions will be updated.`
                  : 'Only the pattern label will be changed. Historical data will keep the old name.'
                }
              </small>
            </div>

            <div className="info-box">
              <strong>Pattern Info:</strong>
              <ul>
                <li>Sessions: {pattern.count}</li>
                <li>Avg. Duration: {pattern.statistics?.averageDuration?.toFixed(1) ?? 'N/A'} min</li>
                <li>Avg. Power: {pattern.averageProfile?.mean?.toFixed(1) ?? 'N/A'} W</li>
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

export default DeviceLabelModal;
