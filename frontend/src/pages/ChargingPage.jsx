import React, { useState, useEffect, useRef } from 'react';
import DeviceList from '../components/DeviceList';
import ProcessList from '../components/ProcessList';
import ProcessFilters from '../components/ProcessFilters';
import ChargingChart from '../components/ChargingChart';
import './ChargingPage.css';

function ChargingPage({ 
  devices, 
  processes, 
  patterns,
  onDeleteProcess, 
  onCompleteProcess,
  onProcessUpdate
}) {
  const [selectedProcesses, setSelectedProcesses] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [filters, setFilters] = useState({
    state: 'all',
    charger: 'all',
    device: 'all',
    startDate: '',
    endDate: ''
  });
  
  // Use ref to track the currently selected process IDs
  const selectedProcessIdsRef = useRef([]);

  // Update ref when selectedProcesses changes
  useEffect(() => {
    selectedProcessIdsRef.current = selectedProcesses.map(p => p.id);
  }, [selectedProcesses]);

  // Update selected processes with fresh data if any are selected
  useEffect(() => {
    if (selectedProcessIdsRef.current.length > 0) {
      const updatedProcesses = processes.filter(p => 
        selectedProcessIdsRef.current.includes(p.id)
      );
      setSelectedProcesses(updatedProcesses);
    }
  }, [processes]);

  const handleProcessSelect = (process) => {
    setSelectedProcesses(prevSelected => {
      const isAlreadySelected = prevSelected.some(p => p.id === process.id);
      
      if (isAlreadySelected) {
        return prevSelected.filter(p => p.id !== process.id);
      } else {
        return [...prevSelected, process];
      }
    });
  };

  const handleClearSelection = () => {
    setSelectedProcesses([]);
  };

  const handleToggleSelectAll = (filteredProcesses) => {
    const allSelected = filteredProcesses.every(process => 
      selectedProcesses.some(sp => sp.id === process.id)
    );
    
    if (allSelected) {
      const filteredIds = new Set(filteredProcesses.map(p => p.id));
      setSelectedProcesses(prevSelected => 
        prevSelected.filter(p => !filteredIds.has(p.id))
      );
    } else {
      const selectedIds = new Set(selectedProcesses.map(p => p.id));
      const newSelections = filteredProcesses.filter(p => !selectedIds.has(p.id));
      setSelectedProcesses(prevSelected => [...prevSelected, ...newSelections]);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    if (newFilters.charger !== filters.charger && newFilters.charger !== selectedDeviceId) {
      setSelectedDeviceId(null);
    }
  };

  const handleDeviceSelect = (deviceId) => {
    setSelectedDeviceId(deviceId);
    setFilters({
      ...filters,
      charger: deviceId || 'all',
      device: 'all'
    });
  };

  return (
    <div className="charging-page">
      <div className="dashboard-grid">
        <section className="card devices-section">
          <h2>Connected Chargers</h2>
          <DeviceList 
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={handleDeviceSelect}
          />
        </section>

        <section className="card processes-section">
          <h2>Charging Processes</h2>
          <div className="filters-and-select-container">
            <ProcessFilters 
              filters={filters}
              onFilterChange={handleFilterChange}
              devices={devices}
              patterns={patterns}
            />
            {(() => {
              const filterStartDate = filters?.startDate ? (() => {
                const date = new Date(filters.startDate);
                date.setHours(0, 0, 0, 0);
                return date;
              })() : null;
              
              const filterEndDate = filters?.endDate ? (() => {
                const date = new Date(filters.endDate);
                date.setHours(23, 59, 59, 999);
                return date;
              })() : null;
              
              const processIdToDeviceName = {};
              if (patterns && patterns.length > 0) {
                patterns.forEach(pattern => {
                  if (pattern.processIds && pattern.deviceName) {
                    pattern.processIds.forEach(processId => {
                      processIdToDeviceName[processId] = pattern.deviceName;
                    });
                  }
                });
              }
              
              const filteredProcesses = processes.filter(process => {
                const isCompleted = process.endTime !== null && process.endTime !== undefined;
                if (filters?.state === 'active' && isCompleted) return false;
                if (filters?.state === 'completed' && !isCompleted) return false;
                
                if (filters?.charger && filters.charger !== 'all') {
                  const processChargerId = process.chargerId || process.deviceId;
                  if (processChargerId !== filters.charger) return false;
                }
                
                if (filters?.device && filters.device !== 'all') {
                  const deviceName = processIdToDeviceName[process.id];
                  if (!deviceName || deviceName !== filters.device) return false;
                }
                
                if (filterStartDate) {
                  const processDate = new Date(process.startTime);
                  if (processDate < filterStartDate) return false;
                }
                
                if (filterEndDate) {
                  const processDate = new Date(process.startTime);
                  if (processDate > filterEndDate) return false;
                }
                
                return true;
              });
              
              const allFilteredSelected = filteredProcesses.length > 0 && filteredProcesses.every(process => 
                selectedProcesses.some(sp => sp.id === process.id)
              );
              
              return filteredProcesses.length > 0 && (
                <button
                  className="select-all-toggle-button"
                  onClick={() => handleToggleSelectAll(filteredProcesses)}
                  title={allFilteredSelected ? "Deselect all filtered processes" : "Select all filtered processes"}
                  aria-label={allFilteredSelected ? "Deselect all filtered processes" : "Select all filtered processes"}
                >
                  {allFilteredSelected ? '☑' : '☐'}
                </button>
              );
            })()}
          </div>
          <ProcessList 
            processes={processes}
            patterns={patterns}
            selectedProcesses={selectedProcesses}
            onSelectProcess={handleProcessSelect}
            onDeleteProcess={onDeleteProcess}
            onCompleteProcess={onCompleteProcess}
            onProcessUpdate={onProcessUpdate}
            filters={filters}
          />
        </section>
      </div>

      {selectedProcesses.length > 0 && (
        <section className="card chart-section">
          <div className="chart-header">
            <h2>
              {selectedProcesses.length === 1 
                ? `Charging Details - Process #${selectedProcesses[0].id}`
                : `Comparing ${selectedProcesses.length} Charging Processes`
              }
            </h2>
            <button 
              className="clear-selection-button"
              onClick={handleClearSelection}
              title="Clear selection"
            >
              Clear Selection
            </button>
          </div>
          {selectedProcesses.length === 1 && (
            <div className="process-info">
              <div className="info-item">
                <strong>Device:</strong> {selectedProcesses[0].deviceName || selectedProcesses[0].deviceId}
              </div>
              <div className="info-item">
                <strong>Start:</strong> {new Date(selectedProcesses[0].startTime).toLocaleString()}
              </div>
              {selectedProcesses[0].endTime && (
                <div className="info-item">
                  <strong>End:</strong> {new Date(selectedProcesses[0].endTime).toLocaleString()}
                </div>
              )}
              <div className="info-item">
                <strong>Status:</strong> 
                <span className={selectedProcesses[0].endTime ? 'status-completed' : 'status-active'}>
                  {selectedProcesses[0].endTime ? ' Completed' : ' Active'}
                </span>
              </div>
            </div>
          )}
          <ChargingChart processes={selectedProcesses} />
        </section>
      )}
    </div>
  );
}

export default ChargingPage;
