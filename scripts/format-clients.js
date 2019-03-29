#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const program = require('commander');

program
    .option("--client-list <path>")
    .option("--database-id <id>")
    .option("--link-id <id>")
    .option("-o, --output <path>")
    .option("--integration-type <type>")
    .option("--advisor-id <id>")
    .parse(process.argv);



if (program.clientList && program.databaseId && program.integrationType && program.linkId && program.advisorId) {
    const clientList = require(path.join(process.cwd(), program.clientList));
    const output = clientList.map( client => {
        return { ...client,
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









