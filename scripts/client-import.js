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


if (program.imports && program.session) {
    const imports = require(path.join(process.cwd(), program.imports));
    (async () => {
        let clients = await importClients(imports, program.session);

        if (program.output) {
            fs.writeFileSync(program.output, JSON.stringify(clients));
        } else {
            process.stdout.write(JSON.stringify(clients));
        }
    })()
} else {
    console.error("Required arguments: --imports,  --session ");
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

