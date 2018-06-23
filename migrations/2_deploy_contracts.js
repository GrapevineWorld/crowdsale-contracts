const SafeMath = artifacts.require('SafeMath.sol');
const GrapevineWhitelist = artifacts.require('GrapevineWhitelist.sol');
const GrapevineCrowdsale = artifacts.require('GrapevineCrowdsale.sol');
const GrapevineToken = artifacts.require('GrapevineToken.sol');
const TokenTimelockController = artifacts.require('TokenTimelockController.sol');

module.exports = async function (deployer, network, accounts) {
  var openingTime;
  // owner of the crowdsale
  const owner = web3.eth.accounts[0];
  
  // wallet where the ehter will get deposited
  const wallet = web3.eth.accounts[2];
  
  // authorisation signer
  const authorisationSigner = web3.eth.accounts[3];

  // early investor signer
  const earlyInvestorSigner = web3.eth.accounts[4];
  
  const saleTokenPercentage = 0.45;

  const rate = new web3.BigNumber(1);
  const hardCap = web3.toWei(10, 'ether');
  const softCap = web3.toWei(1, 'ether');

  if (network === 'rinkeby') {
    openingTime = web3.eth.getBlock('latest').timestamp + 300; // five minutes in the future
  } else {
    openingTime = web3.eth.getBlock('latest').timestamp + 60; // thirty seconds in the future
  }

  const closingTime = openingTime + 86400 * 30; // 30 days
  // const closingTime = openingTime + 600; // 10 mn

  console.log('openingTime: ' + openingTime);
  console.log('closingTime: ' + closingTime);

  console.log('Owner address: ' + owner);
  console.log('Wallet address: ' + wallet);
  let authorisedAddressesWhitelist;
  let earlyInvestorsAddressesWhitelist;
  return deployer.then(function () {
    // deploy SafeMath first
    return deployer.deploy(SafeMath);
  }).then(function () {
    // link SafeMath
    return deployer.link(
      SafeMath,
      [GrapevineToken, TokenTimelockController, GrapevineCrowdsale]
    );
  }).then(function () {
    return deployer.deploy(
      GrapevineToken,
      { from: owner }
    );
  }).then(function () {
    return deployer.deploy(
      TokenTimelockController,
      GrapevineToken.address,
      { from: owner }
    );
  }).then(function () {
    return deployer.deploy(
      GrapevineWhitelist,
      authorisationSigner,
      { from: owner }
    );
  }).then(function (instance) {
    authorisedAddressesWhitelist = instance;
  }).then(function () {
    return deployer.deploy(
      GrapevineWhitelist,
      earlyInvestorSigner,
      { from: owner }
    );
  }).then(function (instance) {
    earlyInvestorsAddressesWhitelist = instance;
  }).then(function () {
    return deployer.deploy(
      GrapevineCrowdsale,
      TokenTimelockController.address,
      authorisedAddressesWhitelist.address,
      earlyInvestorsAddressesWhitelist.address,
      rate,
      wallet,
      GrapevineToken.address,
      openingTime,
      closingTime,
      softCap,
      hardCap,
      { from: owner }
    );
  }).then(function () {
    return (TokenTimelockController.at(TokenTimelockController.address)).setCrowdsale(
      GrapevineCrowdsale.address,
      { from: owner }
    );
  }).then(function () {
    return authorisedAddressesWhitelist.setCrowdsale(
      GrapevineCrowdsale.address,
      { from: owner }
    );
  }).then(function () {
    return earlyInvestorsAddressesWhitelist.setCrowdsale(
      GrapevineCrowdsale.address,
      { from: owner }
    );
  }).then(function () {
    return (GrapevineToken.at(GrapevineToken.address)).transferOwnership(
      GrapevineCrowdsale.address,
      { from: owner }
    );
  }).then(function () {
    return (GrapevineToken.at(GrapevineToken.address)).totalSupply();
  }).then(function (totalSupply) {
    return (GrapevineToken.at(GrapevineToken.address)).transfer(
      GrapevineCrowdsale.address,
      totalSupply * saleTokenPercentage,
      { from: owner }
    );
  });
};
