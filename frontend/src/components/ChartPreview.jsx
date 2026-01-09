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

  // Don't render if no data
  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="chart-preview">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <Line 
            type="monotone" 
            dataKey="power" 
            stroke="#999999" 
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ChartPreview;
