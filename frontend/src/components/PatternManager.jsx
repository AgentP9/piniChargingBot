import React, { useState } from 'react';
import { FRIENDLY_DEVICE_NAMES } from '../constants/deviceNames';
import './PatternManager.css';

function PatternManager({ patterns, selectedPatternId, onPatternUpdate, onSelectPattern }) {
  const [expandedPattern, setExpandedPattern] = useState(null);

  const handleDeletePattern = async (patternId, deviceName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the pattern for device "${deviceName}"?\n\n` +
      `This will remove the pattern, but charging processes will not be deleted.`
    );

    if (confirmed) {
      try {
        await onPatternUpdate('delete', { patternId });
      } catch (error) {
        console.error('Error deleting pattern:', error);
        alert('Failed to delete pattern. Please try again.');
      }
    }
  };

  if (!patterns || patterns.length === 0) {
    return (
      <div className="pattern-manager">
        <h3>Recognized Devices</h3>
        <p className="empty-message">No device patterns have been identified yet. Complete some charging sessions to start recognizing devices.</p>
      </div>
    );
  }

  // Create a mapping of pattern IDs to friendly names
  const patternNames = {};
  patterns.forEach((pattern, index) => {
    patternNames[pattern.id] = FRIENDLY_DEVICE_NAMES[index % FRIENDLY_DEVICE_NAMES.length];
  });

  const handlePatternClick = (patternId) => {
    // If clicking the already selected pattern, deselect it
    if (selectedPatternId === patternId) {
      onSelectPattern(null);
    } else {
      onSelectPattern(patternId);
    }
  };

  return (
    <div className="pattern-manager">
      <h3>Recognized Devices ({patterns.length})</h3>
      <div className="pattern-list">
        {patterns.map((pattern, index) => {
          const displayName = patternNames[pattern.id];
          const isExpanded = expandedPattern === pattern.id;
          const isSelected = selectedPatternId === pattern.id;

          return (
            <div 
              key={pattern.id} 
              className={`pattern-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handlePatternClick(pattern.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
                  e.preventDefault();
                  handlePatternClick(pattern.id);
                }
              }}
              aria-pressed={isSelected}
              aria-label={`Select ${pattern.deviceName || displayName}`}
            >
              <div className="pattern-header">
                <div className="pattern-info">
                  <span className="pattern-name">{pattern.deviceName || displayName}</span>
                  <span className="pattern-count">{pattern.count} sessions</span>
                </div>
                <div className="pattern-actions">
                  <button
                    className="pattern-expand-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card selection when clicking expand
                      setExpandedPattern(isExpanded ? null : pattern.id);
                    }}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                  <button
                    className="pattern-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card selection when clicking delete
                      handleDeletePattern(pattern.id, pattern.deviceName || displayName);
                    }}
                    title="Delete this pattern"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="pattern-details">
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Average Power:</span>
                      <span className="detail-value">{pattern.averageProfile?.mean?.toFixed(1) ?? 'N/A'} W</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Average Duration:</span>
                      <span className="detail-value">{pattern.statistics?.averageDuration?.toFixed(1) ?? 'N/A'} min</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Total Sessions:</span>
                      <span className="detail-value">{pattern.statistics?.totalSessions ?? 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Last Seen:</span>
                      <span className="detail-value">{new Date(pattern.lastSeen).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="charging-profile">
                    <h4>Charging Profile</h4>
                    <div className="profile-curve">
                      <div className="curve-phase">
                        <span className="phase-label">Early</span>
                        <span className="phase-value">{pattern.averageProfile?.curveShape?.early?.toFixed(1) ?? 'N/A'} W</span>
                      </div>
                      <div className="curve-phase">
                        <span className="phase-label">Middle</span>
                        <span className="phase-value">{pattern.averageProfile?.curveShape?.middle?.toFixed(1) ?? 'N/A'} W</span>
                      </div>
                      <div className="curve-phase">
                        <span className="phase-label">Late</span>
                        <span className="phase-value">{pattern.averageProfile?.curveShape?.late?.toFixed(1) ?? 'N/A'} W</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PatternManager;
