const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://admin:rach0605@cluster0.kebnp5q.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri);

let db;

async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db("linkUp");
        console.log("Connected to MongoDB");
    }
    return db;
}

async function getUsersCollection() {
    const database = await connectDB();
    return database.collection("users");
}

async function getLocationsCollection() {
    const database = await connectDB();
    return database.collection("locations");
}

module.exports = {
    connectDB,
    getUsersCollection,
    getLocationsCollection
};