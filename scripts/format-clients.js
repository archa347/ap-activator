#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const program = require('commander');
const db = require('../lib/database');

require('dotenv').load()

program
    .option("--client-list <path>")
    .option("--database-id <id>")
    .option("--link-id <id>")
    .option("-o, --output <path>")
    .option("--integration-type <type>")
    .option("--advisor-id <id>")
    .parse(process.argv);

(async () => {
    if (!program.advisorId) {
        program.advisor = await db.getAdvisor(process.env.ADVISOR_EMAIL);
        program.advisorId = program.advisor.rsk_user_id;
    }

    if (program.integrationType && program.advisor && !program.linkId && !program.databaseId) {
        const exApiLink = await db.getAdvisorExApiLink(program.advisor, program.integrationType);
        program.linkId = exApiLink.id;
        program.databaseId = exApiLink.data.rep_id;
    }

    if (program.clientList && program.databaseId && program.integrationType && program.linkId && program.advisorId) {
        const clientList = require(path.join(process.cwd(), program.clientList));
        const output = clientList.map(client => {
            return {
                ...client,
                value: client.name,
                tag: "ACTIVE",
                fname: client.name.split(" ")[0],
                lname: client.name.split(" ")[1],
                advisor_id: program.advisorId,
                previous_review_date: new Date(),
                extras: {
                    contact_id: client.id,
                    database_id: program.databaseId,
                    ex_api_link_id: program.linkId,
                    type: program.integrationType,
                }
            };
        });

        if (program.output) {
            fs.writeFileSync(program.output, JSON.stringify(output));
        } else {
            process.stdout.write(JSON.stringify(output))
        }
    } else {
        console.log("required options: --client-list, --database-id, --integration-type, --advisor-id");
        process.exit(1);
    }
})();











