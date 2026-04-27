const express = require("express");
const router = express.Router();
const { connectDB } = require("../mongo");

router.get("/", async (req, res) => {
    try {
        const db = await connectDB();
        const locations = await db.collection("locations").find().toArray();

        res.json(locations);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching locations");
    }
});

module.exports = router;