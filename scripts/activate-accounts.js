#!/usr/bin/env node

const program = require("commander");
const rp = require("request-promise");
const _ld = require("lodash");
const path = require("path");
const MySQL = require('mysql');

require("dotenv").load();

program
    .option('--clients <path>')
    .option('--session <token>')
    .option('--model <id>')
    .option('--model-version <id>')
    .parse(process.argv);


let activatedClients = 0;



if (program.clients) {
    (async () => {
        if (!program.session) {
            program.session = await login()
        }

        if (!program.model) {
            const model = await createRandomModel(program.session);
            program.model = model.id;
            program.modelVersion = model.model_version.id
        }

        const clients = require(path.join(process.cwd(), program.clients));

        activateClientsForAP(clients, program.model, program.modelVersion, program.session);

        console.error(activatedClients);
    })()
} else {
    console.error("required parameters: --clients,  --session, --model, --model-version");
    process.exit(1);
}



async function activateClientsForAP(clients, model, modelVersion, session) {
    for (let client of clients) {
        await activateClientForAP(client.id, model, modelVersion, session);
        activatedClients += 1;
    }
    console.error(`activated ${activatedClients} clients`);
}


async function activateClientForAP(clientId, model, modelVersion, session) {
    try {
        const client = await getClient(clientId);

        const portfolioId = _ld.get(client, "portfolios.0.id");

        const portfolio = await getPortfolio(portfolioId, session);

        //console.error(JSON.stringify(portfolio));

        const account = _ld.get(portfolio, "accounts.0");

        if (account.is_autopilot_enabled === 1) {
            await syncClient(clientId, session);
            return;
        }

        await buildTarget(account, portfolio.rsk_user_id, model, modelVersion);

        account.is_autopilot_enabled = 1;

        await updatePortfolio(portfolio, session);

        await syncClient(clientId, session);
    } catch (ex) {
        console.error(`Error activating client ${clientId}: ${ex.message} `);
    }

    //process.exit(0);
}

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

async function buildTarget(account, advisorId, model, modelVersion) {
    const target = {
        "portfolio_id": account.portfolio_id,
        "account_id": account.id,
        "advisor_id": advisorId,
        "autopilot_activated": false,
        "status": "active",
        "allocations": [
            {
                "sec_id": 1000000000,
                "percent": .02,
                "is_locked": false
            },
            {
                "sec_id": null,
                "model_id": model,
                "model_version_id": modelVersion,
                "percent": .98,
                "is_locked": false
            },
            {
                "sec_id": 0,
                "model_id": null,
                "model_version_id": null,
                "percent": 0,
                "is_locked": true
            }
        ],
        "suppress_trading_evaluation": true
    };

    await postTarget(target);
}

async function postTarget(target) {
    const opts = {
        method: "POST",
        uri: `${process.env.TARGET_SERVICE_URL}/v1/targets`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION
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

async function createRandomModel(session) {
    let randomAllocations = await generateModel(10);
    let model = await createModel(randomAllocations, session);

    while (!model.accounts[0].is_autopilot_eligible) {
        for (let allocation in model.accounts[0].allocations) {
            if (!allocation.eligibility[0].is_eligible) {
                const newSec = getRandomSecurities(1)[0];
                allocation.sec_id = newSec.sec_id;
            }
        }
        model = await updateModel(model, session);
    }

    return model;
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

async function getModel(modelId, session) {
    return getPortfolio(modelId, session)
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

async function getRandomSecurities(count) {
    const adamConnection = MySQL.createConnection({
        host     : process.env.ADAM_DB_HOSTNAME,
        user     : process.env.DB_USERNAME,
        password : process.env.DB_PASSWORD,
        port     : process.env.DB_PORT,
        database : "riskalyze_adam"
    });

    let query = `SELECT id as sec_id, FLOOR(RAND()*(10000-1000)+1000) as amount FROM pricedata_statistics
                    WHERE type in ('stock', 'fund', 'etf')
                    ORDER BY RAND()
                    LIMIT ${count}`;

    return (new Promise((resolve,reject) => {
        adamConnection.query(query,
            (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
    })).then(results => {
        return results.map(({sec_id, amount}) => ({sec_id, amount}))
    }).finally(() => {
        adamConnection.destroy();
    })
}

async function generateModel(count) {
    let securities = await getRandomSecurities(count);
    let total = _ld.sumBy(securities, 'amount');
    let cash = total / .95 * .05;
    securities.push({sec_id: 1000000000, amount: cash});
    return securities;
}
