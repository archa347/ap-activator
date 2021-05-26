#!/usr/bin/env node

const program = require("commander");
const path = require("path");
const fs = require('fs');
const api = require("../lib/api")

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
            program.session = await api.login();
            console.error("logged in")
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
        results.push(await api.importClient(client, session));
    }

    return results;
}
