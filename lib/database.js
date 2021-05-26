const MySQL = require('mysql');

function getAdamDatabaseConnection() {
    return MySQL.createConnection({
        host: process.env.ADAM_DB_HOSTNAME,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        database: "riskalyze_adam"
    });
}

async function getAdvisor(email) {
    const adamConnection = getAdamDatabaseConnection()

    const query = `SELECT * FROM users WHERE email = '${email}'`;

    return promisifyQuery(query, adamConnection)
        .then(results => results[0]);
}

async function getAdvisorExApiLink(advisor, integrationType) {
    const adamConnection = getAdamDatabaseConnection();
    const query = `SELECT * FROM ex_api_links WHERE user_id = '${advisor.id}' AND service = '${integrationType}'`;

    return promisifyQuery(query, adamConnection)
        .then(results => results.map(row => ({ ...row, data: JSON.parse(row.data)}))[0]);
}

async function getRandomSecurities(count) {
    const adamConnection = MySQL.createConnection({
        host: process.env.ADAM_DB_HOSTNAME,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        database: "riskalyze_adam"
    });

    let query = `SELECT id as sec_id, FLOOR(RAND()*(10000-1000)+1000) as amount FROM pricedata_statistics
                    WHERE type in ('stock', 'fund', 'etf')
                    ORDER BY RAND()
                    LIMIT ${count}`;

    return promisifyQuery(query, adamConnection)
        .then(results => {
            return results.map(({sec_id, amount}) => ({sec_id, amount}))
        });
}

function promisifyQuery(query, connection) {
    return (new Promise((resolve, reject) => {
        connection.query(query,
            (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
    }))
        .finally(() => {
            connection.destroy();
        });
}

module.exports = {
    getAdvisor,
    getAdvisorExApiLink,
    getRandomSecurities
}