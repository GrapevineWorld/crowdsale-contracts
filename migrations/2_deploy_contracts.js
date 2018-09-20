const SafeMath = artifacts.require('SafeMath.sol');
const GrapevineWhitelist = artifacts.require('GrapevineWhitelist.sol');
const GrapevineCrowdsale = artifacts.require('GrapevineCrowdsale.sol');
const GrapevineToken = artifacts.require('GrapevineToken.sol');
const TokenTimelockController = artifacts.require('TokenTimelockController.sol');

module.exports = async function (deployer, network, accounts) {

  var openingTime;
  // owner of the crowdsale
  var owner;
  
  // wallet where the ehter will get deposited
  var wallet;
  
  // authorisation signer
  var authorisationSigner;

  // early investor signer
  var earlyInvestorSigner;
  
  const saleTokenPercentage = 0.45;

  const rate = new web3.BigNumber(4667);
  const hardCap = web3.toWei(62044.6948920123, 'ether');
  const softCap = web3.toWei(6156.0314236476, 'ether');
  
  //let openingDate = new Date(2018, 5, 14, 14, 00, 00);  
  let openingDate = new Date();
  const now = Math.floor(new Date().getTime()/1000);
  if (network === 'rinkeby' || network === 'mainnet') {
    console.log('rinkeby or rinkeby');
    openingTime = now + 1800; // 30mn in the future
    owner = process.env.OWNER;
    wallet = process.env.WALLET;
    authorisationSigner = process.env.AUTHORISATION_SIGNER;
    earlyInvestorSigner = process.env.EARLY_INVESTOR_SIGNER;
  } else {
    console.log('ganache');

    openingTime = now + 60; // one minute in the future
    owner = accounts[0];
    wallet = accounts[1];
    authorisationSigner = accounts[2];
    earlyInvestorSigner = accounts[3];
  }


  const closingTime = openingTime + 1800;

  //official values
  //openingTime = 1530849600;
  //const closingTime = 1534334400;

  console.log('openingTime: ' + openingTime);
  console.log('closingTime: ' + closingTime);

  console.log('Owner address: ' + owner);
  console.log('Wallet address: ' + wallet);
  let authorisedAddressesWhitelist;
  let earlyInvestorsAddressesWhitelist;
  return deployer.then(function () {
    // deploy SafeMath first
    return deployer.deploy(SafeMath, { from: owner });
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
