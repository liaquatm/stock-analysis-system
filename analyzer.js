const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'stock-analyzer',
  brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094']
});

const consumer = kafka.consumer({ groupId: 'analyzer-group' });
const producer = kafka.producer();

// IN-MEMORY STATE: This acts like our temporary database
// Structure: { AAPL: [150, 151, 152...], GOOGL: [...] }
const stockHistory = {};

// CONFIGURATION
const FAST_WINDOW = 5;  // Average of last 5 ticks
const SLOW_WINDOW = 20; // Average of last 20 ticks

// Helper: Calculate average of an array
const calculateAverage = (prices) => {
  if (prices.length === 0) return 0;
  const sum = prices.reduce((a, b) => a + b, 0);
  return sum / prices.length;
};

const run = async () => {
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: 'stock-raw', fromBeginning: false });

  console.log("🧠 Analyzer Service Started...");

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      const stockData = JSON.parse(value);
      const symbol = stockData.symbol;
      const price = stockData.price;

      // 1. Initialize state if new stock
      if (!stockHistory[symbol]) {
        stockHistory[symbol] = [];
      }

      // 2. Add new price to history
      stockHistory[symbol].push(price);

      // 3. Keep only the data we need (manage memory)
      if (stockHistory[symbol].length > SLOW_WINDOW) {
        stockHistory[symbol].shift(); // Remove oldest
      }

      // 4. Calculate Averages
      const history = stockHistory[symbol];
      if (history.length >= SLOW_WINDOW) {
        const fastData = history.slice(-FAST_WINDOW); // Last 5
        const slowData = history;                     // Last 20

        const fastMA = calculateAverage(fastData);
        const slowMA = calculateAverage(slowData);

        // 5. DECISION LOGIC
        // We look at the *previous* state to detect a "Crossover"
        // (In a real app, we would store previous MA to compare. 
        //  Here, we simplify: If Fast is > 1% higher than Slow, we Buy.)
        
        let signal = 'HOLD';
        if (fastMA > slowMA) {
             signal = 'BUY';
        } else if (fastMA < slowMA) {
             signal = 'SELL';
        }

        console.log(`📊 ${symbol} | Price: ${price} | FastMA: ${fastMA.toFixed(2)} | SlowMA: ${slowMA.toFixed(2)} | Signal: ${signal}`);

        // 6. Publish Signal (Only if it's interesting)
        if (signal !== 'HOLD') {
            const tradeSignal = {
                symbol: symbol,
                signal: signal,
                price: price,
                timestamp: new Date().toISOString()
            };
            
            await producer.send({
                topic: 'trade-signals',
                messages: [ { value: JSON.stringify(tradeSignal) } ]
            });
        }
      }
    },
  });
};

run().catch(console.error);