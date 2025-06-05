import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('❌ MONGO_URI not set in .env');
}

let client;
let clientPromise;



if (!globalThis._mongoClientPromise) {
  try {
    client = new MongoClient(uri);
    globalThis._mongoClientPromise = client.connect();
    console.log("✅ MongoDB connection initiated...");
  } catch (err) {
    console.error("❌ Failed to initiate MongoDB connection:", err);
    throw err;
  }
}

clientPromise = globalThis._mongoClientPromise;


export default clientPromise;
