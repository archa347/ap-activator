const rp = require("request-promise");

async function getClient(clientId, session) {
    const opts = {
        method: "GET",
        uri: `${process.env.CORE_API_URL}/clients/${clientId}`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            rsesh: session
        },
        json: true
    };

    try {
        return await rp(opts);
    } catch (ex) {
        const msg = `Error getting client ${clientId}: ${ex.message}`;
        throw new Error(msg);
    }
}

async function importClient(client, session) {
    const opts = {
        uri: `${process.env.CORE_API_URL}/clients`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            rsesh: session
        },
        method: "POST",
        body: client,
        json: true
    };

    try {
        return await rp(opts);
    } catch (ex) {
        console.error(`Failed to import client ${client.id}:`, ex.statusCode, ex.message);
        return [client, ex]
    }

}

async function getPortfolio(portfolioId, session) {
    const opts = {
        method: "GET",
        uri: `${process.env.CORE_API_URL}/v1/portfolios/${portfolioId}`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            rsesh: session
        },
        json: true
    };

    try {
        return await rp(opts);
    } catch (ex) {
        const msg = `Error getting portfolio ${portfolioId}: ${ex.message}`;
        throw new Error(msg);
    }
}

async function updatePortfolio(portfolio, session) {
    const opts = {
        method: "PUT",
        uri: `${process.env.CORE_API_URL}/v1/portfolios/${portfolio.id}`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            rsesh: session
        },
        body: portfolio,
        json: true
    };

    try {
        return await rp(opts);
    } catch (ex) {
        const msg = `Error getting portfolio ${portfolio.id}: ${ex.message}`;
        throw new Error(msg);
    }
}

async function getModel(modelId, session) {
    return getPortfolio(modelId, session)
}

async function createModel(allocations, session) {
    const opts = {
        method: "POST",
        uri: `${process.env.CORE_API_URL}/v1/portfolios/`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            rsesh: session
        },
        body: {
            type: "MODEL",
            status: "active",
            name: new Date()
        },
        json: true
    };

    try {
        let resp = await rp(opts);
        let model = await getModel(resp.id, session);
        model.accounts = [
            {
                allocations: allocations
            }
        ]

        return updateModel(model, session)
    } catch (ex) {
        const msg = `Error creating model: ${ex.message}`;
        throw new Error(msg);
    }
}

async function updateModel(model, session) {
    return updatePortfolio(model, session)
}

async function syncClient(clientId, rsesh) {
    const opts = {
        method: "GET",
        uri: `${process.env.CORE_API_URL}/integration/sync_client_generic/${clientId}`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            rsesh: rsesh
        },
        json: true
    };

    try {
        return await rp(opts);
    } catch (ex) {
        const msg = `Error syncing client ${clientId} : ${ex.message}`;
        throw new Error(msg);
    }
}

async function login() {
    const opts = {
        uri: `${process.env.CORE_API_URL}/v1/auth/login`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            "User-Agent": "Node",
        },
        method: "POST",
        body: {
            email: process.env.ADVISOR_EMAIL,
            password: process.env.ADVISOR_PASSWORD,
            app_id: 1
        },
        json: true
    };

    try {
        let resp = await rp(opts);
        return resp.token;
    } catch (ex) {
        console.error(`unable to get session`, ex.statusCode, ex.message);
        throw ex;
    }
}

module.exports = { login, syncClient, importClient, updateModel, createModel, getPortfolio, getModel, getClient, updatePortfolio}