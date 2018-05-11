import assertRevert from 'openzeppelin-solidity/test/helpers/assertRevert';

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const GrapevineToken = artifacts.require('./GrapevineToken.sol');

contract('PausableToken', accounts => {
  let grapevineToken;

  // owner of the token contract
  var _owner = accounts[0];
  var _receiver = accounts[1];
  var _anotherAccount = accounts[2];

  // this account can transfer, approve only when the contract is unpaused, unlike the addresses in the whitelist.
  var _unauthorizedAccount = accounts[3];

  // this account can transfer, approve even when the contract is paused since he will added to the whitelist.
  var _authorizedAccount = accounts[4];

  beforeEach('setup contract for each test', async function () {
    grapevineToken = await GrapevineToken.new({ from: _owner });
    await grapevineToken.transfer(_unauthorizedAccount, 10000, { from: _owner });
    await grapevineToken.transfer(_authorizedAccount, 10000, { from: _owner });
    await grapevineToken.addAddressToWhitelist(_authorizedAccount, { from: _owner });
  });

  describe('pausable token', function () {
    describe('paused', function () {
      it('is paused by default', async function () {
        const paused = await grapevineToken.paused({ from: _owner });

        assert.equal(paused, true);
      });

      it('is unpaused after being unpaused', async function () {
        await grapevineToken.unpause({ from: _owner });
        const paused = await grapevineToken.paused({ from: _owner });

        assert.equal(paused, false);
      });

      it('is paused after being unpaused and then paused', async function () {
        await grapevineToken.unpause({ from: _owner });
        await grapevineToken.pause({ from: _owner });
        const paused = await grapevineToken.paused();

        assert.equal(paused, true);
      });
    });

    describe('transfer', function () {
      it('allows to transfer when paused for whitelisted addresses', async function () {
        const initialSenderBalance = await grapevineToken.balanceOf(_authorizedAccount);

        await grapevineToken.transfer(_receiver, 100, { from: _authorizedAccount });

        const senderBalance = await grapevineToken.balanceOf(_authorizedAccount);

        senderBalance.should.be.bignumber.equal(initialSenderBalance.minus(100));

        const recipientBalance = await grapevineToken.balanceOf(_receiver);
        assert.equal(recipientBalance, 100);
      });

      it('allows to transfer when unpaused', async function () {
        await grapevineToken.unpause({ from: _owner });

        const initialSenderBalance = await grapevineToken.balanceOf(_unauthorizedAccount);

        await grapevineToken.transfer(_receiver, 100, { from: _unauthorizedAccount });

        const senderBalance = await grapevineToken.balanceOf(_unauthorizedAccount);

        senderBalance.should.be.bignumber.equal(initialSenderBalance.minus(100));

        const recipientBalance = await grapevineToken.balanceOf(_receiver);
        assert.equal(recipientBalance, 100);
      });

      it('allows to transfer when unpaused, paused, unpaused', async function () {
        await grapevineToken.unpause({ from: _owner });
        await grapevineToken.pause({ from: _owner });
        await grapevineToken.unpause({ from: _owner });

        const initialSenderBalance = await grapevineToken.balanceOf(_unauthorizedAccount);

        await grapevineToken.transfer(_receiver, 100, { from: _unauthorizedAccount });

        const senderBalance = await grapevineToken.balanceOf(_unauthorizedAccount);

        senderBalance.should.be.bignumber.equal(initialSenderBalance.minus(100));

        const recipientBalance = await grapevineToken.balanceOf(_receiver);
        assert.equal(recipientBalance, 100);
      });

      it('reverts when trying to transfer when paused', async function () {
        // the contract is already paused by default
        await assertRevert(grapevineToken.transfer(_receiver, 100, { from: _unauthorizedAccount }));
      });
    });

    describe('approve', function () {
      it('allows to approve when paused for whitelisted addresses', async function () {
        await grapevineToken.approve(_anotherAccount, 40, { from: _authorizedAccount });

        const allowance = await grapevineToken.allowance(_authorizedAccount, _anotherAccount);
        assert.equal(allowance, 40);
      });

      it('allows to approve when unpaused', async function () {
        await grapevineToken.unpause({ from: _owner });
        await grapevineToken.approve(_anotherAccount, 40, { from: _unauthorizedAccount });

        const allowance = await grapevineToken.allowance(_unauthorizedAccount, _anotherAccount);
        assert.equal(allowance, 40);
      });

      it('allows to approve when unpaused, paused, unpaused', async function () {
        await grapevineToken.unpause({ from: _owner });
        await grapevineToken.pause({ from: _owner });
        await grapevineToken.unpause({ from: _owner });

        await grapevineToken.approve(_anotherAccount, 40, { from: _unauthorizedAccount });

        const allowance = await grapevineToken.allowance(_unauthorizedAccount, _anotherAccount);
        assert.equal(allowance, 40);
      });

      it('reverts when trying to transfer when paused', async function () {
        // the contract is already paused by default
        await assertRevert(grapevineToken.approve(_anotherAccount, 40, { from: _unauthorizedAccount }));
      });
    });

    describe('transfer from', function () {
      beforeEach(async function () {
        await grapevineToken.unpause({ from: _owner });
        await grapevineToken.approve(_anotherAccount, 50, { from: _unauthorizedAccount });
      });

      it('allows to transfer from when paused for a whitelisted address', async function () {
        await grapevineToken.approve(_anotherAccount, 50, { from: _authorizedAccount });
        await grapevineToken.addAddressToWhitelist(_anotherAccount, { from: _owner });

        await grapevineToken.pause({ from: _owner });

        const initialSenderBalance = await grapevineToken.balanceOf(_authorizedAccount);

        await grapevineToken.transferFrom(_authorizedAccount, _receiver, 40, { from: _anotherAccount });

        const senderBalance = await grapevineToken.balanceOf(_authorizedAccount);

        senderBalance.should.be.bignumber.equal(initialSenderBalance.minus(40));

        const recipientBalance = await grapevineToken.balanceOf(_receiver);
        assert.equal(recipientBalance, 40);

        await grapevineToken.removeAddressFromWhitelist(_anotherAccount, { from: _owner });
      });

      it('allows to transfer from when unpaused', async function () {
        const initialSenderBalance = await grapevineToken.balanceOf(_unauthorizedAccount);

        await grapevineToken.transferFrom(_unauthorizedAccount, _receiver, 40, { from: _anotherAccount });

        const senderBalance = await grapevineToken.balanceOf(_unauthorizedAccount);

        senderBalance.should.be.bignumber.equal(initialSenderBalance.minus(40));

        const recipientBalance = await grapevineToken.balanceOf(_receiver);
        assert.equal(recipientBalance, 40);
      });

      it('allows to transfer when paused and then unpaused', async function () {
        await grapevineToken.pause({ from: _owner });
        await grapevineToken.unpause({ from: _owner });

        const initialSenderBalance = await grapevineToken.balanceOf(_unauthorizedAccount);

        await grapevineToken.transferFrom(_unauthorizedAccount, _receiver, 40, { from: _anotherAccount });

        const senderBalance = await grapevineToken.balanceOf(_unauthorizedAccount);
        senderBalance.should.be.bignumber.equal(initialSenderBalance.minus(40));

        const recipientBalance = await grapevineToken.balanceOf(_receiver);
        assert.equal(recipientBalance, 40);
      });

      it('reverts when trying to transfer from when paused', async function () {
        await grapevineToken.pause({ from: _owner });
        await assertRevert(grapevineToken.transferFrom(_unauthorizedAccount, _receiver, 40, { from: _anotherAccount }));
      });
    });

    describe('decrease approval', function () {
      beforeEach(async function () {
        await grapevineToken.unpause({ from: _owner });
        await grapevineToken.approve(_anotherAccount, 100, { from: _unauthorizedAccount });
      });

      it('allows to decrease approval when paused for whitelist address', async function () {
        await grapevineToken.approve(_anotherAccount, 100, { from: _authorizedAccount });

        await grapevineToken.pause({ from: _owner });

        await grapevineToken.decreaseApproval(_anotherAccount, 40, { from: _authorizedAccount });

        const allowance = await grapevineToken.allowance(_authorizedAccount, _anotherAccount);
        assert.equal(allowance, 60);
      });

      it('allows to decrease approval when unpaused', async function () {
        await grapevineToken.decreaseApproval(_anotherAccount, 40, { from: _unauthorizedAccount });

        const allowance = await grapevineToken.allowance(_unauthorizedAccount, _anotherAccount);
        assert.equal(allowance, 60);
      });

      it('allows to decrease approval when paused and then unpaused', async function () {
        await grapevineToken.pause({ from: _owner });
        await grapevineToken.unpause({ from: _owner });

        await grapevineToken.decreaseApproval(_anotherAccount, 40, { from: _unauthorizedAccount });

        const allowance = await grapevineToken.allowance(_unauthorizedAccount, _anotherAccount);
        assert.equal(allowance, 60);
      });

      it('reverts when trying to transfer when paused', async function () {
        await grapevineToken.pause({ from: _owner });

        await assertRevert(grapevineToken.decreaseApproval(_anotherAccount, 40, { from: _unauthorizedAccount }));
      });
    });

    describe('increase approval', function () {
      beforeEach(async function () {
        await grapevineToken.unpause({ from: _owner });
        await grapevineToken.approve(_anotherAccount, 100, { from: _unauthorizedAccount });
      });

      it('allows to increase approval when paused for whitelist address', async function () {
        await grapevineToken.approve(_anotherAccount, 100, { from: _authorizedAccount });

        await grapevineToken.pause({ from: _owner });

        await grapevineToken.increaseApproval(_anotherAccount, 40, { from: _authorizedAccount });

        const allowance = await grapevineToken.allowance(_authorizedAccount, _anotherAccount);
        assert.equal(allowance, 140);
      });

      it('allows to increase approval when unpaused', async function () {
        await grapevineToken.increaseApproval(_anotherAccount, 40, { from: _unauthorizedAccount });

        const allowance = await grapevineToken.allowance(_unauthorizedAccount, _anotherAccount);
        assert.equal(allowance, 140);
      });

      it('allows to increase approval when paused and then unpaused', async function () {
        await grapevineToken.pause({ from: _owner });
        await grapevineToken.unpause({ from: _owner });

        await grapevineToken.increaseApproval(_anotherAccount, 40, { from: _unauthorizedAccount });

        const allowance = await grapevineToken.allowance(_unauthorizedAccount, _anotherAccount);
        assert.equal(allowance, 140);
      });

      it('reverts when trying to increase approval when paused', async function () {
        await grapevineToken.pause({ from: _owner });
        await assertRevert(grapevineToken.increaseApproval(_anotherAccount, 40, { from: _unauthorizedAccount }));
      });
    });
  });
});
