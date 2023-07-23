install:
	@yarn install

build: install
	@yarn hardhat compile

start:
	@./start.sh

stop:
	@./stop.sh

deploy-providers: build
	@yarn hardhat deploy-zksync --script deploy-providers.ts

deploy-factory: build
	@yarn hardhat deploy-zksync --script deploy-factory.ts

deploy-account: build
	@yarn hardhat deploy-zksync --script deploy-account.ts