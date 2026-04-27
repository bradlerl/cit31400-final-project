const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./sql");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

const userRoutes = require("./routes/users");
const groupRoutes = require("./routes/groups");
const eventRoutes = require("./routes/events");
const locationRoutes = require("./routes/locations");

app.use("/users", userRoutes);
app.use("/groups", groupRoutes);
app.use("/events", eventRoutes);
app.use("/locations", locationRoutes);

app.get("/test", (req, res) => {
    res.json({ message: "Server is working! "});
});

const PORT = 8080;

app.get("/sql-test", async (req, res) => {
    try {
        const result = await db.query("SELECT NOW() AS time");
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send("SQL error");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});