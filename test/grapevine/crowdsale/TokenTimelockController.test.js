import assertRevert from 'openzeppelin-solidity/test/helpers/assertRevert';
import EVMRevert from 'openzeppelin-solidity/test//helpers/EVMRevert';
import latestTime from 'openzeppelin-solidity/test//helpers/latestTime';
import { increaseTimeTo, duration } from 'openzeppelin-solidity/test//helpers/increaseTime';

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const GrapevineToken = artifacts.require('GrapevineToken');
const TokenTimelockController = artifacts.require('TokenTimelockController');

contract('TokenTimelockController', accounts => {
  const amount = new BigNumber(1000);

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  var owner = accounts[1];
  var beneficiary = accounts[2];
  var newBeneficiary = accounts[3];
  var crowdsale = accounts[4];
  var nobody = accounts[5];

  var TEAM_LOCK_DURATION_PART1 = duration.days(365);
  var TEAM_LOCK_DURATION_PART2 = 2 * duration.days(365);
  var INVESTOR_LOCK_DURATION = 6 * duration.days(30);
  var INVESTOR_LOCK_RELEASE_TIME;
  var TEAM_LOCK_RELEASE_TIME_PART1;
  var TEAM_LOCK_RELEASE_TIME_PART2;

  beforeEach(async function () {
    this.token = await GrapevineToken.new({ from: owner });
    this.tokenTimelockController = await TokenTimelockController.new(this.token.address, { from: owner });

    await this.tokenTimelockController.setCrowdsale(crowdsale, { from: owner });

    this.start = latestTime() + duration.minutes(1); // +1 minute so it starts after contract instantiation
    this.revocable = false;
    INVESTOR_LOCK_RELEASE_TIME = new BigNumber(INVESTOR_LOCK_DURATION + this.start);
    TEAM_LOCK_RELEASE_TIME_PART1 = new BigNumber(TEAM_LOCK_DURATION_PART1 + this.start);
    TEAM_LOCK_RELEASE_TIME_PART2 = new BigNumber(TEAM_LOCK_DURATION_PART2 + this.start);
  });

  describe('setting the environment', function () {
    it('set the crowdsale address!', async function () {
      await this.tokenTimelockController.setCrowdsale(crowdsale, { from: owner });
      let crowdsaleSet = await this.tokenTimelockController.crowdsale();
      crowdsale.should.equal(crowdsaleSet);
    });

    it('set controller active', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      let activated = await this.tokenTimelockController.activated();
      true.should.equal(activated);
    });

    it('reverts the crowdsale setting if the sender is not the owner!', async function () {
      await assertRevert(this.tokenTimelockController.setCrowdsale(crowdsale, { from: nobody }));
    });

    it('reverts the crowdsale setting if the address is 0!', async function () {
      await assertRevert(this.tokenTimelockController.setCrowdsale(ZERO_ADDRESS, { from: owner }));
    });

    it('reverts the activate if the sender is not the crowdsale!', async function () {
      await assertRevert(this.tokenTimelockController.activate({ from: owner }));
    });
  });

  describe('managing the TokenTimelock creation', function () {
    var receipt;
    beforeEach(async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
    });

    it('keeps count of the created TokenTimelock', async function () {
      await this.tokenTimelockController.createInvestorTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: crowdsale }
      );
      await assertRevert(this.tokenTimelockController.getTokenTimelockDetails(beneficiary, 1));
    });

    it('creates an investor TokenTimelock after being approved the necessary tokens', async function () {
      receipt = await this.tokenTimelockController.createInvestorTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: crowdsale }
      );

      const event = receipt.logs.find(e => e.event === 'TokenTimelockCreated');
      beneficiary.should.equal(event.args.beneficiary);
      INVESTOR_LOCK_RELEASE_TIME.should.bignumber.equal(event.args.releaseTime);
      false.should.equal(event.args.revocable);
      amount.should.bignumber.equal(event.args.amount);

      await assertRevert(this.tokenTimelockController.getTokenTimelockDetails(beneficiary, 1));

      var details = await this.tokenTimelockController.getTokenTimelockDetails(beneficiary, 0);
      amount.should.bignumber.equal(details[0]);
      INVESTOR_LOCK_RELEASE_TIME.should.bignumber.equal(details[1]);
      false.should.equal(details[2]);
      false.should.equal(details[3]);
      false.should.equal(details[4]);
    });

    it('creates a team TokenTimelock after being approved the necessary tokens', async function () {
      receipt = await this.tokenTimelockController.createTeamTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: owner }
      );

      var event = receipt.logs.filter(e => e.event === 'TokenTimelockCreated');
      beneficiary.should.equal(event[0].args.beneficiary);
      TEAM_LOCK_RELEASE_TIME_PART1.should.bignumber.equal(event[0].args.releaseTime);
      true.should.equal(event[0].args.revocable);
      amount.div(2).should.bignumber.equal(event[0].args.amount);

      beneficiary.should.equal(event[1].args.beneficiary);
      TEAM_LOCK_RELEASE_TIME_PART2.should.bignumber.equal(event[1].args.releaseTime);
      true.should.equal(event[1].args.revocable);
      amount.div(2).should.bignumber.equal(event[1].args.amount);

      var details = await this.tokenTimelockController.getTokenTimelockDetails(beneficiary, 0);
      amount.div(2).should.bignumber.equal(details[0]);
      TEAM_LOCK_RELEASE_TIME_PART1.should.bignumber.equal(details[1]);
      false.should.equal(details[2]);
      true.should.equal(details[3]);
      false.should.equal(details[4]);

      details = await this.tokenTimelockController.getTokenTimelockDetails(beneficiary, 1);
      amount.div(2).should.bignumber.equal(details[0]);
      TEAM_LOCK_RELEASE_TIME_PART2.should.bignumber.equal(details[1]);
      false.should.equal(details[2]);
      true.should.equal(details[3]);
      false.should.equal(details[4]);
    });

    it('reverts the TokenTimelock creation if the sender is not the crowdsale!', async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await assertRevert(this.tokenTimelockController.createInvestorTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: nobody })
      );
    });

    it('reverts the investor TokenTimelock creation if the beneficiary is a 0 address!', async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await assertRevert(this.tokenTimelockController.createInvestorTokenTimeLock(
        ZERO_ADDRESS,
        amount,
        this.start,
        owner,
        { from: crowdsale })
      );
    });

    it('reverts the investor TokenTimelock creation if the amount is 0!', async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await assertRevert(this.tokenTimelockController.createInvestorTokenTimeLock(
        beneficiary,
        0,
        this.start,
        owner,
        { from: crowdsale })
      );
    });

    it('reverts the investor TokenTimelock creation if the tokenHolder is a 0 address!', async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await assertRevert(this.tokenTimelockController.createInvestorTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        ZERO_ADDRESS,
        { from: crowdsale })
      );
    });

    it('reverts the investor TokenTimelock creation if the transfer was not approved', async function () {
      await assertRevert(this.tokenTimelockController.createInvestorTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        beneficiary,
        { from: crowdsale })
      );
    });

    it('reverts the team TokenTimelock creation if the sender is not the owner!', async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await assertRevert(this.tokenTimelockController.createTeamTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: nobody })
      );
    });

    it('reverts the team TokenTimelock creation if the beneficiary is a 0 address!', async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await assertRevert(this.tokenTimelockController.createTeamTokenTimeLock(
        ZERO_ADDRESS,
        amount,
        this.start,
        owner,
        { from: owner })
      );
    });

    it('reverts the team TokenTimelock creation if the amount is 0!', async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await assertRevert(this.tokenTimelockController.createTeamTokenTimeLock(
        beneficiary,
        0,
        this.start,
        owner,
        { from: owner })
      );
    });

    it('reverts the team TokenTimelock creation if the tokenHolder is a 0 address!', async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await assertRevert(this.tokenTimelockController.createTeamTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        ZERO_ADDRESS,
        { from: owner })
      );
    });

    it('reverts the team  TokenTimelock creation if the tokenHolder did not approve the transfer!', async function () {
      await assertRevert(this.tokenTimelockController.createTeamTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        beneficiary,
        { from: owner })
      );
    });
  });

  describe('managing the TokenTimelock revoke', function () {
    beforeEach(async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await this.tokenTimelockController.createTeamTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: owner }
      );
    });

    it('revokes an existing TokenTimelock', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      var details = await this.tokenTimelockController.getTokenTimelockDetails(beneficiary, 0);
      false.should.equal(details[4]);

      let balanceBefore = await this.token.balanceOf(owner);
      const revokeReceipt = await this.tokenTimelockController.revokeTokenTimelock(beneficiary, 0, { from: owner });

      const event = revokeReceipt.logs.find(e => e.event === 'TokenTimelockRevoked');
      beneficiary.should.equal(event.args.beneficiary);
      let balanceAfter = await this.token.balanceOf(owner);

      const balance = balanceAfter.sub(balanceBefore);

      amount.div(2).should.bignumber.equal(balance);

      details = await this.tokenTimelockController.getTokenTimelockDetails(beneficiary, 0);
      true.should.equal(details[4]);
    });

    it('reverts the revoke if the sender is not the owner!', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await assertRevert(this.tokenTimelockController.revokeTokenTimelock(
        beneficiary,
        0,
        { from: nobody })
      );
    });

    it('reverts the revoke if the beneficiary is 0 address!', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await assertRevert(this.tokenTimelockController.revokeTokenTimelock(
        ZERO_ADDRESS,
        0,
        { from: owner })
      );
    });

    it('reverts the revoke if the TokenTimelock is already released!', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await increaseTimeTo(TEAM_LOCK_RELEASE_TIME_PART1.add(duration.seconds(1)));
      await this.tokenTimelockController.release(0, { from: beneficiary }).should.be.fulfilled;
      await assertRevert(this.tokenTimelockController.revokeTokenTimelock(beneficiary, 0, { from: owner }));
    });

    it('should fail to be revoked by owner if TokenTimelock not revocable', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await this.tokenTimelockController.createInvestorTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: crowdsale }
      );
      let lasttokenTimelock = await this.tokenTimelockController.getTokenTimelockCount(beneficiary);
      await this.tokenTimelockController.revokeTokenTimelock(beneficiary, lasttokenTimelock.sub(1), { from: owner })
        .should.be.rejectedWith(EVMRevert);
    });

    it('should fail to be revoked a second time', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await this.tokenTimelockController.revokeTokenTimelock(beneficiary, 0, { from: owner });
      await this.tokenTimelockController.revokeTokenTimelock(beneficiary, 0, { from: owner })
        .should.be.rejectedWith(EVMRevert);
    });
    
    it('should fail to be revoked when controller is activated', async function () {
      await this.tokenTimelockController.revokeTokenTimelock(beneficiary, 0, { from: owner })
        .should.be.rejectedWith(EVMRevert);
    });
  });
  
  describe('managing the beneficiary', function () {
    beforeEach(async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await this.tokenTimelockController.createTeamTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: owner }
      );
    });

    it('sends an event log', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      const changeReceipt = await this.tokenTimelockController.changeBeneficiary(
        0,
        newBeneficiary,
        { from: beneficiary }
      );
      const changeEvent = changeReceipt.logs.find(e => e.event === 'TokenTimelockBeneficiaryChanged');
      beneficiary.should.equal(changeEvent.args.previousBeneficiary);
      newBeneficiary.should.equal(changeEvent.args.newBeneficiary);
    });

    it('alignes the TokenTimelock Count', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      const beneficiaryCountBefore = await this.tokenTimelockController.getTokenTimelockCount(beneficiary);
      const newBeneficiaryCountBefore = await this.tokenTimelockController.getTokenTimelockCount(newBeneficiary);
      await this.tokenTimelockController.changeBeneficiary(1, newBeneficiary, { from: beneficiary });
      await this.tokenTimelockController.changeBeneficiary(0, newBeneficiary, { from: beneficiary });
      const beneficiaryCountAfter = await this.tokenTimelockController.getTokenTimelockCount(beneficiary);
      const newBeneficiaryCountAfter = await this.tokenTimelockController.getTokenTimelockCount(newBeneficiary);

      beneficiaryCountAfter.should.bignumber.equal(beneficiaryCountBefore.sub(2));
      newBeneficiaryCountAfter.should.bignumber.equal(newBeneficiaryCountBefore.add(2));
    });

    it('changes the beneficiary and alignes data with beneficiary having more that 1 TokenTimelock', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await this.tokenTimelockController.changeBeneficiary(1, newBeneficiary, { from: beneficiary });
      var details = await this.tokenTimelockController.getTokenTimelockDetails(newBeneficiary, 0);
      amount.div(2).should.bignumber.equal(details[0]);
      TEAM_LOCK_RELEASE_TIME_PART2.should.bignumber.equal(details[1]);
      false.should.equal(details[2]);
      true.should.equal(details[3]);
      false.should.equal(details[4]);
    });

    it('reverts the beneficiary change if the sender is not the beneficiary!', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await assertRevert(this.tokenTimelockController.changeBeneficiary(0, newBeneficiary, { from: newBeneficiary }));
    });

    it('reverts the beneficiary change if the controller is not activated!', async function () {
      await assertRevert(this.tokenTimelockController.changeBeneficiary(0, newBeneficiary, { from: beneficiary }));
    });
  });

  describe('managing the TokenTimelock release', function () {
    beforeEach(async function () {
      await this.token.approve(this.tokenTimelockController.address, amount, { from: owner });
      await this.tokenTimelockController.createTeamTokenTimeLock(
        beneficiary,
        amount,
        this.start,
        owner,
        { from: owner }
      );
    });

    it('cannot be released before time limit', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await this.tokenTimelockController.release(0, { from: beneficiary }).should.be.rejected;
    });

    it('cannot be released just before time limit', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await increaseTimeTo(TEAM_LOCK_RELEASE_TIME_PART1.sub(duration.seconds(3)));
      await this.tokenTimelockController.release(0, { from: beneficiary }).should.be.rejected;
    });

    it('cannot be released if controller is not activated', async function () {
      await increaseTimeTo(TEAM_LOCK_RELEASE_TIME_PART1.add(duration.seconds(1)));
      await this.tokenTimelockController.release(0, { from: beneficiary }).should.be.rejected;
    });

    it('can be released just after limit', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await increaseTimeTo(TEAM_LOCK_RELEASE_TIME_PART1.add(duration.seconds(1)));
      await this.tokenTimelockController.release(0, { from: beneficiary }).should.be.fulfilled;
      const balance = await this.token.balanceOf(beneficiary);
      balance.should.be.bignumber.equal(amount.div(2));
    });

    it('can be released after time limit', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await increaseTimeTo(TEAM_LOCK_RELEASE_TIME_PART1.add(duration.years(1)));
      await this.tokenTimelockController.release(0, { from: beneficiary }).should.be.fulfilled;
      const balance = await this.token.balanceOf(beneficiary);
      balance.should.be.bignumber.equal(amount.div(2));
    });

    it('cannot be released twice', async function () {
      await this.tokenTimelockController.activate({ from: crowdsale });
      await increaseTimeTo(TEAM_LOCK_RELEASE_TIME_PART1.add(duration.years(1)));
      await this.tokenTimelockController.release(0, { from: beneficiary }).should.be.fulfilled;
      await this.tokenTimelockController.release(0, { from: beneficiary }).should.be.rejected;
      const balance = await this.token.balanceOf(beneficiary);
      balance.should.be.bignumber.equal(amount.div(2));
    });
  });
});
