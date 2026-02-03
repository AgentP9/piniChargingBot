import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import DeviceList from '../components/DeviceList';
import ChargingChart from '../components/ChargingChart';
import { formatDateTime } from '../utils/dateFormatter';
import './ChargingPage.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function ChargingPage({ 
  devices, 
  processes,
  onRefreshData
}) {
  const [estimations, setEstimations] = useState({});
  const [guesses, setGuesses] = useState({});

  // Get active (currently running) charging processes
  const activeProcesses = useMemo(() => {
    return processes.filter(process => !process.endTime);
  }, [processes]);

  // Track active process IDs to prevent unnecessary effect re-runs
  const activeProcessIds = useMemo(() => {
    return activeProcesses.map(p => p.id).join(',');
  }, [activeProcesses]);

  // Fetch completion time estimates for active processes
  useEffect(() => {
    if (activeProcesses.length === 0) {
      setEstimations({});
      return;
    }

    const fetchEstimates = async () => {
      const newEstimations = {};
      await Promise.all(
        activeProcesses.map(async (process) => {
          try {
            const response = await axios.get(`${API_URL}/processes/${process.id}/estimate`);
            if (response.data.hasEstimate) {
              newEstimations[process.id] = response.data;
            }
          } catch (error) {
            console.error(`Error fetching estimate for process ${process.id}:`, error);
          }
        })
      );
      setEstimations(newEstimations);
    };

    fetchEstimates();
    // Refresh estimates every 30 seconds
    const interval = setInterval(fetchEstimates, 30000);
    return () => clearInterval(interval);
  }, [activeProcessIds, activeProcesses]);

  // Fetch device guesses for active processes
  useEffect(() => {
    if (activeProcesses.length === 0) {
      setGuesses({});
      return;
    }

    const fetchGuesses = async () => {
      const newGuesses = {};
      await Promise.all(
        activeProcesses.map(async (process) => {
          try {
            const response = await axios.get(`${API_URL}/processes/${process.id}/guess`);
            if (response.data.hasGuess) {
              newGuesses[process.id] = {
                deviceName: response.data.guessedDevice,
                patternId: response.data.patternId,
                confidence: response.data.confidence
              };
            }
          } catch (error) {
            console.error(`Error fetching guess for process ${process.id}:`, error);
          }
        })
      );
      setGuesses(newGuesses);
    };

    fetchGuesses();
    // Refresh guesses every 10 seconds
    const interval = setInterval(fetchGuesses, 10000);
    return () => clearInterval(interval);
  }, [activeProcesses]);

  const handleConfirmGuess = async (processId, guessedDeviceName) => {
    try {
      await axios.put(`${API_URL}/processes/${processId}/device-name`, {
        newDeviceName: guessedDeviceName
      });
      
      // Remove the guess from state since it's now confirmed
      setGuesses(prev => {
        const updated = { ...prev };
        delete updated[processId];
        return updated;
      });
      
      // Refresh data to show the confirmed device name
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (error) {
      console.error(`Error confirming guess for process ${processId}:`, error);
      alert('Failed to confirm device guess. Please try again.');
    }
  };

  const handleRejectGuess = async (processId, patternId) => {
    try {
      const response = await axios.post(`${API_URL}/processes/${processId}/reject-guess`, {
        rejectedPatternId: patternId
      });
      
      if (response.data.hasGuess) {
        // Update the guess with the next suggestion
        setGuesses(prev => ({
          ...prev,
          [processId]: {
            deviceName: response.data.guessedDevice,
            patternId: response.data.patternId,
            confidence: response.data.confidence,
            cycled: response.data.cycled,
            totalMatches: response.data.totalMatches
          }
        }));
      } else {
        // No more guesses available
        setGuesses(prev => {
          const updated = { ...prev };
          delete updated[processId];
          return updated;
        });
      }
    } catch (error) {
      console.error(`Error rejecting guess for process ${processId}:`, error);
      alert('Failed to reject device guess. Please try again.');
    }
  };

  const formatRemainingTime = (minutes) => {
    if (minutes < 1) {
      return 'Less than 1 minute';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="charging-page">
      <section className="card devices-section-full">
        <h2>Connected Chargers</h2>
        <DeviceList 
          devices={devices}
          selectedDeviceId={null}
          onSelectDevice={() => {}}
          onRefreshData={onRefreshData}
        />
      </section>

      {activeProcesses.length > 0 && (
        <section className="card chart-section">
          <div className="chart-header">
            <h2>
              {activeProcesses.length === 1 
                ? `Current Charging - Process #${activeProcesses[0].id}`
                : `Current Charging (${activeProcesses.length} active processes)`
              }
            </h2>
          </div>
          
          {/* Individual process information for each active process */}
          {activeProcesses.map((process) => {
            const processId = process.id;
            const guess = guesses[processId];
            const estimation = estimations[processId];
            const hasDeviceName = process.deviceName && process.deviceName.trim() !== '';
            
            return (
              <div key={processId} className="process-info" style={{ marginBottom: activeProcesses.length > 1 ? '1.5rem' : '0' }}>
                {activeProcesses.length > 1 && (
                  <div className="process-header" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                    <h3 style={{ margin: '0', color: 'var(--primary-color)', fontSize: '1.1rem' }}>
                      Process #{processId} - {process.chargerName || process.chargerId || 'Charger'}
                    </h3>
                  </div>
                )}
                <div className="info-item">
                  <strong>Charger:</strong> {process.chargerName || process.deviceName || process.chargerId || process.deviceId}
                </div>
                <div className="info-item">
                  <strong>Start:</strong> {formatDateTime(process.startTime)}
                </div>
                <div className="info-item">
                  <strong>Status:</strong> 
                  <span className="status-active">
                    Active
                  </span>
                </div>
                {guess && !hasDeviceName && (
                  <div className="info-item guess-item">
                    <strong>Device Guess:</strong>{' '}
                    <span className="guess-value">
                      {guess.deviceName}
                    </span>
                    <span className="guess-confidence">
                      ({Math.round(guess.confidence * 100)}% match)
                    </span>
                    {guess.cycled && (
                      <span className="guess-cycled" title="All options have been shown, cycling back">
                        🔄
                      </span>
                    )}
                    <div className="guess-buttons">
                      <button
                        className="confirm-guess-button"
                        onClick={() => handleConfirmGuess(processId, guess.deviceName)}
                        title="Confirm this device identification"
                      >
                        &#10003;
                      </button>
                      <button
                        className="reject-guess-button"
                        onClick={() => handleRejectGuess(processId, guess.patternId)}
                        title="Reject and show next best match"
                      >
                        &#10005;
                      </button>
                    </div>
                  </div>
                )}
                {!guess && !hasDeviceName && (
                  <div className="info-item unknown-device-hint">
                    <strong>Device:</strong>{' '}
                    <span className="unknown-value">Unknown device</span>
                    <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                      Continue charging to allow device recognition
                    </small>
                  </div>
                )}
                {estimation && (
                  <>
                    <div className="info-item estimate-item">
                      <strong>Estimated Remaining:</strong>{' '}
                      <span className="estimate-value">
                        {estimation.status === 'completing' ? (
                          'Completing...'
                        ) : (
                          formatRemainingTime(estimation.remainingMinutes)
                        )}
                      </span>
                      <span className="estimate-confidence">
                        ({Math.round(estimation.confidence * 100)}% confidence)
                      </span>
                    </div>
                    {estimation.patternDeviceName && !hasDeviceName && (
                      <div className="info-item estimate-hint">
                        <small>Based on pattern: {estimation.patternDeviceName}</small>
                        <div className="guess-buttons">
                          <button
                            className="confirm-guess-button"
                            onClick={() => handleConfirmGuess(processId, estimation.patternDeviceName)}
                            title="Confirm this device identification"
                          >
                            &#10003;
                          </button>
                          {estimation.patternId && (
                            <button
                              className="reject-guess-button"
                              onClick={() => handleRejectGuess(processId, estimation.patternId)}
                              title="Reject and show next best match"
                            >
                              &#10005;
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          
          <ChargingChart processes={activeProcesses} />
        </section>
      )}

      {activeProcesses.length === 0 && (
        <section className="card empty-charging-section">
          <div className="empty-state">
            <p>No active charging processes</p>
          </div>
        </section>
      )}
    </div>
  );
}

export default ChargingPage;
