import assertRevert from 'openzeppelin-solidity/test/helpers/assertRevert';
import expectEvent from 'openzeppelin-solidity/test/helpers/expectEvent';
import expectThrow from 'openzeppelin-solidity/test/helpers/expectThrow';

const GrapevineWhitelist = artifacts.require('./GrapevineWhitelist.sol');

const chai = require('chai').use(require('chai-as-promised'));
const should = chai.should();

contract('GrapevineWhitelist', accounts => {
  let grapevineWhitelist;

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  // owner of the token contract
  var _owner = accounts[0];
  var _signer = accounts[1];
  var _crowdsale = accounts[2];
  var _user = accounts[3];
  var _user2 = accounts[5];
  var _anyone = accounts[6];

  beforeEach('setup contract for each test', async function () {
    grapevineWhitelist = await GrapevineWhitelist.new(_signer, { from: _owner });
    await grapevineWhitelist.setCrowdsale(_crowdsale, { from: _owner });
  });

  describe('in normal conditions', function () {
    it('should add address to the whitelist', async function () {
      await expectEvent.inTransaction(
        grapevineWhitelist.addAddressToWhitelist(_user, { from: _owner }),
        'WhitelistedAddressAdded'
      );
      const isWhitelisted = await grapevineWhitelist.whitelist(_user);
      isWhitelisted.should.be.equal(true);
    });

    it('should add addresses to the whitelist', async function () {
      let whitelistedAddresses = [_user, _user2];
      await expectEvent.inTransaction(
        grapevineWhitelist.addAddressesToWhitelist(whitelistedAddresses, { from: _owner }),
        'WhitelistedAddressAdded'
      );
      for (let addr of whitelistedAddresses) {
        const isWhitelisted = await grapevineWhitelist.whitelist(addr);
        isWhitelisted.should.be.equal(true);
      }
    });

    it('should remove address from the whitelist', async function () {
      await expectEvent.inTransaction(
        grapevineWhitelist.removeAddressFromWhitelist(_user, { from: _owner }),
        'WhitelistedAddressRemoved'
      );
      let isWhitelisted = await grapevineWhitelist.whitelist(_user);
      isWhitelisted.should.be.equal(false);
    });

    it('has an owner', async function () {
      const owner = await grapevineWhitelist.owner();
      assert.equal(owner, _owner);
    });

    it('adds user to the whitelist if the signature is valid', async function () {
      const message = grapevineWhitelist.address.substr(2) + _user.substr(2) + '';
      let _sign = web3.eth.sign(_signer, web3.sha3(message, { encoding: 'hex' }));
      await expectEvent.inTransaction(
        grapevineWhitelist.handleOffchainWhitelisted(_user, _sign, { from: _owner }),
        'WhitelistedAddressAdded'
      );
      let whitelisted = await grapevineWhitelist.whitelist(_user);
      true.should.equal(whitelisted);
    });

    it('returns true without checking the signature if the user in the whitelist', async function () {
      const message = grapevineWhitelist.address.substr(2) + _user.substr(2) + '';
      let _sign = web3.eth.sign(_signer, web3.sha3(message, { encoding: 'hex' }));
      await expectEvent.inTransaction(
        grapevineWhitelist.handleOffchainWhitelisted(_user, _sign, { from: _owner }),
        'WhitelistedAddressAdded'
      );
      let whitelisted = await grapevineWhitelist.whitelist(_user);
      true.should.equal(whitelisted);

      let receipt = await grapevineWhitelist.handleOffchainWhitelisted(_user, _sign, { from: _owner });
      const event = receipt.logs.find(e => e.event === 'WhitelistedAddressAdded');
      should.not.exist(event);
      whitelisted = await grapevineWhitelist.whitelist(_user);
      true.should.equal(whitelisted);
    });
  });

  describe('in adversarial conditions', function () {
    it('should not allow "anyone" to add to the whitelist', async () => {
      await expectThrow(
        grapevineWhitelist.addAddressToWhitelist(_user, { from: _anyone })
      );
    });

    it('should not allow "anyone" to remove from the whitelist', async () => {
      await expectThrow(
        grapevineWhitelist.removeAddressFromWhitelist(_user, { from: _anyone })
      );
    });

    it('reverts if the signer is a 0 address', async function () {
      await assertRevert(GrapevineWhitelist.new(ZERO_ADDRESS, { from: _owner }));
    });

    it('reverts if 0 address is set as crowdsale', async function () {
      await assertRevert(grapevineWhitelist.setCrowdsale(ZERO_ADDRESS, { from: _owner }));
    });

    it('reverts if another address than the crowdsale or owner calls handleOffchainWhitelisted', async function () {
      let _sign = await web3.eth.sign(_signer, _user);
      await assertRevert(grapevineWhitelist.handleOffchainWhitelisted(_user, _sign, { from: _anyone }));
    });

    it('does not add the user to the whitelist if the signature is not valid', async function () {
      await grapevineWhitelist.handleOffchainWhitelisted(_user, '', { from: _owner });
      let whitelisted = await grapevineWhitelist.whitelist(_user);
      false.should.equal(whitelisted);
    });
  });
});
