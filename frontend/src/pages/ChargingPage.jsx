import React, { useMemo } from 'react';
import DeviceList from '../components/DeviceList';
import ChargingChart from '../components/ChargingChart';
import './ChargingPage.css';

function ChargingPage({ 
  devices, 
  processes
}) {
  // Get active (currently running) charging processes
  const activeProcesses = useMemo(() => {
    return processes.filter(process => !process.endTime);
  }, [processes]);

  return (
    <div className="charging-page">
      <section className="card devices-section-full">
        <h2>Connected Chargers</h2>
        <DeviceList 
          devices={devices}
          selectedDeviceId={null}
          onSelectDevice={() => {}}
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
          {activeProcesses.length === 1 && (
            <div className="process-info">
              <div className="info-item">
                <strong>Charger:</strong> {activeProcesses[0].chargerName || activeProcesses[0].deviceName || activeProcesses[0].chargerId || activeProcesses[0].deviceId}
              </div>
              <div className="info-item">
                <strong>Start:</strong> {new Date(activeProcesses[0].startTime).toLocaleString()}
              </div>
              <div className="info-item">
                <strong>Status:</strong> 
                <span className="status-active">
                  Active
                </span>
              </div>
            </div>
          )}
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
