#!/usr/bin/env node

const program = require("commander");
const rp = require("request-promise");
const _ld = require("lodash");
const path = require("path");

require("dotenv").load();

program
    .option('--clients <path>')
    .option('--session <token>')
    .option('--model <id>')
    .option('--model-version <id>')
    .parse(process.argv)


let activatedClients = 0;

if (program.clients && program.session && program.model && program.modelVersion) {
    const clients = require(path.join(process.cwd(), program.clients));

    activateClientsForAP(clients, program.model, program.modelVersion, program.session);

    console.error(activatedClients);
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
            return;
        }

        await buildTarget(account, portfolio.rsk_user_id, model, modelVersion);

        account.is_autopilot_enabled = 1;

        await updatePortfolio(portfolio, session);
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
        const msg = `Error getting portfolio ${portfolioId}: ${ex.message}`;
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
