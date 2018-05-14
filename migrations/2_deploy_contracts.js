const GrapevineCrowdsale = artifacts.require('./GrapevineCrowdsale.sol');
const GrapevineToken = artifacts.require('./GrapevineToken.sol');

module.exports = async function (deployer, network, accounts) {
  var openingTime;
  // owner of the crowdsale
  const owner = web3.eth.accounts[0];
  
  // wallet where the ehter will get deposited
  const wallet = web3.eth.accounts[1];
  
  // tokenWallet where the crowdsale tokens are located!
  const tokenWallet = web3.eth.accounts[2];
  
  const rate = new web3.BigNumber(1);
  const hardCap = 1000 * (10 ** 18);
  const softCap = 10 * (10 ** 18);

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

  await deployer.deploy(GrapevineToken, { from: owner });
  var grapevineToken = await GrapevineToken.deployed();
  await deployer.deploy(
    GrapevineCrowdsale,
    rate,
    wallet,
    GrapevineToken.address,
    openingTime,
    closingTime,
    softCap,
    hardCap,
    tokenWallet,
    { from: owner }
  );
  var grapevineCrowdsale = await GrapevineCrowdsale.deployed();
  const crowdsaleAddress = grapevineCrowdsale.address;
  const totalSupply = await grapevineToken.totalSupply({ from: owner });
  await grapevineToken.addAddressToWhitelist(tokenWallet, { from: owner });
  await grapevineToken.addAddressToWhitelist(crowdsaleAddress, { from: owner });
  await grapevineToken.transfer(tokenWallet, totalSupply, { from: owner });
  await grapevineToken.approve(crowdsaleAddress, totalSupply, { from: tokenWallet });
};
