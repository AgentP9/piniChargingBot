import React, { useMemo } from 'react';
import './ProcessFilters.css';

function ProcessFilters({ filters, onFilterChange, devices }) {
  const handleStateChange = (e) => {
    onFilterChange({ ...filters, state: e.target.value });
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
    onFilterChange({ state: 'all', device: 'all', startDate: '', endDate: '' });
  };

  const hasActiveFilters = filters.state !== 'all' || filters.device !== 'all' || filters.startDate || filters.endDate;

  // Get unique devices from the devices array using a Map for O(n) complexity
  // Memoized to avoid recalculation on every render
  const uniqueDevices = useMemo(() => {
    const uniqueDevicesMap = new Map();
    devices.forEach(device => {
      if (!uniqueDevicesMap.has(device.id)) {
        uniqueDevicesMap.set(device.id, device);
      }
    });
    return Array.from(uniqueDevicesMap.values());
  }, [devices]);

  return (
    <div className="process-filters">
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
          <label htmlFor="device-filter">Device:</label>
          <select 
            id="device-filter" 
            value={filters.device} 
            onChange={handleDeviceChange}
            className="filter-select"
          >
            <option value="all">All Devices</option>
            {uniqueDevices.map(device => (
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
    </div>
  );
}

export default ProcessFilters;
