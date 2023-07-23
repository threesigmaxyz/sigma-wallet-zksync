# ETH Global - Paris 2023

## Running
### Start environment:
Start the development environment via:

`make start`

This command will bootstrap three docker containers:
- zkSync server itself.
- Postgres (used as the database for zkSync).
- Local Geth node (used as L1 for zkSync).

### Deploy AA factory:
Deploy the AA factory via:

`make deploy-factory`

### Deploy smart account factory:
Deploy the smart account via:

`make deploy-account`