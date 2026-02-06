const { Kafka } = require('kafkajs');

// 1. Configure the Kafka Client
const kafka = new Kafka({
  clientId: 'stock-producer',
  brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const producer = kafka.producer();

// 2. Define our stock symbols and base prices
const STOCKS = {
  AAPL: 150.00,
  GOOGL: 2800.00,
  AMZN: 3400.00,
  TSLA: 900.00,
  MSFT: 300.00
};

function getFluctuatingPrice(basePrice) {
  const volatility = 0.02; // 2% max change
  const change = basePrice * volatility * (Math.random() - 0.5);
  return (basePrice + change).toFixed(2);
}

const run = async () => {
  // 3. Connect to the Cluster
  await producer.connect();
  console.log("✅ Producer connected to Kafka Cluster");

  // 4. Start the loop
  setInterval(async () => {
    try {
      // Pick a random stock
      const stockSymbol = Object.keys(STOCKS)[Math.floor(Math.random() * Object.keys(STOCKS).length)];
      
      // --- FIX: Updated function call ---
      const price = parseFloat(getFluctuatingPrice(STOCKS[stockSymbol]));
      
      const event = {
        symbol: stockSymbol,
        price: price,
        timestamp: new Date().toISOString()
      };

      // 5. Send to Kafka
      await producer.send({
        topic: 'stock-raw',
        messages: [
          { value: JSON.stringify(event) },
        ],
      });

      console.log(`📤 Sent: ${event.symbol} @ $${event.price}`);
    } catch (err) {
      console.error("Error sending message", err);
    }
  }, 1000); // Sends 1 message per second
};

run().catch(console.error);