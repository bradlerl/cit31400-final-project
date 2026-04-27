const express = require("express");
const router = express.Router();
const db = require("../sql");

router.get("/group/:groupId", async (req, res) => {
    try {
        const events = await db.query(
            "SELECT * FROM events WHERE group_id = ?",
            [req.params.groupId]
        );

        res.json(events);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching events");
    }
});

router.post("/", async (req, res) => {
    const { group_id, name, location, event_time, description } = req.body;

    try {
        await db.query(
            "INSERT INTO events (group_id, name, location, event_time, description) VALUES (?, ?, ?, ?, ?)",
            [group_id, name, location, event_time, description]
        );

        res.send("Event created");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error creating event");
    }
});

module.exports = router;