# Smart Contracts for the Crowdsale

This repository contains the Solidity source code for the smart contarcts for the crowdsale and the ERC-20 GRAPE token. 
The development environment is based on [truffle].

## Documentation 

### Installation 
1. Open your favorite Terminal 
2. Install npm
3. Clone the project and install the dependencies
```sh
$ git clone https://github.com/GrapevineWorld/crowdsale-contracts.git
$ cd crowdsale-contracts
$ npm install
```

### Testing and Linting
The contracts can be tested and used using npm commands:

| Command | Description |
| ------ | ------ |
| ``` npm run migrate ``` | compiles and deploys the contracts |
| ``` npm run test ``` | tests the contracts using ganache-cli |
| ``` npm run coverage ``` | generates the coverage of the tests |
| ``` npm run console ``` | launches the truffle console |
| ``` npm run lint ``` | lints the js files |
| ``` npm run lint:fix ``` | lints and fixes the js files  |
| ``` npm run lint:sol ``` | lints the solidity files |
| ``` npm run lint:sol:fix ``` | lints and fixes the solidity files |
| ``` npm run lint:all ``` | lints the js and solidity files |
| ``` npm run lint:all:fix ``` | lints and fixes the js and solidity files |

### Testnet Testing
If you want to test on the testnet, do the following:
1. install geth
```sh
$ brew install geth
```
2. create at least 4 accounts 
```sh
$ geth account new
```
3. Get some test ether from https://faucet.rinkeby.io/
4. Run geth, unlocking the accounts:
```sh
$ geth --rinkeby --rpc --rpcport 8545 --rpcapi db,eth,net,web3,personal --unlock="0,1,2"
```
The accounts will be respectively: the owner of the contracts, the crowdsale wallet and a token buyer.

5. Run the following command to deploy contracts
```sh
$ npm run migrate:testnet
```

6. Run the following command to buy test grapes.
```sh
$ npm run console:testnet
```

*The contracts are audited by Venture Boost and the reports can be found under the audit directory. 

# Contributors

* Abdallah Miladi <abdallah.miladi@tiani-spirit.com> - [github.com/abmiladi](http://github.com/abmiladi)
* Massimiliano Masi <massimiliano.masi@tiani-spirit.com> - [github.com/mascanc](http://github.com/mascanc)


   [truffle]: <http://truffleframework.com/>
