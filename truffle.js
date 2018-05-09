require('babel-polyfill');
require('babel-register');
module.exports = {
  networks: {
    development: {
        host: "localhost",
        port: 7545,
        network_id: "*" // Match any network id
    },
    coverage: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 6000000
    },
    rinkeby: {
      host: "localhost", // Connect to geth on the specified
      port: 8545,
      network_id: "*",
      gas: 4612388 // Gas limit used for deploys
    }
  }
};
