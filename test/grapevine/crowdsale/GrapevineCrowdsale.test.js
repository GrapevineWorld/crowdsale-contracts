import ether from 'openzeppelin-solidity/test/helpers/ether';
import assertRevert from 'openzeppelin-solidity/test/helpers/assertRevert';
import { advanceBlock } from 'openzeppelin-solidity/test/helpers/advanceToBlock';
import { increaseTimeTo, duration } from 'openzeppelin-solidity/test/helpers/increaseTime';
import latestTime from 'openzeppelin-solidity/test/helpers/latestTime';
import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert';

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const GrapevineCrowdsale = artifacts.require('./GrapevineCrowdsale.sol');
const GrapevineToken = artifacts.require('./GrapevineToken.sol');
const TokenTimelockController = artifacts.require('./TokenTimelockController.sol');

contract('GrapevineCrowdsale', accounts => {
  let grapevineCrowdsale;
  let grapevineToken;
  let tokenTimelockController;
  let openingTime;
  let closingTime;
  let afterClosingTime;
  let tokenClaimingTime;
  let totalSupply;
  let totalCrowdsaleSupply;

  // owner of the token contract
  var _owner = accounts[0];
  var _buyer = accounts[1];
  var _buyer2 = accounts[2];
  var _wallet = accounts[3];

  const _rate = new BigNumber(1);
  const _hardCap = new BigNumber(web3.toWei('5', 'gwei'));
  const _lessThanHardCap = new BigNumber(web3.toWei('4', 'gwei'));
  const _softCap = new BigNumber(web3.toWei('3', 'gwei'));
  const _lessThanSoftCap = new BigNumber(web3.toWei('1', 'gwei'));

  const _value = new BigNumber(web3.toWei('1', 'gwei'));
  const _value2 = new BigNumber(web3.toWei('2', 'gwei'));
  const tokens = _rate.mul(_value);
  const tokens2 = _rate.mul(_value2);
  const lessThanHardCapTokens = _rate.mul(_lessThanHardCap);

  before(async function () {
    // Advance to the next block to correctly read time in the solidity 'now' function interpreted by ganache
    await advanceBlock();
  });

  beforeEach('setup contract for each test', async function () {
    openingTime = latestTime() + duration.weeks(1);
    closingTime = openingTime + duration.days(30);
    afterClosingTime = closingTime + duration.seconds(1);
    tokenClaimingTime = afterClosingTime + duration.days(5);

    grapevineToken = await GrapevineToken.new({ from: _owner });
    tokenTimelockController = await TokenTimelockController.new(grapevineToken.address, { from: _owner });
    grapevineCrowdsale = await GrapevineCrowdsale.new(
      tokenTimelockController.address,
      _rate,
      _wallet,
      grapevineToken.address,
      openingTime,
      closingTime,
      _softCap,
      _hardCap,
      { from: _owner });

    // it depends on the stratergy!
    totalSupply = await grapevineToken.totalSupply({ from: _owner });
    totalCrowdsaleSupply = new BigNumber(totalSupply * 0.45);
    const crowdsaleAddress = grapevineCrowdsale.address;
    await tokenTimelockController.setCrowdsale(crowdsaleAddress, { from: _owner });
    await grapevineToken.transfer(grapevineCrowdsale.address, totalCrowdsaleSupply, { from: _owner });
    await grapevineToken.transferOwnership(crowdsaleAddress, { from: _owner });
  });

  describe('buying grapes', function () {
    beforeEach(async function () {
      await increaseTimeTo(openingTime);
    });

    it('should remove funds from buyer', async function () {
      const walletBuyerBefore = web3.eth.getBalance(_buyer);
      const receipt = await grapevineCrowdsale.sendTransaction(
        { from: _buyer, value: _value });

      const walletBuyerAfter = web3.eth.getBalance(_buyer);

      const gasUsed = receipt.receipt.gasUsed;
      const tx = await web3.eth.getTransaction(receipt.tx);
      const gasPrice = tx.gasPrice;
      const txCost = gasPrice.mul(gasUsed);
      const expectedBuyerWallet = walletBuyerBefore.minus(_value).minus(txCost);
      walletBuyerAfter.should.be.bignumber.equal(expectedBuyerWallet);
    });

    it('should log purchase', async function () {
      const receipt = await grapevineCrowdsale.sendTransaction(
        { from: _buyer, value: _value });
      const event = receipt.logs.find(e => e.event === 'TokenPurchase');
      should.exist(event);
      event.args.purchaser.should.equal(_buyer);
      event.args.beneficiary.should.equal(_buyer);
      event.args.value.should.be.bignumber.equal(_value);
      event.args.amount.should.be.bignumber.equal(tokens);
    });

    it('reverts when trying to buy tokens when contract is paused', async function () {
      await grapevineCrowdsale.pause({ from: _owner });
      await assertRevert(grapevineCrowdsale.sendTransaction(
        { from: _buyer, value: ether(1) }));
    });

    it('should not immediately assign tokens to beneficiary', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      const balance = await grapevineToken.balanceOf(_buyer);
      balance.should.be.bignumber.equal(0);
    });

    it('should not allow beneficiaries to withdraw tokens before delivery time', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _softCap });
      await increaseTimeTo(closingTime);
      await grapevineCrowdsale.withdrawTokens({ from: _buyer }).should.be.rejectedWith(EVMRevert);
    });

    it('should allow beneficiaries to withdraw tokens after crowdsale ends', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _lessThanHardCap });
      await increaseTimeTo(tokenClaimingTime);
      await grapevineCrowdsale.withdrawTokens({ from: _buyer }).should.be.fulfilled;
    });

    it('should not allow beneficiaries to withdraw tokens if softcap was not reached', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _lessThanSoftCap });
      await increaseTimeTo(tokenClaimingTime);
      await grapevineCrowdsale.withdrawTokens({ from: _buyer }).should.be.rejectedWith(EVMRevert);
    });

    it('should return the amount of tokens bought', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _lessThanHardCap });
      await increaseTimeTo(tokenClaimingTime);
      await grapevineCrowdsale.withdrawTokens({ from: _buyer });
      const balance = await grapevineToken.balanceOf(_buyer);
      balance.should.be.bignumber.equal(lessThanHardCapTokens);
    });

    it('should have enough tokens to send tokens to ALL investors', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      await grapevineCrowdsale.sendTransaction({ from: _buyer2, value: _value2 });
      await increaseTimeTo(tokenClaimingTime);
      await grapevineCrowdsale.finalize({ from: _owner });
      await grapevineCrowdsale.withdrawTokens({ from: _buyer });
      let balance = await grapevineToken.balanceOf(_buyer);
      balance.should.be.bignumber.equal(tokens);
      await grapevineCrowdsale.withdrawTokens({ from: _buyer2 });
      balance = await grapevineToken.balanceOf(_buyer2);
      balance.should.be.bignumber.equal(tokens2);
    });

    it('reverts if crowdsale has no sufficient tokens for buyer', async function () {
      let openingTimeWithNoSufficientTokens = latestTime() + duration.weeks(1);
      let closingTimeWithNoSufficientTokens = openingTime + duration.days(30);
      let grapevineCrowdsaleWithNoSufficientTokens = await GrapevineCrowdsale.new(
        tokenTimelockController.address,
        _rate,
        _wallet,
        grapevineToken.address,
        openingTimeWithNoSufficientTokens,
        closingTimeWithNoSufficientTokens,
        _softCap,
        _hardCap,
        { from: _owner }
      );
      await increaseTimeTo(openingTimeWithNoSufficientTokens);
      await grapevineToken.transfer(grapevineCrowdsaleWithNoSufficientTokens.address, tokens, { from: _owner });
      await assertRevert(grapevineCrowdsaleWithNoSufficientTokens.sendTransaction({ from: _buyer, value: _value }));
    });

    it('does not burn if crowdsale has exactly the sufficient tokens for buyer', async function () {
      let grapevineTokenWithExactlyTheSufficientTokens = await GrapevineToken.new({ from: _owner });
      let tokenTimelockControllerWithExactlyTheSufficientTokens = await TokenTimelockController.new(
        grapevineTokenWithExactlyTheSufficientTokens.address,
        { from: _owner }
      );

      let openingTimeWithExactlyTheSufficientTokens = latestTime() + duration.weeks(1);

      let closingTimeWithExactlyTheSufficientTokens = openingTimeWithExactlyTheSufficientTokens + duration.days(30);

      let afterClosingWithExactlyTheSufficientTokens = closingTimeWithExactlyTheSufficientTokens + duration.seconds(1);

      let grapevineCrowdsaleWithExactlyTheSufficientTokens = await GrapevineCrowdsale.new(
        tokenTimelockControllerWithExactlyTheSufficientTokens.address,
        _rate,
        _wallet,
        grapevineTokenWithExactlyTheSufficientTokens.address,
        openingTimeWithExactlyTheSufficientTokens,
        closingTimeWithExactlyTheSufficientTokens,
        _softCap,
        _hardCap,
        { from: _owner }
      );

      await tokenTimelockControllerWithExactlyTheSufficientTokens.setCrowdsale(
        grapevineCrowdsaleWithExactlyTheSufficientTokens.address,
        { from: _owner }
      );

      const softCapTokens = _softCap.mul(_rate).mul(1.15);

      await grapevineTokenWithExactlyTheSufficientTokens.transferOwnership(
        grapevineCrowdsaleWithExactlyTheSufficientTokens.address,
        { from: _owner }
      );

      await grapevineTokenWithExactlyTheSufficientTokens.transfer(
        grapevineCrowdsaleWithExactlyTheSufficientTokens.address,
        softCapTokens,
        { from: _owner }
      );

      await increaseTimeTo(openingTimeWithExactlyTheSufficientTokens);

      await grapevineCrowdsaleWithExactlyTheSufficientTokens.sendTransaction({
        from: _buyer,
        value: _softCap,
      });

      await increaseTimeTo(afterClosingWithExactlyTheSufficientTokens);
      await grapevineCrowdsaleWithExactlyTheSufficientTokens.finalize({ from: _owner });

      // no tokens should be burnt.
      let currentTotalSupply = await grapevineTokenWithExactlyTheSufficientTokens.totalSupply();
      currentTotalSupply.should.bignumber.equal(totalSupply);
    });
  });

  describe('managing the bonus', function () {
    beforeEach(async function () {
      await increaseTimeTo(openingTime);
    });

    it('should create 30% tokenTimelock contract if present in the whitelist', async function () {
      await grapevineCrowdsale.addAddressToWhitelist(_buyer, { from: _owner });
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let bonus = tokens.mul(0.30);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      // only the bonus is substracted
      let remainingBalance = totalCrowdsaleSupply.minus(bonus);
      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      let count = await tokenTimelockController.getTokenTimelockCount(_buyer);
      let tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer, count.sub(1));
      let tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      bonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus.should.bignumber.equal(tokenTimelockDetails[0]);
    });

    it('should create 30% tokenTimelock contract to ALL whitelisted addresses', async function () {
      await grapevineCrowdsale.addAddressesToWhitelist([_buyer, _buyer2], { from: _owner });
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let bonus = tokens.mul(0.30);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      let remainingBalance = totalCrowdsaleSupply.minus(bonus);
      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      let count = await tokenTimelockController.getTokenTimelockCount(_buyer);
      let tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer, count.sub(1));
      let tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      bonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus.should.bignumber.equal(tokenTimelockDetails[0]);

      await grapevineCrowdsale.sendTransaction({ from: _buyer2, value: _value2 });
      let bonus2 = tokens2.mul(0.30);
      remainingBalance = remainingBalance.minus(bonus2);
      tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      count = await tokenTimelockController.getTokenTimelockCount(_buyer2);
      tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer2, count.sub(1));
      tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      let totalBonus = bonus.add(bonus2);
      totalBonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus2.should.bignumber.equal(tokenTimelockDetails[0]);
    });

    it('should create 15% tokenTimelock contract if added and removed from the whitelist', async function () {
      await grapevineCrowdsale.addAddressToWhitelist(_buyer, { from: _owner });
      await grapevineCrowdsale.removeAddressFromWhitelist(_buyer, { from: _owner });
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let bonus = tokens.mul(0.15);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      let remainingBalance = totalCrowdsaleSupply.minus(bonus);
      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      let count = await tokenTimelockController.getTokenTimelockCount(_buyer);
      let tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer, count.sub(1));
      let tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      bonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus.should.bignumber.equal(tokenTimelockDetails[0]);
    });

    it('should create 15% contract if softcap is reached, even if investor is whitelisted', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer2, value: _softCap });
      let buyer2Tokens = _softCap.mul(_rate);
      let buyer2Bonus = buyer2Tokens.mul(0.15);
      let remainingBalance = totalCrowdsaleSupply.minus(buyer2Bonus);
      await grapevineCrowdsale.addAddressToWhitelist(_buyer, { from: _owner });
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let bonus = tokens.mul(0.15);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      remainingBalance = remainingBalance.minus(bonus);

      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      let count = await tokenTimelockController.getTokenTimelockCount(_buyer);
      let tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer, count.sub(1));
      let tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      let totalBonus = buyer2Bonus.add(bonus);
      totalBonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus.should.bignumber.equal(tokenTimelockDetails[0]);
    });

    it('should create 15% tokenTimelock contract the first 8 days', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let bonus = tokens.mul(0.15);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      let remainingBalance = totalCrowdsaleSupply.minus(bonus);
      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      let count = await tokenTimelockController.getTokenTimelockCount(_buyer);
      let tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer, count.sub(1));
      let tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      bonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus.should.bignumber.equal(tokenTimelockDetails[0]);
    });

    it('should create 10% tokenTimelock contract the next 8 days', async function () {
      await increaseTimeTo(new BigNumber(openingTime + duration.days(8)).add(1));

      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let bonus = tokens.mul(0.10);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      let remainingBalance = totalCrowdsaleSupply.minus(bonus);
      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      let count = await tokenTimelockController.getTokenTimelockCount(_buyer);
      let tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer, count.sub(1));
      let tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      bonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus.should.bignumber.equal(tokenTimelockDetails[0]);
    });

    it('should create 8% tokenTimelock contract the next 8 days', async function () {
      await increaseTimeTo(new BigNumber(openingTime + duration.days(16)).add(1));

      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let bonus = tokens.mul(0.08);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      let remainingBalance = totalCrowdsaleSupply.minus(bonus);
      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      let count = await tokenTimelockController.getTokenTimelockCount(_buyer);
      let tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer, count.sub(1));
      let tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      bonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus.should.bignumber.equal(tokenTimelockDetails[0]);
    });

    it('should create 6% tokenTimelock contract the next 6 days', async function () {
      await increaseTimeTo(new BigNumber(openingTime + duration.days(24)).add(1));

      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let bonus = tokens.mul(0.06);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      let remainingBalance = totalCrowdsaleSupply.minus(bonus);
      tokensRemaining.should.be.bignumber.equal(remainingBalance);

      let count = await tokenTimelockController.getTokenTimelockCount(_buyer);
      let tokenTimelockDetails = await tokenTimelockController.getTokenTimelockDetails(_buyer, count.sub(1));
      let tokenTimelockTokensRemaining = await grapevineToken.balanceOf(tokenTimelockController.address);
      bonus.should.bignumber.equal(tokenTimelockTokensRemaining);
      bonus.should.bignumber.equal(tokenTimelockDetails[0]);
    });
  });

  describe('finalization handling', function () {
    beforeEach(async function () {
      await increaseTimeTo(openingTime);
    });

    it('should not burn the remaining tokens after finalization if softcap is not reached', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _lessThanSoftCap });
      await increaseTimeTo(afterClosingTime);
      await grapevineCrowdsale.finalize({ from: _owner });
      let currentTotalSupply = await grapevineToken.totalSupply();
      currentTotalSupply.should.bignumber.equal(totalSupply);
    });

    it('should burn the remaining tokens after finalization', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _lessThanHardCap });
      await increaseTimeTo(afterClosingTime);
      let tokensRemaining = await grapevineToken.balanceOf(grapevineCrowdsale.address);
      let raised = await grapevineCrowdsale.weiRaised();
      let purchasedTokens = raised.mul(_rate);
      let afterSaleTokens = tokensRemaining.sub(purchasedTokens);
      await grapevineCrowdsale.finalize({ from: _owner });
      let currentTotalSupply = await grapevineToken.totalSupply();
      currentTotalSupply.should.bignumber.equal(totalSupply.sub(afterSaleTokens));
    });

    it('should transfer the ownership of the token back to the owner after finalization', async function () {
      await grapevineCrowdsale.sendTransaction({ from: _buyer, value: _value });
      let ownerBefore = await grapevineToken.owner();
      ownerBefore.should.equal(grapevineCrowdsale.address);
      await increaseTimeTo(afterClosingTime);
      await grapevineCrowdsale.finalize({ from: _owner });
      let ownerAfter = await grapevineToken.owner();
      ownerAfter.should.equal(_owner);
    });
  });
  
  describe('softCap handling', function () {
    it('should deny refunds before end', async function () {
      await grapevineCrowdsale.claimRefund({ from: _buyer }).should.be.rejectedWith(EVMRevert);
      await increaseTimeTo(openingTime);
      await grapevineCrowdsale.claimRefund({ from: _buyer }).should.be.rejectedWith(EVMRevert);
    });

    it('should deny refunds after end if goal was reached', async function () {
      await increaseTimeTo(openingTime);
      await grapevineCrowdsale.sendTransaction({ value: _softCap, from: _buyer });
      await increaseTimeTo(afterClosingTime);
      await grapevineCrowdsale.claimRefund({ from: _buyer }).should.be.rejectedWith(EVMRevert);
    });

    it('should allow refunds after end if goal was not reached', async function () {
      await increaseTimeTo(openingTime);
      await grapevineCrowdsale.sendTransaction({ value: _lessThanSoftCap, from: _buyer });
      await increaseTimeTo(afterClosingTime);
      await grapevineCrowdsale.finalize({ from: _owner });
      const pre = web3.eth.getBalance(_buyer);
      await grapevineCrowdsale.claimRefund({ from: _buyer, gasPrice: 0 })
        .should.be.fulfilled;
      const post = web3.eth.getBalance(_buyer);
      post.minus(pre).should.be.bignumber.equal(_lessThanSoftCap);
    });

    it('should forward funds to wallet after end if goal was reached', async function () {
      await increaseTimeTo(openingTime);
      await grapevineCrowdsale.sendTransaction({ value: _softCap, from: _buyer });
      await increaseTimeTo(afterClosingTime);
      const pre = web3.eth.getBalance(_wallet);
      await grapevineCrowdsale.finalize({ from: _owner });
      const post = web3.eth.getBalance(_wallet);
      post.minus(pre).should.be.bignumber.equal(_softCap);
    });
  });

  describe('hardCap handling', function () {
    beforeEach(async function () {
      await increaseTimeTo(openingTime);
    });

    describe('accepting payments', function () {
      it('should accept payments within cap', async function () {
        let amount = _hardCap.minus(_lessThanHardCap);
        await grapevineCrowdsale.sendTransaction({ value: amount, from: _buyer }).should.be.fulfilled;
        await grapevineCrowdsale.sendTransaction({ value: _lessThanHardCap, from: _buyer }).should.be.fulfilled;
      });
  
      it('should reject payments outside cap', async function () {
        await grapevineCrowdsale.sendTransaction({ value: _hardCap, from: _buyer });
        await grapevineCrowdsale.sendTransaction({ value: 1, from: _buyer }).should.be.rejectedWith(EVMRevert);
      });
  
      it('should reject payments that exceed cap', async function () {
        let amount = _hardCap.add(1);
        await grapevineCrowdsale.sendTransaction({ value: amount, from: _buyer }).should.be.rejectedWith(EVMRevert);
      });
    });
  
    describe('ending', function () {
      it('should not reach cap if sent under cap', async function () {
        let capReached = await grapevineCrowdsale.capReached();
        capReached.should.equal(false);
        await grapevineCrowdsale.sendTransaction({ value: _lessThanHardCap, from: _buyer });
        capReached = await grapevineCrowdsale.capReached();
        capReached.should.equal(false);
      });
  
      it('should not reach cap if sent just under cap', async function () {
        let amount = _hardCap.minus(1);
        await grapevineCrowdsale.sendTransaction({ value: amount, from: _buyer });
        let capReached = await grapevineCrowdsale.capReached();
        capReached.should.equal(false);
      });
  
      it('should reach cap if cap sent', async function () {
        await grapevineCrowdsale.sendTransaction({ value: _hardCap, from: _buyer });
        let capReached = await grapevineCrowdsale.capReached();
        capReached.should.equal(true);
      });
    });
  });
});
