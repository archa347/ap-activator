#!/usr/bin/env node

const program = require("commander");
const _ld = require("lodash");
const path = require("path");
const db = require("../lib/database");
const api = require("../lib/api");
const targets = require("../lib/targets");
const sleep = require("../lib/sleep");

require("dotenv").load();

program
    .option('--clients <path>')
    .option('--session <token>')
    .option('--model <id>')
    .option('--model-version <id>')
    .option('--threads <count>',"Number of concurrent activations", 50)
    .parse(process.argv);


let activatedClients = 0;
let currentThreads = 0;

if (program.clients) {
    (async () => {
        if (!program.session) {
            program.session = await api.login()
        }

        if (!program.model) {
            const model = await createRandomModel(program.session);
            program.model = model.id;
            program.modelVersion = model.model_version.id
        }

        const clients = require(path.join(process.cwd(), program.clients));

        await activateClientsForAP(clients, program.model, program.modelVersion, program.session);

        console.error(activatedClients);
    })()
} else {
    console.error("required parameters: --clients,  --session, --model, --model-version");
    process.exit(1);
}



async function activateClientsForAP(clients, model, modelVersion, session) {
    for (let client of clients) {
        if (client.id) {
            while (currentThreads >= program.threads) {
                console.error(`thread status: ${currentThreads} / ${program.threads}`)
                console.error("hit max threads, sleeping")
                await sleep(5000)
            }
            currentThreads++;
            activateClientForAP(client.id, model, modelVersion, session)
                .then(() => {
                    activatedClients++;
                    console.error(`activated ${activatedClients} / ${clients.length}`);
                })
                .finally(() => currentThreads--);
        }
    }

    while (currentThreads > 0) {
        await sleep(500);
    }
    console.error(`activated ${activatedClients} clients`);
}


async function activateClientForAP(clientId, model, modelVersion, session) {
    try {
        const client = await api.getClient(clientId);

        const portfolioId = _ld.get(client, "portfolios.0.id");

        const portfolio = await api.getPortfolio(portfolioId, session);

        const account = _ld.get(portfolio, "accounts.0");

        if (account.is_autopilot_enabled === 1) {
            await api.syncClient(clientId, session);
            return;
        }

        await buildTarget(account, portfolio.rsk_user_id, model, modelVersion);

        account.is_autopilot_enabled = 1;

        await api.updatePortfolio(portfolio, session);

        await api.syncClient(clientId, session);
    } catch (ex) {
        console.error(`Error activating client ${clientId}: ${ex.message} `);
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

    await targets.postTarget(target);
}

async function createRandomModel(session) {
    let randomAllocations = await generateModel(10);
    let model = await api.createModel(randomAllocations, session);

    while (!model.accounts[0].is_autopilot_eligible) {
        for (let allocation in model.accounts[0].allocations) {
            if (!allocation.eligibility[0].is_eligible) {
                const newSec = await db.getRandomSecurities(1)[0];
                allocation.sec_id = newSec.sec_id;
            }
        }
        model = await api.updateModel(model, session);
    }

    return model;
}

async function generateModel(count) {
    let securities = await db.getRandomSecurities(count);
    let total = _ld.sumBy(securities, 'amount');
    let cash = total / .95 * .05;
    securities.push({sec_id: 1000000000, amount: cash});
    return securities;
}
