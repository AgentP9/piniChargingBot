import React, { useMemo, useState } from 'react';
import './ProcessFilters.css';

function ProcessFilters({ filters, onFilterChange, devices, patterns, processes, selectedProcesses, onToggleSelectAll }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStateChange = (e) => {
    onFilterChange({ ...filters, state: e.target.value });
  };

  const handleChargerChange = (e) => {
    onFilterChange({ ...filters, charger: e.target.value });
  };

  const handleDeviceChange = (e) => {
    onFilterChange({ ...filters, device: e.target.value });
  };

  const handleStartDateChange = (e) => {
    onFilterChange({ ...filters, startDate: e.target.value });
  };

  const handleEndDateChange = (e) => {
    onFilterChange({ ...filters, endDate: e.target.value });
  };

  const handleClearFilters = () => {
    onFilterChange({ state: 'all', charger: 'all', device: 'all', startDate: '', endDate: '' });
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const hasActiveFilters = filters.state !== 'all' || filters.charger !== 'all' || filters.device !== 'all' || filters.startDate || filters.endDate;

  // Count active filters for badge display
  // Memoized to avoid recalculation on every render
  const activeFilterCount = useMemo(() => {
    return [
      filters.state !== 'all',
      filters.charger !== 'all',
      filters.device !== 'all',
      filters.startDate,
      filters.endDate
    ].filter(Boolean).length;
  }, [filters]);

  // Get unique chargers (physical charging devices like ShellyPlugs) using a Map for O(n) complexity
  // Memoized to avoid recalculation on every render
  const uniqueChargers = useMemo(() => {
    const uniqueChargersMap = new Map();
    devices.forEach(device => {
      if (!uniqueChargersMap.has(device.id)) {
        uniqueChargersMap.set(device.id, device);
      }
    });
    return Array.from(uniqueChargersMap.values());
  }, [devices]);

  // Get unique device names from patterns (charged devices like iPhones, TonieBoxes, etc.)
  // Memoized to avoid recalculation on every render
  const uniqueDeviceNames = useMemo(() => {
    if (!patterns || patterns.length === 0) return [];
    
    // Use a Set to deduplicate device names
    // Multiple patterns can have the same deviceName, but we only want to show each name once in the filter
    const uniqueNames = new Set();
    patterns.forEach((pattern) => {
      if (pattern.deviceName) {
        uniqueNames.add(pattern.deviceName);
      }
    });
    
    // Convert Set to array and sort alphabetically for consistent ordering
    return Array.from(uniqueNames).sort();
  }, [patterns]);

  // Filter processes based on current filters (same logic as ProcessList)
  const filteredProcesses = useMemo(() => {
    if (!processes || !onToggleSelectAll) return [];
    
    // Parse filter dates
    const filterStartDate = filters?.startDate ? new Date(filters.startDate).setHours(0, 0, 0, 0) : null;
    const filterEndDate = filters?.endDate ? new Date(filters.endDate).setHours(23, 59, 59, 999) : null;
    
    // Pre-compute process ID to device name mapping
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
    
    return processes.filter(process => {
      // State filter
      const isCompleted = process.endTime !== null && process.endTime !== undefined;
      if (filters?.state === 'active' && isCompleted) return false;
      if (filters?.state === 'completed' && !isCompleted) return false;
      
      // Charger filter
      if (filters?.charger && filters.charger !== 'all') {
        const processChargerId = process.chargerId || process.deviceId;
        if (processChargerId !== filters.charger) return false;
      }
      
      // Device filter
      if (filters?.device && filters.device !== 'all') {
        const deviceName = processIdToDeviceName[process.id];
        if (!deviceName || deviceName !== filters.device) return false;
      }
      
      // Start date filter
      if (filterStartDate) {
        const processDate = new Date(process.startTime).getTime();
        if (processDate < filterStartDate) return false;
      }
      
      // End date filter
      if (filterEndDate) {
        const processDate = new Date(process.startTime).getTime();
        if (processDate > filterEndDate) return false;
      }
      
      return true;
    });
  }, [processes, filters, patterns, onToggleSelectAll]);

  // Check if all filtered processes are selected
  const allFilteredSelected = useMemo(() => {
    if (!filteredProcesses || filteredProcesses.length === 0 || !selectedProcesses) return false;
    return filteredProcesses.every(process => 
      selectedProcesses.some(sp => sp.id === process.id)
    );
  }, [filteredProcesses, selectedProcesses]);

  const handleToggleSelectAll = () => {
    if (onToggleSelectAll && filteredProcesses.length > 0) {
      onToggleSelectAll(filteredProcesses);
    }
  };

  return (
    <div className="process-filters">
      <div className="filter-header">
        <button 
          className="filter-toggle-button"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse filters" : "Expand filters"}
        >
          <span className="toggle-icon" aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
          <span className="toggle-text">Filters</span>
          {!isExpanded && (
            <span className={`active-filters-badge ${activeFilterCount === 0 ? 'no-filters' : ''}`}>
              {activeFilterCount}
            </span>
          )}
        </button>
        {onToggleSelectAll && filteredProcesses.length > 0 && (
          <button
            className="select-all-button"
            onClick={handleToggleSelectAll}
            title={allFilteredSelected ? "Deselect all filtered processes" : "Select all filtered processes"}
          >
            {allFilteredSelected ? '☑ Deselect All' : '☐ Select All'}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="state-filter">Status:</label>
            <select 
              id="state-filter" 
              value={filters.state} 
              onChange={handleStateChange}
              className="filter-select"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="charger-filter">Charger:</label>
            <select 
              id="charger-filter" 
              value={filters.charger} 
              onChange={handleChargerChange}
              className="filter-select"
            >
              <option value="all">All Chargers</option>
              {uniqueChargers.map(charger => (
                <option key={charger.id} value={charger.id}>
                  {charger.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="device-filter">Device:</label>
            <select 
              id="device-filter" 
              value={filters.device} 
              onChange={handleDeviceChange}
              className="filter-select"
            >
              <option value="all">All Devices</option>
              {uniqueDeviceNames.map(deviceName => (
                <option key={deviceName} value={deviceName}>
                  {deviceName}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="start-date-filter">Start Date:</label>
            <input
              id="start-date-filter"
              type="date"
              value={filters.startDate}
              onChange={handleStartDateChange}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="end-date-filter">End Date:</label>
            <input
              id="end-date-filter"
              type="date"
              value={filters.endDate}
              onChange={handleEndDateChange}
              className="filter-input"
            />
          </div>

          {hasActiveFilters && (
            <button 
              className="clear-filters-button"
              onClick={handleClearFilters}
              title="Clear all filters"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProcessFilters;
