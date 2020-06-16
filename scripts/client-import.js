#!/usr/bin/env node

const rp = require("request-promise");
const program = require("commander");
const path = require("path");
const fs = require('fs');

require('dotenv').load()

program
    .option("--imports <path>")
    .option("-o, --output <path>")
    .option("--session <token>")
    .parse(process.argv);


if (program.imports) {
    const imports = require(path.join(process.cwd(), program.imports));
    (async () => {
        if (!program.session) {
            program.session = await login();
        }

        let clients = await importClients(imports, program.session);

        if (program.output) {
            fs.writeFileSync(program.output, JSON.stringify(clients));
        } else {
            process.stdout.write(JSON.stringify(clients));
        }
    })()
} else {
    console.error("Required arguments: --imports");
}


async function importClients(clients, session) {
    const results = [];

    for (let client of clients) {
        results.push(await importClient(client, session));
    }

    return results;
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

async function login() {
    const opts = {
        uri: `${process.env.CORE_API_URL}/v1/auth/login`,
        headers: {
            Authorization: process.env.CORE_API_AUTHORIZATION,
            "User-Agent": "Node"
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
