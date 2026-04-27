const express = require("express");
const router = express.Router();
const { getUsersCollection } = require("../mongo");
const db = require("../sql");
const { ObjectId } = require("mongodb");
const fetch = require("node-fetch");

router.get("/", async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();
        const users = await usersCollection.find().toArray();
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching users");
    }
});

router.get("/matches/:id", async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();

        const currentUser = await usersCollection.findOne({
            _id: new ObjectId(req.params.id)
        });

        if (!currentUser) {
            return res.status(404).send("User not found");
        }

        const coords = currentUser.location?.coordinates?.coordinates;

        if (!Array.isArray(coords)) {
            return res.status(400).json({
                error: "User has invalid or missing coordinates"
            });
        }

        const matches = await usersCollection.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: coords
                    },
                    distanceField: "distance",
                    spherical: true,
                    maxDistance: 50000
                }
            },
            {
                $match: {
                    _id: { $ne: currentUser._id }
                }
            },
            {
                $match: {
                    _id: {
                        $nin: (currentUser.friends || []).map(id => new ObjectId(id))
                    }
                }
            },
            {
                $match: {
                    age: {
                        $gte: currentUser.age - 3,
                        $lte: currentUser.age + 3
                    }
                }
            },
            {
                $addFields: {
                    sharedInterests: {
                        $size: {
                            $setIntersection: [
                                "$interests",
                                currentUser.interests || []
                            ]
                        }
                    }
                }
            },
            {
                $match: {
                    sharedInterests: { $gt: 0 }
                }
            },
            {
                $addFields: {
                    score: {
                        $add: [
                            { $multiply: ["$sharedInterests", 10] },
                            {
                                $subtract: [
                                    50,
                                    { $divide: ["$distance", 1000], }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $sort: { score: -1 }
            },
            {
                $limit: 10
            }
        ]).toArray();

        res.json(matches);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error finding matches");
    }
});

router.post("/friend-request", async (req, res) => {
    const { requester_id, receiver_id } = req.body;

    try {
        const existing = await db.query(
            "SELECT * FROM friendships WHERE requester_id = ? AND receiver_id = ?",
            [requester_id, receiver_id]
        );

        if (existing.length > 0) {
            return res.status(400).send("Request already exists");
        }

        await db.query(
            "INSERT INTO friendships (requester_id, receiver_id, status) VALUES (?, ?, ?)",
            [requester_id, receiver_id, "pending"]
        );

        res.send("Friend request sent");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error sending request");
    }
});

router.post("/friend-request/accept", async (req, res) => {
    const { requester_id, receiver_id } = req.body;

    try {
        await db.query(
            "UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND receiver_id = ?",
            [requester_id, receiver_id]
        );

        res.send("Friend request accepted");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error accepting request");
    }
});

router.post("/friend-request/reject", async (req, res) => {
    const { requester_id, receiver_id } = req.body;

    try {
        await db.query(
            "DELETE FROM friendships WHERE requester_id = ? AND receiver_id = ?",
            [requester_id, receiver_id]
        );
        
        res.send("Friend request rejected");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error rejecting request");
    }
});

router.get("/friend-requests/:userId", async (req, res) => {
    const userId = req.params.userId;

    try {
        const requests = await db.query(
            "SELECT * FROM friendships WHERE receiver_id = ? AND status = 'pending'",
            [userId]
        );

        res.json(requests);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching requests");
    }
});

router.get("/friends/:userId", async (req, res) => {
    const userId = req.params.userId;

    try {
        const friends = await db.query(
            `SELECT * FROM friendships
            WHERE (requester_id = ? OR receiver_id = ?)
            AND status = 'accepted'`,
            [userId, userId]
        );

        res.json(friends);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching friends");
    }
});

router.get("/:id", async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();

        const user = await usersCollection.findOne({
            _id: new ObjectId(req.params.id)
        });

        if (!user) return res.status(404).send("User not found");

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching profile");
    }
});

router.get("/friends/:userId/full", async (req, res) => {
    const userId = req.params.userId;

    try {
        const rows = await db.query(
            `SELECT
                CASE
                    WHEN requester_id = ? THEN receiver_id
                    ELSE requester_id
                END AS friend_id
            FROM friendships
            WHERE (requester_id = ? OR receiver_id = ?)
            AND status = 'accepted'`,
            [userId, userId, userId]
        );

        const friendIds = rows.map(r => new ObjectId(r.friend_id));

        if (!rows || rows.length === 0) {
            return res.json([]);
        }

        const usersCollection = await getUsersCollection();

        const friends = await usersCollection
            .find({ _id: { $in: friendIds }})
            .toArray();
            
        res.json(friends);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching friends" });
    }
});

router.get("/friend-requests/:userId/full", async (req, res) => {
    const userId = req.params.userId;

    try {
        const rows = await db.query(
            `SELECT requester_id
            FROM friendships
            WHERE receiver_id = ?
            AND status = 'pending'`,
            [userId]
        );

        const requesterIds = rows.map(r => new ObjectId(r.requester_id));

        if (!rows || rows.length === 0) {
            return res.json([]);
        }

        const usersCollection = await getUsersCollection();

        const users = await usersCollection
            .find({ _id: { $in: requesterIds }})
            .toArray();

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching requests" });
    }
});

router.get("/search/:suffix", async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();

        const suffix = req.params.suffix;

        const users = await usersCollection.aggregate([
            {
                $addFields: {
                    idString: { $toString: "$_id" }
                }
            },
            {
                $match: {
                    $expr: {
                        $eq: [
                            {
                                $substrBytes: [
                                    "$idString",
                                    { $subtract: [{ $strLenBytes: "$idString" }, 6] },
                                    6
                                ]
                            },
                            suffix
                        ]
                    }
                }
            }
        ]).toArray();

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error searching users");
    }
});

router.get("/nearby/:userId", async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();
        const locationsCollection = (await getDb()).collection("locations");

        const user = await usersCollection.findOne({_id: new ObjectId(req.params.userId)});

        if (!user || !user.location) {
            return res.status(400).send("User location not found");
        }

        const nearby = await locationsCollection.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: user.location.coordinates.coordinates
                    },
                    distanceField: "distance",
                    spherical: true,
                    maxDistance: 50000
                }
            }
        ]).toArray();

        res.json(nearby);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching nearby locations");
    }
});

router.post("/create", async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();

        const { name, age, city, interests } = req.body;

        if (!name || !age) {
            return res.status(400).send("Missing required fields");
        }

        const baseLng = -77.0369 + (Math.random() - 0.5) * 0.2;
        const baseLat = 38.9072 + (Math.random() - 0.5) * 0.2;

        const newUser = {
            name,
            age: Number(age),
            location: {
                city: city || "Unknown",
                coordinates: {
                    type: "Point",
                    coordinates: [baseLng, baseLat]
                }
            },
            interests: interests || [],
            friends: []
        };

        const result = await usersCollection.insertOne(newUser);

        res.json({
            message: "User created",
            userId: result.insertedId
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error creating user");
    }
});

router.put("/:id", async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();
        const { name, age, city, interests, bio } = req.body;

        const updateDoc = {
            $set: {
                name,
                age: Number(age),
                "location.city": city,
                interests: interests.split(",").map(i => i.trim()),
                bio
            }
        };

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(req.params.id) },
            updateDoc
        );

        res.json({ message: "Profile updated! "});
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating profile");
    }
});

router.get("/recommended/:userId", async (req, res) => {
    try {
        const usersCollection = await getUsersCollection();

        const user = await usersCollection.findOne({
            _id: new ObjectId(req.params.userId)
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userInterests = user.interests || [];

        if (userInterests.length === 0) {
            return res.json([]);
        }

        const groupsResult = await db.query(
            "SELECT * FROM `groups`"
        );

        const groups = Array.isArray(groupsResult)
            ? groupsResult
            : groupsResult.rows || groupsResult[0];

        const recommended = groups
            .map(group => {
                let tags = [];

                try {
                    tags = JSON.parse(group.interest_tags || "[]");
                } catch (e) {
                    tags = [];
                }

                const shared = tags.filter(t => userInterests.includes(t));

                return {
                    ...group,
                    tags,
                    sharedCount: shared.length
                };
            })
            .filter(g => g.sharedCount > 0)
            .sort((a, b) => b.sharedCount - a.sharedCount)
            .slice(0, 10);

        res.json(recommended);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching recommended groups" });
    }
});

module.exports = router;