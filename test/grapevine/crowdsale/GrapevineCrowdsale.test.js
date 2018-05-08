
import ether from '../helpers/ether';
import assertRevert from '../helpers/assertRevert';
import { advanceBlock } from '../helpers/advanceToBlock';
import { increaseTimeTo, duration } from '../helpers/increaseTime';
import latestTime from '../helpers/latestTime';

// seems to be a problem with babel!
// import assertRevert from 'openzeppelin-solidity/test/helpers/assertRevert';

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const GrapevineCrowdsale = artifacts.require('./GrapevineCrowdsale.sol');
const GrapevineToken = artifacts.require('./GrapevineToken.sol');

contract('GrapevineCrowdsale', accounts => {
  let grapevineCrowdsale;
  let grapevineToken;
  let openingTime;
  let closingTime;

  // owner of the token contract
  var _owner = accounts[0];
  var _buyer = accounts[1];
  var _wallet = accounts[2];
  var _tokenWallet = accounts[3];

  const _rate = new BigNumber(1);
  const _cap = ether(100);
  const _value = ether(1);
  const tokens = _rate.mul(_value);

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock();
  });

  beforeEach('setup contract for each test', async function () {
    grapevineToken = await GrapevineToken.new({ from: _owner });
    openingTime = latestTime() + duration.weeks(1);
    closingTime = openingTime + duration.weeks(4);

    grapevineCrowdsale = await GrapevineCrowdsale.new(
      _rate,
      _wallet,
      grapevineToken.address,
      openingTime,
      closingTime,
      _cap,
      _tokenWallet,
      { from: _owner });

    // it depends on the stratergy!
    const totalSupply = await grapevineToken.totalSupply();
    const crowdsaleAddress = grapevineCrowdsale.address;
    await grapevineToken.addAddressToWhitelist(_tokenWallet, { from: _owner });
    await grapevineToken.addAddressToWhitelist(crowdsaleAddress, { from: _owner });
    
    await grapevineToken.transfer(_tokenWallet, totalSupply, { from: _owner });
    await grapevineToken.approve(crowdsaleAddress, totalSupply, { from: _tokenWallet });
  });

  describe('buying grapes', function () {
    beforeEach(async function () {
      await increaseTimeTo(openingTime);
    });

    it('should remove funds from buyer', async function () {
      const walletBuyerBefore = web3.eth.getBalance(_buyer);
      const receipt = await grapevineCrowdsale.sendTransaction(
        { from: _buyer, to: grapevineCrowdsale.address, value: _value });

      const walletBuyerAfter = web3.eth.getBalance(_buyer);

      const gasUsed = receipt.receipt.gasUsed;
      const tx = await web3.eth.getTransaction(receipt.tx);
      const gasPrice = tx.gasPrice;
      const txCost = gasPrice.mul(gasUsed);
      const expectedBuyerWallet = walletBuyerBefore.minus(_value).minus(txCost);
      walletBuyerAfter.should.be.bignumber.equal(expectedBuyerWallet);
    });

    it('should forward funds to wallet', async function () {
      const walletOwnerBefore = web3.eth.getBalance(_wallet);
      await grapevineCrowdsale.sendTransaction(
        { from: _buyer, to: grapevineCrowdsale.address, value: _value });
      const walletOwnerAfter = web3.eth.getBalance(_wallet);
      const expectedOwnerWallet = walletOwnerBefore.add(_value);
      walletOwnerAfter.should.be.bignumber.equal(expectedOwnerWallet);
    });

    it('should assign tokens to sender', async function () {
      const balanceBuyerBefore = await grapevineToken.balanceOf(_buyer);

      await grapevineCrowdsale.sendTransaction(
        { from: _buyer, to: grapevineCrowdsale.address, value: _value });

      const balanceBuyerAfter = await grapevineToken.balanceOf(_buyer);
      balanceBuyerAfter.should.be.bignumber.equal(balanceBuyerBefore.add(tokens));
    });

    it('should log purchase', async function () {
      const receipt = await grapevineCrowdsale.sendTransaction(
        { from: _buyer, to: grapevineCrowdsale.address, value: _value });
      const event = receipt.logs.find(e => e.event === 'TokenPurchase');
      should.exist(event);
      event.args.purchaser.should.equal(_buyer);
      event.args.beneficiary.should.equal(_buyer);
      event.args.value.should.be.bignumber.equal(_value);
      event.args.amount.should.be.bignumber.equal(tokens);
    });

    it('reverts when trying to buy tokens when contract is paused paused', async function () {
      await grapevineCrowdsale.pause({ from: _owner });
      await assertRevert(grapevineCrowdsale.sendTransaction(
        { from: _buyer, to: grapevineCrowdsale.address, value: ether(10) }));
    });
  });
});
