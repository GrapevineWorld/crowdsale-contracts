module.exports = function (deployer, network, accounts) {
  // owner of the contract
  var owner = web3.eth.accounts[0];
  
  deployer.deploy(Migrations, { from: owner });
};
