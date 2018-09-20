var Migrations = artifacts.require('./Migrations.sol');

module.exports = function (deployer, network, accounts) {
  // owner of the contract
  let owner;
  if (network === 'rinkeby' || network === 'mainnet') {
    owner = process.env.OWNER;
  } else {
    owner = accounts[0];
  }
  deployer.deploy(Migrations, { from: owner });
};
