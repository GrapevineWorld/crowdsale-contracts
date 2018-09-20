require('babel-register')({
  ignore: /node_modules\/(?!openzeppelin-solidity\/test\/helpers)/
});
require('babel-polyfill');

require('dotenv').config();
let NonceTrackerSubprovider = require("web3-provider-engine/subproviders/nonce-tracker")

var HDWalletProvider;
var accessKey;
if (process.env.MNEMONIC) {
  HDWalletProvider = require('truffle-hdwallet-provider');
  accessKey = process.env.MNEMONIC;
} else {
  if (process.env.PRIVATE_KEY) {
    HDWalletProvider = require("truffle-hdwallet-provider-privkey");
    accessKey = process.env.PRIVATE_KEY;
  }
}

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
    },
    coverage: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 0xfffffffffff, 
      gasPrice: 0x0,
    },
    rinkeby: {
      provider: new HDWalletProvider(accessKey, 'https://rinkeby.infura.io/'+process.env.INFURA_API_KEY),
      network_id: "4", // official id of the rinkeby network
      gas: 6000000, // Gas limit used for deploys
      gasPrice: 2000000000, //2 Gwei
      from: process.env.OWNER
    },
    mainnet: {
      provider: new HDWalletProvider(accessKey, 'https://mainnet.infura.io/'+process.env.INFURA_API_KEY),
        /*var wallet = new HDWalletProvider(accessKey, 'https://mainnet.infura.io/'+process.env.INFURA_API_KEY);
        var nonceTracker = new NonceTrackerSubprovider();
        wallet.engine._providers.unshift(nonceTracker);
        nonceTracker.setEngine(wallet.engine);
        return wallet;
        },*/
      network_id: "1", // official id of the mainnet network
      gas: 3000000, // Gas limit used for deploys
      gasPrice: 50000000000, //2 Gwei
      from: process.env.OWNER
    },
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
