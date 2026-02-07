const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');
const cors = require('cors');

// 1. Setup Express & Socket.io
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow React to connect from anywhere
    methods: ["GET", "POST"]
  }
});

// 2. Setup Kafka Consumer
const kafka = new Kafka({
  clientId: 'websocket-server',
  brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094']
});

const consumer = kafka.consumer({ groupId: 'websocket-group' });

const run = async () => {
  // 3. Connect to Kafka
  await consumer.connect();
  
  // We subscribe to BOTH topics
  await consumer.subscribe({ topic: 'stock-raw', fromBeginning: false });
  await consumer.subscribe({ topic: 'trade-signals', fromBeginning: false });

  console.log("📡 WebSocket Server listening for Kafka events...");

  // 4. Relay Messages to Frontend
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      const data = JSON.parse(value);

      if (topic === 'stock-raw') {
        // Broadcast live price updates
        io.emit('stock-update', data);
      } 
      
      if (topic === 'trade-signals') {
        // Broadcast Buy/Sell signals
        console.log(`🚨 ALERT SENT: ${data.signal} for ${data.symbol}`);
        io.emit('trade-signal', data);
      }
    },
  });
};

run().catch(console.error);

// 5. Start the Server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
});