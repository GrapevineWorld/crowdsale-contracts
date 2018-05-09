const GrapevineCrowdsale = artifacts.require('./GrapevineCrowdsale.sol');
const GrapevineToken = artifacts.require('./GrapevineToken.sol');

module.exports = function (deployer, network, accounts) {
  var openingTime;
  // owner of the crowdsale
  const owner = web3.eth.accounts[0];
  
  // wallet where the ehter will get deposited
  const wallet = web3.eth.accounts[1];
  
  // tokenWallet where the crowdsale tokens are located!
  const tokenWallet = web3.eth.accounts[2];
  
  const rate = new web3.BigNumber(1);
  const cap = 1000 * (10 ** 18);
  var grapevineTokenInstance;
  var grapevineCrowdsaleInstance;
  let totalSupply;
  if (network === 'rinkeby') {
    openingTime = web3.eth.getBlock('latest').timestamp + 300; // five minutes in the future
  } else {
    openingTime = web3.eth.getBlock('latest').timestamp + 60; // one minute in the future
  }

  // const closingTime = openingTime + 86400 * 20; // 20 days
  const closingTime = openingTime + 86400; // 1 day

  console.log('openingTime: ' + openingTime);
  console.log('closingTime: ' + closingTime);

  console.log('Owner address: ' + owner);
  console.log('Wallet address: ' + wallet);

  return deployer.then(() => {
    return deployer.deploy(GrapevineToken, { from: owner });
  })
    .then(() => {
      return deployer.deploy(
        GrapevineCrowdsale,
        rate,
        wallet,
        GrapevineToken.address,
        openingTime,
        closingTime,
        cap,
        tokenWallet,
        { from: owner }
      )
        .then(() => GrapevineCrowdsale.deployed().then(inst => { grapevineCrowdsaleInstance = inst; }))
        .then(() => grapevineCrowdsaleInstance.token().then(
          addr => { grapevineTokenInstance = GrapevineToken.at(addr); }))
        .then(() => grapevineTokenInstance.totalSupply({ from: owner }).then(x => { totalSupply = x; }))
        .then(() => grapevineTokenInstance.addAddressToWhitelist(tokenWallet, { from: owner }))
        .then(() => grapevineTokenInstance.addAddressToWhitelist(grapevineCrowdsaleInstance.address, { from: owner }))
        .then(() => grapevineTokenInstance.transfer(tokenWallet, totalSupply, { from: owner }))
        .then(() => grapevineTokenInstance.approve(
          grapevineCrowdsaleInstance.address,
          totalSupply,
          { from: tokenWallet }));
    });
};
