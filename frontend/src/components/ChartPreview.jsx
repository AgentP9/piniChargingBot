import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import './ChartPreview.css';

function ChartPreview({ process }) {
  const chartData = useMemo(() => {
    if (!process || !process.events) return [];
    
    // Filter power consumption events and format for chart
    const powerEvents = process.events
      .filter(e => e.type === 'power_consumption')
      .map(e => ({
        power: e.value
      }));
    
    return powerEvents;
  }, [process]);

  // Don't render if no data or process is still active
  if (chartData.length === 0 || !process.endTime) {
    return null;
  }

  return (
    <div className="chart-preview">
      <ResponsiveContainer width="100%" height={80}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <Line 
            type="monotone" 
            dataKey="power" 
            stroke="#667eea" 
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ChartPreview;
