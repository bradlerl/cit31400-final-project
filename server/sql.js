const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: "127.0.0.1",
    port: 3306,
    user: "bradlerl",
    password: "Rach#0605",
    database: "linkUp",
});

module.exports = {
    query: async (sql, params) => {
        const [rows] = await pool.execute(sql, params);
        return rows;
    },
};