const rp = require("request-promise");

async function postTarget(target) {
    const opts = {
        method: "POST",
        uri: `${process.env.TARGET_SERVICE_URL}/v1/targets`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            "User-Agent": "PostmanRuntime/7.28.2"
        },
        body: target,
        json: true
    };

    try {
        return await rp(opts);
    } catch (ex) {
        const msg = `Error creating target for ${target.portfolio_id}:${target.account_id} : ${ex.message}`;
        throw new Error(msg);
    }
}

module.exports = { postTarget }