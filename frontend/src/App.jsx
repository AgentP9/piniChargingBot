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
  const [selectedProcess, setSelectedProcess] = useState(null);
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
  
  // Use ref to track the currently selected process ID
  const selectedProcessIdRef = useRef(null);

  // Update ref when selectedProcess changes
  useEffect(() => {
    selectedProcessIdRef.current = selectedProcess?.id || null;
  }, [selectedProcess]);

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
      
      // Update selected process with fresh data if one is selected
      // Note: selectedProcessIdRef.current is intentionally not in the dependency array
      // because refs are stable and don't trigger re-renders. The ref's .current property
      // is accessed directly to get the latest selected process ID.
      if (selectedProcessIdRef.current !== null) {
        const updatedProcess = processesRes.data.find(p => p.id === selectedProcessIdRef.current);
        if (updatedProcess) {
          setSelectedProcess(updatedProcess);
        } else {
          // Clear selection if process is no longer available
          setSelectedProcess(null);
        }
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
        // Only update if the filter doesn't match the current pattern's device name
        if (filters.device !== selectedPattern.deviceName) {
          setFilters(prevFilters => ({
            ...prevFilters,
            device: selectedPattern.deviceName
          }));
        }
      } else if (!selectedPattern) {
        // Pattern was deleted, clear selection
        setSelectedPatternId(null);
        setFilters(prevFilters => ({
          ...prevFilters,
          device: 'all'
        }));
      }
    }
  }, [patterns, selectedPatternId, filters.device]);

  const handleProcessSelect = (process) => {
    setSelectedProcess(process);
  };

  const handleProcessDelete = async (processId) => {
    try {
      await axios.delete(`${API_URL}/processes/${processId}`);
      
      // Remove from local state
      setProcesses(processes.filter(p => p.id !== processId));
      
      // Clear selection if the deleted process was selected
      if (selectedProcess?.id === processId) {
        setSelectedProcess(null);
      }
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
      
      // Update selected process if it was the one completed
      if (selectedProcess?.id === processId) {
        setSelectedProcess(response.data.process);
      }
      
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
        await axios.post(`${API_URL}/patterns/merge`, {
          sourcePatternId,
          targetPatternId
        });
        
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
        <h1>🔌 Pini Charging Monitor</h1>
        <p>Real-time monitoring of device charging via MQTT</p>
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
                />
                <ProcessList 
                  processes={processes}
                  patterns={patterns}
                  selectedProcess={selectedProcess}
                  onSelectProcess={handleProcessSelect}
                  onDeleteProcess={handleProcessDelete}
                  onCompleteProcess={handleProcessComplete}
                  onPatternUpdate={handlePatternUpdate}
                  onProcessUpdate={handleProcessUpdate}
                  filters={filters}
                />
              </section>
            </div>

            {selectedProcess && (
              <section className="card chart-section">
                <h2>Charging Details - Process #{selectedProcess.id}</h2>
                <div className="process-info">
                  <div className="info-item">
                    <strong>Device:</strong> {selectedProcess.deviceName || selectedProcess.deviceId}
                  </div>
                  <div className="info-item">
                    <strong>Start:</strong> {new Date(selectedProcess.startTime).toLocaleString()}
                  </div>
                  {selectedProcess.endTime && (
                    <div className="info-item">
                      <strong>End:</strong> {new Date(selectedProcess.endTime).toLocaleString()}
                    </div>
                  )}
                  <div className="info-item">
                    <strong>Status:</strong> 
                    <span className={selectedProcess.endTime ? 'status-completed' : 'status-active'}>
                      {selectedProcess.endTime ? ' Completed' : ' Active'}
                    </span>
                  </div>
                </div>
                <ChargingChart process={selectedProcess} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
