const currentUserId = localStorage.getItem("userId");

const urlParams = new URLSearchParams(window.location.search);
const viewedUserId = urlParams.get("id");

const profileUserId = viewedUserId || currentUserId;

let userId = currentUserId;
let activeGroupId = null;

async function loadMatches(userId) {
    try {
        const res = await fetch(`/users/matches/${userId}`);
        const users = await res.json();

        displayMatches(users);
    } catch (err) {
        console.error("Error loading matches:", err);
    }
}

async function loadFriends(userId) {
    try {
        const res = await fetch(`/users/friends/${userId}/full`);
        const friends = await res.json();

        const list = document.getElementById("friendsList");

        if (!list) return;
        list.innerHTML = "";

        friends.forEach(friend => {
            const li = document.createElement("li");
            li.textContent = friend.name || friend.friend_id;
            list.appendChild(li);
        });
    } catch (err) {
        console.error("Friends load error:", err);
    }
}

async function loadFriendRequests(userId) {
    try {
        const res = await fetch(`/users/friend-requests/${userId}/full`);
        const requests = await res.json();

        const container = document.getElementById("friend-requests");
        if (!container) return;

        container.innerHTML = "<h3>Friend Requests</h3>";

        requests.forEach(req => {
            const card = document.createElement("div");
            card.className = "request-card";

            const name = document.createElement("p");
            name.textContent = req.name;

            const actions = document.createElement("div");
            actions.className = "request-actions";

            const acceptBtn = document.createElement("button");
            acceptBtn.textContent = "Accept";
            acceptBtn.className = "accept-btn";
            acceptBtn.addEventListener("click", () => {
                acceptRequest(req._id, userId);
            });

            const rejectBtn = document.createElement("button");
            rejectBtn.textContent = "Reject";
            rejectBtn.className = "reject-btn";
            rejectBtn.addEventListener("click", () => {
                rejectRequest(req._id, userId);
            });

            actions.appendChild(acceptBtn);
            actions.appendChild(rejectBtn);

            card.appendChild(name);
            card.appendChild(actions);

            container.appendChild(card);
        });
    } catch (err) {
        console.error("Requests load error:", err);
    }
}

async function acceptRequest(requestId, userId) {
    await fetch(`/users/friend-request/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            requester_id: requestId,
            receiver_id: userId
        })
    });

    loadFriendRequests(userId);
    loadFriends(userId);
}

async function rejectRequest(requestId, userId) {
    await fetch(`/users/friend-request/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            requester_id: requestId,
            receiver_id: userId
        })
    });

    loadFriendRequests(userId);
}

async function loadGroups() {
    try {
        const res = await fetch(`/groups/user/${userId}`);
        const groups = await res.json();

        console.log("Groups from server:", groups);

        const container = document.getElementById("groups-list");
        if (!container) return;

        container.innerHTML = "<h2>My Groups</h2>";

        groups.forEach(group => {
            const div = document.createElement("div");
            div.className = "group-card";

            const tags = Array.isArray(group.interest_tags)
                ? group.interest_tags
                : (group.interest_tags ? group.interest_tags.split(",") : []);

            tags.join(", ");

            div.innerHTML = `
                <h3>${group.name}</h3>
                <p>${group.description}</p>
                <p class="tags">Tags: ${tags.join(", ")}</p>

                <button onclick="openGroup('${group.id || group.group_id}')">Open Group</button>
            `;

            container.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading groups:", err);
    }
}

async function openGroup(groupId) {
    activeGroupId = groupId;

    document.getElementById("meetup-section").style.display = "block";
    document.getElementById("events").style.display = "block";

    document.getElementById("meetup-context").textContent = "Based on geographic center of all group members";

    loadEvents(groupId);
    loadGroupMeetupSpots(groupId);
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("groupForm");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("groupName").value;
            const description = document.getElementById("groupDesc").value;
            const tagsInput = document.getElementById("groupTags").value;

            const interest_tags = tagsInput
                ? tagsInput.split(",").map(t => t.trim())
                : [];

            try {
                await fetch("/groups", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name,
                        description,
                        creator_id: userId,
                        interest_tags
                    }),
                });

                alert("Group created!");
                loadGroups();
            } catch(err) {
                console.error("Error creating groups:", err);
            }
        });
    }
});

async function joinGroup(groupId) {
    try {
        await fetch(`/groups/${groupId}/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                user_id: userId
            }),
        });

        alert("Joined group!");
    } catch (err) {
        console.error("Error joining group:", err);
    }
}

let currentGroupId = null;

async function loadEvents(groupId) {
    currentGroupId = groupId;

    try {
        const res = await fetch(`/events/group/${groupId}`);
        const events = await res.json();

        const container = document.getElementById("events");
        container.innerHTML = "<h2>Group Events</h2>";

        events.forEach(event => {
            const div = document.createElement("div");
            div.className = "event-card";

            div.innerHTML = `
                <h3>${event.name}</h3>
                <p>Location: ${event.location}</p>
                <p>Date: ${event.event_time}</p>
                <p>${event.description}</p>
            `;

            container.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading events:", err);
    }
}

async function loadUserDropdown() {
    const res = await fetch("/users/all");
    const users = await res.json();

    const select = document.getElementById("userSelect");

    users.forEach(u => {
        const option = document.createElement("option");
        option.value = u._id;
        option.textContent = u.name;
        select.appendChild(option);
    });
}

async function loadGroupMeetupSpots(groupId) {
    try {
        if (!groupId) return;

        const res = await fetch(`/groups/${groupId}/meetup-spots`);

        if (!res.ok) {
            throw new Error(await res.text());
        }

        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        const container = document.getElementById("meetup-spots");
        container.innerHTML = "<p>Best midpoint-based locations for your group:</p>";

        if (!data.spots || data.spots.length === 0) {
            container.innerHTML = "<p>No meetup spots found nearby.</p>";
            return;
        }

        const title = document.createElement("p");
        title.textContent = "Best midpoint-based locations for your group:";
        container.appendChild(title);

        data.spots.forEach(place => {
            const div = document.createElement("div");
            div.className = "location-card";

            div.innerHTML = `
                <h4>${place.name}</h4>
                <p>Tags: ${(place.tags || []).join(", ")}</p>
                <p>Distance from center: ${(place.distance / 1000).toFixed(2)} km</p>
            `;

            container.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading meetup spots:", err);
    }
}

async function loadProfile(userId) {
    try {
        const res = await fetch(`/users/${userId}`);
        const user = await res.json();

        const nameEl = document.getElementById("name");
        if (nameEl) nameEl.textContent = user.name

        document.getElementById("age").textContent = "Age: " + user.age;
        document.getElementById("city").textContent = "City: " + (user.location?.city || "Unknown");
        document.getElementById("interests").textContent = "Interests: " + user.interests.join(", ");
        document.getElementById("bio").textContent = "Bio: " + (user.bio || "No bio yet");

        document.getElementById("editName").value = user.name || "";
        document.getElementById("editAge").value = user.age || "";
        document.getElementById("editCity").value = user.location?.city || "";
        document.getElementById("editInterests").value = (user.interests || []).join(", ");
        document.getElementById("editBio").value = user.bio || "";
    } catch (err) {
        console.error("Profile load error:", err);
    }
}

async function loadUserGroupsDropdown() {
    const res = await fetch(`/groups/user/${userId}`);
    const groups = await res.json();

    const select = document.getElementById("groupSelect");

    select.innerHTML = "";

    groups.forEach(g => {
        const option = document.createElement("option");
        option.value = g.id || g.group_id;
        option.textContent = g.name;
        select.appendChild(option);
    });
}

async function loadRecommendedGroups() {
    try {
        const res = await fetch(`/users/recommended/${userId}`);
        const groups = await res.json();

        if (!Array.isArray(groups)) {
            console.error("Groups is not an array:", groups);
            return;
        }

        const container = document.getElementById("recommended-groups");
        if (!container) return;

        if (!groups.length) {
            container.innerHTML += "<p>No matching groups found.</p>";
            return;
        }

        groups.forEach(group => {
            const div = document.createElement("div");
            div.className = "group-card";

            div.innerHTML = `
                <h3>${group.name}</h3>
                <p>${group.description}</p>
                <p>Matching interests: ${group.sharedCount}</p>
                <button onclick="joinGroup('${group.id}')">Join</button>
            `;

            container.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading recommended groups:", err);
    }
}

function displayMatches(users) {
    const container = document.getElementById("matches-container");

    container.innerHTML = "";

    if (users.length === 0) {
        container.innerHTML += "<p>No matches found.</p>";
        return;
    }

    users.forEach(user => {
        const card = document.createElement("div");
        card.classList.add("user-card");

        card.innerHTML = `
            <h4>${user.name}</h4>
            <p>Age: ${user.age}</p>
            <p>City: ${user.location?.city || "Unknown"}</p>
            <p>Shared Interests: ${user.sharedInterests}</p>
            <p>Distance: ${(user.distance / 1000).toFixed(1)} km</p>
            <button class="add-friend-btn" data-id="${user._id}">
                Add Friend
            </button>
            <button class="view-profile-btn" data-id="${user._id}">
                View Profile
            </button>
        `;

        container.appendChild(card);
    });

    addButtonListeners();
}

function addButtonListeners() {
    const addBtns = document.querySelectorAll(".add-friend-btn");

    addBtns.forEach(btn => {
        btn.addEventListener("click", async () => {
            const matchUserId = btn.dataset.id;

            try {
                await fetch("/users/friend-request", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        requester_id: currentUserId,
                        receiver_id: matchUserId,
                    }),
                });

                alert("Friend request sent!");
            } catch (err) {
                console.error("Error sending request:", err);
            }
        });
    });

    const profileBtns = document.querySelectorAll(".view-profile-btn");

    profileBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const matchId = btn.dataset.id;

            window.location.href = `profile.html?id=${matchId}`;
        });
    });
}

const createUserBtn = document.getElementById("createUserBtn");

if (createUserBtn) {
    createUserBtn.addEventListener("click", async () => {
        const name = document.getElementById("newName").value;
        const age = document.getElementById("newAge").value;
        const city = document.getElementById("newCity").value;
        const interestsInput = document.getElementById("newInterests").value;

        const interests = interestsInput
            ? interestsInput.split(",").map(i => i.trim())
            : [];
        
        try {
            const res = await fetch("/users/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    age,
                    city,
                    interests
                }),
            });

            const data = await res.json();

            localStorage.setItem("userId", data.userId);
            
            showApp();
            initApp();
        } catch (err) {
            console.error(err);
            document.getElementById("createUserMsg").textContent = 
                "Error creating user";
        }
    });
}

const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const suffix = document.getElementById("userIdInput").value;

        try {
            const res = await fetch(`/users/search/${suffix}`);
            const users = await res.json();

            if (!users.length) {
                document.getElementById("loginError").textContent = "No user found";
                return;
            }

            userId = users[0]._id;
            localStorage.setItem("userId", userId);

            showApp();
            initApp();
        } catch (err) {
            console.error(err);
            document.getElementById("loginError").textContent = "Login error";
        }
    });
}

const loadBtn = document.getElementById("loadMatchesBtn");
if (loadBtn) {
    loadBtn.addEventListener("click", () => {
        loadMatches(userId);
    });
}

function initApp () {
    loadProfile(profileUserId);
    loadFriends(userId);
    loadFriendRequests(userId);
    loadGroups();
    loadRecommendedGroups();
    loadUserGroupsDropdown();
}

function showApp() {
    const loginPanel = document.getElementById("loginPanel");
    const app = document.getElementById("app");
    const createUserSection = document.getElementById("create-user");

    if (loginPanel) loginPanel.style.display = "none";
    if (app) app.style.display = "block";
    if (createUserSection) createUserSection.style.display = "none";
}

function showLogin() {
    const loginPanel = document.getElementById("loginPanel");
    const app = document.getElementById("app");
    const createUserSection = document.getElementById("create-user");

    if (loginPanel) loginPanel.style.display = "block";
    if (app) app.style.display = "none";
    if (createUserSection) createUserSection.style.display = "block";
}

function logout() {
    localStorage.removeItem("userId");
    userId = null;

    const loginPanel = document.getElementById("loginPanel");
    const app = document.getElementById("app");

    if (loginPanel) loginPanel.style.display = "block";
    if (app) app.style.display = "none";

    location.reload();
}

function showProfileOnly() {
    document.getElementById("editProfileForm")?.style.setProperty("display", "none");
    document.getElementById("friendsList")?.parentElement?.style.setProperty("display", "none");
    document.getElementById("friend-requests")?.style.setProperty("display", "none");
}

function setUpEventForm() {
    const eventForm = document.getElementById("eventForm");

    if (!eventForm) return;

    eventForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const group_id = document.getElementById("groupSelect").value;
        const name = document.getElementById("eventName").value;
        const location = document.getElementById("eventLocation").value;
        const event_time = document.getElementById("eventDate").value;
        const description = document.getElementById("eventDesc").value;

        try {
            await fetch("/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    group_id,
                    name,
                    location,
                    event_time,
                    description
                }),
            });

            alert("Event created!");
            loadEvents(group_id);
        } catch (err) {
            console.error("Error creating event:", err);
        }
    });
}

const isViewingOtherProfile = !!viewedUserId;

document.addEventListener("DOMContentLoaded", () => {
    userId = localStorage.getItem("userId");

    if (userId) {
        showApp();

        if (isViewingOtherProfile) {
            loadProfile(profileUserId);
            showProfileOnly();
        } else {
            initApp();
        }
    } else {
        showLogin();
    }

    setUpEventForm();

    const form = document.getElementById("editProfileForm");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            try {
                await fetch(`/users/${currentUserId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: document.getElementById("editName").value,
                        age: document.getElementById("editAge").value,
                        city: document.getElementById("editCity").value,
                        interests: document.getElementById("editInterests").value,
                        bio: document.getElementById("editBio").value,
                    }),
                });

                alert("Profile updated!");

                loadProfile(currentUserId);
            } catch (err) {
                console.error("Error updating profile:", err);
            }
        });
    }
});