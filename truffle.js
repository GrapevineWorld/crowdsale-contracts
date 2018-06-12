require('babel-register')({
  ignore: /node_modules\/(?!openzeppelin-solidity\/test\/helpers)/
});
require('babel-polyfill');
module.exports = {
  networks: {
    development: {
        host: "localhost",
        port: 8545,
        network_id: "*" // Match any network id
    },
    coverage: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 0xfffffffffff, 
      gasPrice: 0x0
    },
    rinkeby: {
      host: "localhost", // Connect to geth on the specified
      port: 8545,
      network_id: "4",
      gas: 6000000 // Gas limit used for deploys
    },
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
