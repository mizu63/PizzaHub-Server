import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export const getMongoClient = (): MongoClient => {
  if (!client) {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is missing");
    }

    client = new MongoClient(uri);
  }

  return client;
};

export const getDB = (): Db => {
  if (!db) {
    const dbName = process.env.DB_NAME;

    if (!dbName) {
      throw new Error("DB_NAME is missing");
    }

    db = getMongoClient().db(dbName);
  }

  return db;
};

export const connectDB = async (): Promise<void> => {
  await getMongoClient().connect();

  await getDB().command({ ping: 1 });

  console.log("MongoDB Connected Successfully");
};