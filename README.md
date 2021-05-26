A tool for importing and activating large number of clients in a (mostly) automated fashion

# General Usage

The following is a description of using this tool in a standard CNI environment.

## Step 1: Prepare environment

### Run `npm install` in this directory

### Deploy services
Create your environment.  At a minimum, you will need:
- `api`
- `target-service`
- `trading-api`
- `compliance-cloud-node`
- `integrations-service`
- `rebalance-service`
- `portfolio-comparator`
- `authentication-service`

`pronode` can be useful for verifying that the process was successful

### Create a .env file

Make a copy of the `.env.dist` file as `.env`, and plugin the missing values.  You'll need to choose the user who you want to import clients for. 
The `.dist` file assumes that you are port forwarding the `api` database to `localhost:3306`.

## Step 2: Prepare client list

### Requirements

- Network and database read access to the `api` database server (`riskalyze_adam` and cloud databases)

### Prepare an import list

We need a set of data of which clients to import from Compliance Cloud.  Two datasets are provided in this project by default,
they are `clients200.json` and `clients1000.json`. You also need to determine the custodian slug you wish

To prepare the actual imports list, you need to run the command `npm run format-clients`.  

This command has 3 required arguments
- `--client-list` - The path to the file which has the Compliance Cloud client ids to import
- `--integration-type` - The custodian slug for the Compliance Cloud custodian you wish to import the clients from
- `--output` - The path for a file to write the formatted client list to

For example, to format the clients in the `clients1000.json` list, for the `schwab` custodian, writing output to the 
`imports.json` file, the command is `npm run format-clients -- --client-list ./clients1000.json --integration-type schwab --output ./imports.json`

### Expand advisor permissions in Compliance Cloud Database

The Compliance Cloud seeded dev databases have a control in place to keep the total list of clients that a user normally has access to something smaller.  
We need to remove that restriction to get access to more clients.

Locate the Compliance Cloud DB instance that you need on the `api-mysql` server.  Each instance starts with `cloud_`, with a number indicating the cloud ID, one per custodian.
Here is a reference of custodian cloud DBs that exist in dev currently

| Custodian | Cloud DB |
| --------- | -------- |
| Pershing  | `cloud_110` |
| Schwab    | `cloud_111` |
| Fidelity  | `cloud_112` |
| LPL       | `cloud_125` |
| TDA       | `cloud_150` |

For whichever custodian you are using, go to the `pro_links` table for that cloud DB, and then set the `group_id` column to null for the link with token `55dcd6105dca583e38716521`.

## Step 3: Import clients

### Requirements
- network access to the `api` instance

### Run the `client-import` command
You should be able to now import the clients defined in the previous step by running this command: `npm run client-import --  --imports ./imports.json --output ./imported-clients.json`.

This will usually take a while.  You can check the `clients` table in `riskalyze_adam` to see the clients being added, and the `accounts` table in `riskalyze_core` to see that the accounts
are present.

> If you are seeing clients being imported, but no accounts are showing up for them, ensure that you have properly unset the `group_id` in the `pro_links` table for the cloud 
> you are working with.

## Step 4: Activate the accounts

### Requirements
- network access to the `api` instance
- network access to the `target-service` instance
- network access to the `api` database

### Run the `activate-accounts` command
Taking the list of imported clients from the previous step, you can now start the activation process by running `npm run activate-accounts -- --clients imported-clients.json`

This command will automatically create a new random model, and then activate those accounts using the new model as a target with any ineligible holdings locked.  This process will also take a while,
but when it completes you should be able to go to the trading inbox and see trade lists waiting for you!
