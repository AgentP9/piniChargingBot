import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import DeviceList from './components/DeviceList';
import ProcessList from './components/ProcessList';
import ProcessFilters from './components/ProcessFilters';
import ChargingChart from './components/ChargingChart';
import PatternManager from './components/PatternManager';
import { useTheme } from './contexts/ThemeContext';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function App() {
  const { theme, toggleTheme } = useTheme();
  const [devices, setDevices] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [selectedProcesses, setSelectedProcesses] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedPatternId, setSelectedPatternId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const fetchData = useCallback(async () => {
    try {
      const [devicesRes, processesRes, patternsRes] = await Promise.all([
        axios.get(`${API_URL}/devices`),
        axios.get(`${API_URL}/processes`),
        axios.get(`${API_URL}/patterns`)
      ]);
      
      setDevices(devicesRes.data);
      setProcesses(processesRes.data);
      setPatterns(patternsRes.data);
      
      // Update selected processes with fresh data if any are selected
      // Note: selectedProcessIdsRef.current is intentionally not in the dependency array
      // because refs are stable and don't trigger re-renders. The ref's .current property
      // is accessed directly to get the latest selected process IDs.
      if (selectedProcessIdsRef.current.length > 0) {
        const updatedProcesses = processesRes.data.filter(p => 
          selectedProcessIdsRef.current.includes(p.id)
        );
        setSelectedProcesses(updatedProcesses);
      }
      
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to connect to backend. Please check if the server is running.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  // Sync device filter when selected pattern's device name changes
  // This handles the case when a pattern is renamed while selected
  useEffect(() => {
    if (selectedPatternId) {
      const selectedPattern = patterns.find(p => p.id === selectedPatternId);
      if (selectedPattern && selectedPattern.deviceName) {
        // Update the filter to match the current pattern's device name
        // Using the updater function to avoid stale closure issues
        setFilters(prevFilters => {
          // Only update if the filter doesn't match the current pattern's device name
          if (prevFilters.device !== selectedPattern.deviceName) {
            return {
              ...prevFilters,
              device: selectedPattern.deviceName
            };
          }
          return prevFilters;
        });
      } else if (!selectedPattern) {
        // Pattern was deleted, clear selection
        setSelectedPatternId(null);
        setFilters(prevFilters => ({
          ...prevFilters,
          device: 'all'
        }));
      }
    }
    // Note: filters/filters.device is intentionally NOT in the dependency array to avoid infinite loops
    // We only want to react to pattern data changes, not filter changes
    // The updater function form of setFilters ensures we always have the latest filter state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patterns, selectedPatternId]);

  const handleProcessSelect = (process) => {
    setSelectedProcesses(prevSelected => {
      const isAlreadySelected = prevSelected.some(p => p.id === process.id);
      
      if (isAlreadySelected) {
        // Remove from selection
        return prevSelected.filter(p => p.id !== process.id);
      } else {
        // Add to selection
        return [...prevSelected, process];
      }
    });
  };

  const handleClearSelection = () => {
    setSelectedProcesses([]);
  };

  const handleToggleSelectAll = (filteredProcesses) => {
    // Check if all filtered processes are selected
    const allSelected = filteredProcesses.every(process => 
      selectedProcesses.some(sp => sp.id === process.id)
    );
    
    if (allSelected) {
      // Deselect all filtered processes
      const filteredIds = new Set(filteredProcesses.map(p => p.id));
      setSelectedProcesses(prevSelected => 
        prevSelected.filter(p => !filteredIds.has(p.id))
      );
    } else {
      // Select all filtered processes that aren't already selected
      const selectedIds = new Set(selectedProcesses.map(p => p.id));
      const newSelections = filteredProcesses.filter(p => !selectedIds.has(p.id));
      setSelectedProcesses(prevSelected => [...prevSelected, ...newSelections]);
    }
  };

  const handleProcessDelete = async (processId) => {
    try {
      await axios.delete(`${API_URL}/processes/${processId}`);
      
      // Remove from local state
      setProcesses(processes.filter(p => p.id !== processId));
      
      // Remove from selection if the deleted process was selected
      setSelectedProcesses(prevSelected => 
        prevSelected.filter(p => p.id !== processId)
      );
    } catch (err) {
      console.error('Error deleting process:', err);
      setError('Failed to delete process. Please try again.');
    }
  };

  const handleProcessComplete = async (processId) => {
    try {
      const response = await axios.put(`${API_URL}/processes/${processId}/complete`);
      
      // Update the process in local state
      setProcesses(processes.map(p => 
        p.id === processId ? response.data.process : p
      ));
      
      // Update selected processes if it was one of the selected ones
      setSelectedProcesses(prevSelected =>
        prevSelected.map(p => p.id === processId ? response.data.process : p)
      );
      
      // Refresh data to get updated device states
      fetchData();
    } catch (err) {
      console.error('Error completing process:', err);
      setError('Failed to mark process as complete. Please try again.');
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    // If the charger filter changed and doesn't match the selected device, clear device selection
    if (newFilters.charger !== filters.charger && newFilters.charger !== selectedDeviceId) {
      setSelectedDeviceId(null);
    }
    // If the device filter changed, check if it matches the selected pattern's device name
    // If not, clear the pattern selection
    if (newFilters.device !== filters.device) {
      const selectedPattern = patterns.find(p => p.id === selectedPatternId);
      const selectedPatternDeviceName = selectedPattern?.deviceName;
      if (newFilters.device !== selectedPatternDeviceName) {
        setSelectedPatternId(null);
      }
    }
  };

  const handleDeviceSelect = (deviceId) => {
    setSelectedDeviceId(deviceId);
    // Clear pattern selection when selecting a charger device
    setSelectedPatternId(null);
    // Update the charger filter to match the selected device
    setFilters({
      ...filters,
      charger: deviceId || 'all',
      device: 'all' // Reset device filter when selecting charger
    });
  };

  const handlePatternSelect = (patternId) => {
    setSelectedPatternId(patternId);
    // Clear charger selection when selecting a pattern
    setSelectedDeviceId(null);
    
    // Find the pattern and use its deviceName for the filter
    // This ensures compatibility with the device name-based filtering
    let deviceFilterValue = 'all';
    if (patternId) {
      const pattern = patterns.find(p => p.id === patternId);
      if (pattern && pattern.deviceName) {
        deviceFilterValue = pattern.deviceName;
      }
    }
    
    // Update the device filter to match the selected pattern's device name
    setFilters({
      ...filters,
      device: deviceFilterValue,
      charger: 'all' // Reset charger filter when selecting pattern
    });
  };

  const handlePatternUpdate = async (action, data) => {
    try {
      if (action === 'updateLabel') {
        const { patternId, newLabel, shouldRenameAll } = data;
        await axios.put(`${API_URL}/patterns/${patternId}/label`, {
          newLabel,
          shouldRenameAll
        });
        
        // Refresh data to reflect changes
        await fetchData();
      } else if (action === 'merge') {
        const { sourcePatternId, targetPatternId } = data;
        
        // If the currently selected pattern is being merged into another,
        // update the selection to point to the target pattern
        const wasSourceSelected = selectedPatternId === sourcePatternId;
        
        await axios.post(`${API_URL}/patterns/merge`, {
          sourcePatternId,
          targetPatternId
        });
        
        // If the source pattern was selected, switch selection to target
        if (wasSourceSelected) {
          setSelectedPatternId(targetPatternId);
          // Find the target pattern to get its device name
          const targetPattern = patterns.find(p => p.id === targetPatternId);
          if (targetPattern && targetPattern.deviceName) {
            setFilters(prevFilters => ({
              ...prevFilters,
              device: targetPattern.deviceName
            }));
          }
        }
        
        // Refresh data to reflect changes
        await fetchData();
      } else if (action === 'delete') {
        const { patternId } = data;
        await axios.delete(`${API_URL}/patterns/${patternId}`);
        
        // Refresh data to reflect changes
        await fetchData();
      } else if (action === 'rerun') {
        await axios.post(`${API_URL}/patterns/rerun`);
        
        // Refresh data to reflect changes
        await fetchData();
      }
    } catch (err) {
      console.error(`Error performing pattern action ${action}:`, err);
      
      // Check if it's a merge conflict (409 status)
      if (err.response?.status === 409 && err.response?.data?.shouldMerge) {
        // The backend detected that merging is needed, but let the modal handle it
        throw err;
      }
      
      throw new Error(err.response?.data?.error || 'Failed to update pattern');
    }
  };

  const handleProcessUpdate = async (action, data) => {
    try {
      if (action === 'updateDeviceName') {
        const { processId, newLabel } = data;
        await axios.put(`${API_URL}/processes/${processId}/device-name`, {
          newDeviceName: newLabel
        });
        
        // Refresh data to reflect changes
        await fetchData();
      }
    } catch (err) {
      console.error(`Error performing process action ${action}:`, err);
      throw new Error(err.response?.data?.error || 'Failed to update process');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <button 
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <h1>🔌 Charging Monitor</h1>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            <div className="dashboard-grid">
              <section className="card devices-section">
                <h2>Connected Chargers</h2>
                <DeviceList 
                  devices={devices}
                  selectedDeviceId={selectedDeviceId}
                  onSelectDevice={handleDeviceSelect}
                />
                <PatternManager 
                  patterns={patterns}
                  selectedPatternId={selectedPatternId}
                  onPatternUpdate={handlePatternUpdate}
                  onSelectPattern={handlePatternSelect}
                />
              </section>

              <section className="card processes-section">
                <h2>Charging Processes</h2>
                <ProcessFilters 
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  devices={devices}
                  patterns={patterns}
                  processes={processes}
                  selectedProcesses={selectedProcesses}
                  onToggleSelectAll={handleToggleSelectAll}
                />
                <ProcessList 
                  processes={processes}
                  patterns={patterns}
                  selectedProcesses={selectedProcesses}
                  onSelectProcess={handleProcessSelect}
                  onDeleteProcess={handleProcessDelete}
                  onCompleteProcess={handleProcessComplete}
                  onPatternUpdate={handlePatternUpdate}
                  onProcessUpdate={handleProcessUpdate}
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
          </>
        )}
      </main>
    </div>
  );
}

export default App;
