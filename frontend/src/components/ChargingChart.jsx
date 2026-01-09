import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './ChargingChart.css';

function ChargingChart({ process }) {
  const chartData = useMemo(() => {
    if (!process || !process.events) return [];
    
    // Filter power consumption events and format for chart
    const powerEvents = process.events
      .filter(e => e.type === 'power_consumption')
      .map(e => ({
        timestamp: new Date(e.timestamp),
        power: e.value,
        time: new Date(e.timestamp).toLocaleTimeString()
      }));
    
    return powerEvents;
  }, [process]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const powers = chartData.map(d => d.power);
    const maxPower = Math.max(...powers);
    const minPower = Math.min(...powers);
    const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
    
    // Calculate energy (approximate)
    const duration = process.endTime 
      ? new Date(process.endTime) - new Date(process.startTime)
      : Date.now() - new Date(process.startTime);
    const totalEnergy = (avgPower * duration / 1000 / 3600).toFixed(2); // Wh
    
    return {
      maxPower: maxPower.toFixed(2),
      minPower: minPower.toFixed(2),
      avgPower: avgPower.toFixed(2),
      totalEnergy,
      dataPoints: chartData.length
    };
  }, [chartData, process]);

  if (chartData.length === 0) {
    return (
      <div className="chart-empty">
        <p>No power consumption data available for this charging process.</p>
      </div>
    );
  }

  return (
    <div className="charging-chart">
      <div className="chart-stats">
        <div className="stat-card">
          <div className="stat-label">Max Power</div>
          <div className="stat-value">{stats.maxPower} W</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Power</div>
          <div className="stat-value">{stats.avgPower} W</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Min Power</div>
          <div className="stat-value">{stats.minPower} W</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Energy</div>
          <div className="stat-value">{stats.totalEnergy} Wh</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Data Points</div>
          <div className="stat-value">{stats.dataPoints}</div>
        </div>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="time" 
              stroke="#666"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="#666"
              tick={{ fontSize: 12 }}
              label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '10px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="power" 
              stroke="#667eea" 
              strokeWidth={2}
              dot={{ fill: '#667eea', r: 3 }}
              activeDot={{ r: 6 }}
              name="Power (W)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ChargingChart;
