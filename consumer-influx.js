const { Kafka } = require('kafkajs');
const Influx = require('influx');

// 1. Configure InfluxDB Connection
const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'stock_market', // Matches the env var in docker-compose
  schema: [
    {
      measurement: 'stock_price',
      fields: {
        price: Influx.FieldType.FLOAT
      },
      tags: [
        'symbol'
      ]
    }
  ]
});

// 2. Configure Kafka Client
const kafka = new Kafka({
  clientId: 'influx-consumer',
  brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094']
});

const consumer = kafka.consumer({ groupId: 'storage-group' });

const run = async () => {
  // 3. Connect to Kafka
  await consumer.connect();
  console.log("✅ Consumer connected to Kafka");

  // 4. Subscribe to the topic
  await consumer.subscribe({ topic: 'stock-raw', fromBeginning: true });

  // 5. Run the consumer loop
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      const stockData = JSON.parse(value);

      console.log(`📥 Received: ${stockData.symbol} $${stockData.price} -> Writing to InfluxDB`);

      // 6. Write to InfluxDB
      await influx.writePoints([
        {
          measurement: 'stock_price',
          tags: { symbol: stockData.symbol },
          fields: { price: stockData.price },
          timestamp: new Date(stockData.timestamp).getTime() * 1000000 // Influx expects nanoseconds
        }
      ]).catch(err => {
        console.error(`Error saving data to InfluxDB! ${err.stack}`);
      });
    },
  });
};

run().catch(console.error);