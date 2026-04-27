const express = require("express");
const router = express.Router();
const db = require("../sql");
const { ObjectId } = require("mongodb");
const { getUsersCollection, getLocationsCollection } = require("../mongo");

router.get("/", async (req, res) => {
    try {
        const rows = await db.query("SELECT * FROM `groups`");

        const groups = rows.map(g => ({
            ...g,
            interest_tags: JSON.parse(g.interest_tags || "[]")
        }));

        const [groupRows] = await db.query(`
            SELECT interest_tags
            FROM groups
            WHERE id = ?
        `, [groupId]);

        const groupTags = JSON.parse(groupRows.interest_tags || "[]");

        res.json(groups);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching groups "});
    }
});

router.post("/", async (req, res) => {
    const { name, description, creator_id, interest_tags } = req.body;

    try {
        const result = await db.query(`
            INSERT INTO \`groups\` (name, description, creator_id, interest_tags)
            VALUES (?, ?, ?, ?)
        `, [
            name,
            description,
            creator_id,
            JSON.stringify(interest_tags || [])
        ]);

        const groupId = result.insertId;

        await db.query(`
            INSERT INTO group_members (group_id, user_id, role)
            VALUES (?, ?, ?)
        `, [groupId, creator_id, "admin"]);

        res.json({ message: "Group created", groupId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error creating group" });
    }
});

router.post("/:id/join", async (req, res) => {
    const groupId = req.params.id;
    const { user_id } = req.body;

    try {
        await db.query(
            "INSERT INTO `group_members` (group_id, user_id, role) VALUES (?, ?, ?)",
            [groupId, user_id, "member"]
        );

        res.send("Joined group");
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error joining group" });
    }
});

router.get("/:id/meetup-spots", async (req, res) => {
    try {
        const groupId = req.params.id;

        console.log("HIT meetup-spots route:", req.params.id);

        const [memberRows] = await db.query(`
            SELECT user_id
            FROM group_members
            WHERE group_id = ?
        `, [groupId]);

        console.log("memberRows:", memberRows);

        const userIds = Array.isArray(memberRows)
            ? memberRows.map(m => m.user_id)
            : [memberRows.user_id];

        if (!userIds.length) {
            return res.json({ centroid: null, spots: [] });
        }

        const usersCollection = await getUsersCollection();

        const validIds = userIds
            .filter(id => ObjectId.isValid(id))
            .map(id => new ObjectId(id));

        const members = await usersCollection.find({
            _id: { $in: validIds }
        }).toArray();

        console.log("RAW MEMBERS:", members);

        console.log("RAW MEMBER LOCATIONS:", members.map(m => m.location));

        const coords = members
            .filter(m => m.location?.coordinates?.coordinates)
            .map(m => m.location.coordinates.coordinates);

        console.log("coords:", coords);
        
        if (!coords.length || coords.some(c => isNaN(c[0]) || isNaN(c[1]))) {
            return res.json({ centroid: null, spots: [] });
        }

        const centroid = [
            coords.reduce((sum, c) => sum + c[0], 0) / coords.length,
            coords.reduce((sum, c) => sum + c[1], 0) / coords.length
        ];

        const locationsCollection = await getLocationsCollection();

        console.log("CENTROID:", centroid);

        const spotsRaw = await locationsCollection.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [Number(centroid[0]), Number(centroid[1])]
                    },
                    distanceField: "distance",
                    spherical: true,
                    key: "location"
                }
            },
            { $limit: 30 }
        ]).toArray();

        res.json({ centroid, spotsRaw });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error finding meetup spots");
    }
});

router.get("/user/:userId", async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT g.*
            FROM \`groups\` g
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.user_id = ?
        `, [req.params.userId]);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching user groups" });
    }
});

module.exports = router;