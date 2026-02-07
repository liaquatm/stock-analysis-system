import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const socket = io('http://localhost:4000');

function App() {
  const [data, setData] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL'); // Default to AAPL
  const [alert, setAlert] = useState(null);
  
  // We use a Ref to access the current state inside the socket listener without re-binding it
  const symbolRef = useRef(selectedSymbol);

  useEffect(() => {
    symbolRef.current = selectedSymbol;
    setData([]); // Clear chart when switching stocks
  }, [selectedSymbol]);

  useEffect(() => {
    socket.on('stock-update', (stock) => {
      // FILTER: Only update chart if the incoming stock matches what we selected
      if (stock.symbol === symbolRef.current) {
        setData((currentData) => {
          const newData = [...currentData, stock];
          if (newData.length > 50) newData.shift(); // Keep graph clean
          return newData;
        });
      }
    });

    socket.on('trade-signal', (signal) => {
      // Only show alerts for the selected stock (or remove check to see all alerts)
      if (signal.symbol === symbolRef.current) {
         setAlert(signal);
         setTimeout(() => setAlert(null), 5000);
      }
    });

    return () => {
      socket.off('stock-update');
      socket.off('trade-signal');
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>📈 {selectedSymbol} Stock Analysis</h1>
        
        {/* STOCK SELECTOR */}
        <select 
          value={selectedSymbol} 
          onChange={(e) => setSelectedSymbol(e.target.value)}
          style={{ padding: '10px', fontSize: '16px', borderRadius: '5px' }}
        >
          <option value="AAPL">AAPL (Apple)</option>
          <option value="GOOGL">GOOGL (Google)</option>
          <option value="AMZN">AMZN (Amazon)</option>
          <option value="TSLA">TSLA (Tesla)</option>
          <option value="MSFT">MSFT (Microsoft)</option>
        </select>
      </div>

      {/* ALERT BOX */}
      {alert && (
        <div style={{
          padding: '15px',
          backgroundColor: alert.signal === 'BUY' ? '#4caf50' : '#f44336',
          color: 'white',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          🚨 {alert.signal} SIGNAL DETECTED: {alert.symbol} @ ${alert.price}
        </div>
      )}

      {/* CHART */}
      <div style={{ width: '100%', height: 400, backgroundColor: '#f9f9f9', borderRadius: '10px', padding: '10px', border: '1px solid #ddd' }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={(tick) => new Date(tick).toLocaleTimeString()} />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip labelFormatter={(label) => new Date(label).toLocaleTimeString()} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#2196F3" 
              strokeWidth={3} 
              dot={false} 
              isAnimationActive={false} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p style={{ textAlign: 'center', color: '#888', marginTop: '10px' }}>
        Real-time data stream from Kafka Cluster via WebSocket
      </p>
    </div>
  );
}

export default App;