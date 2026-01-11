import React, { useMemo, useState } from 'react';
import { FRIENDLY_DEVICE_NAMES } from '../constants/deviceNames';
import './ProcessFilters.css';

function ProcessFilters({ filters, onFilterChange, devices, patterns }) {
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

  // Get unique chargers (physical charging devices) using a Map for O(n) complexity
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

  // Get unique device names from patterns (charged devices like Hugo, Egon, etc.)
  // Memoized to avoid recalculation on every render
  const uniqueDeviceNames = useMemo(() => {
    if (!patterns || patterns.length === 0) return [];
    
    const deviceNames = patterns.map((pattern, index) => ({
      id: pattern.id,
      name: FRIENDLY_DEVICE_NAMES[index % FRIENDLY_DEVICE_NAMES.length]
    }));
    
    return deviceNames;
  }, [patterns]);

  return (
    <div className="process-filters">
      <div className="filter-header">
        <button 
          className="filter-toggle-button"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse filters" : "Expand filters"}
        >
          <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="toggle-text">Filters</span>
          {hasActiveFilters && !isExpanded && (
            <span className="active-filters-badge">{
              [
                filters.state !== 'all',
                filters.charger !== 'all',
                filters.device !== 'all',
                filters.startDate,
                filters.endDate
              ].filter(Boolean).length
            }</span>
          )}
        </button>
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
              {uniqueDeviceNames.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name}
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
