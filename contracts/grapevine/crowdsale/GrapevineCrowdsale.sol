pragma solidity ^0.4.23;

import "./TokenTimelockController.sol";
import "openzeppelin-solidity/contracts/ownership/Whitelist.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/PostDeliveryCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";


/**
 * @title Grapevine Crowdsale, combining capped, timed, PostDelivery and refundable crowdsales
 * while being pausable.
 * @dev Grapevine Crowdsale
 **/

contract GrapevineCrowdsale is CappedCrowdsale, TimedCrowdsale, Pausable, RefundableCrowdsale, Whitelist, PostDeliveryCrowdsale {
  TokenTimelockController public timelockController;
  uint256 deliveryTime;
  uint256 tokensToBeDelivered;

  /**
    * @param _timelockController address of the controller managing the bonus token lock
    * @param _rate Number of token units a buyer gets per wei
    * @param _wallet Address where collected funds will be forwarded to
    * @param _token Address of the token being sold
    * @param _openingTime Crowdsale opening time
    * @param _closingTime Crowdsale closing time
    * @param _softCap Funding goal
    * @param _hardCap Max amount of wei to be contributed
    */
  constructor(
    TokenTimelockController _timelockController,
    uint256 _rate, 
    address _wallet,
    ERC20 _token, 
    uint256 _openingTime, 
    uint256 _closingTime, 
    uint256 _softCap, 
    uint256 _hardCap)
    Crowdsale(_rate, _wallet, _token)
    CappedCrowdsale(_hardCap)
    TimedCrowdsale(_openingTime, _closingTime) 
    RefundableCrowdsale(_softCap)
    public 
    {
    timelockController = _timelockController;
    // token delivery starts 5 days after the crowdsale ends.
    deliveryTime = _closingTime.add(60*60*24*5);
    // deliveryTime = _closingTime.add(60*5);
  }

  /**
   * @dev Withdraw tokens only after the deliveryTime.
   */
  function withdrawTokens() public {
    require(goalReached());
    // solium-disable-next-line security/no-block-members
    require(block.timestamp > deliveryTime);
    super.withdrawTokens();
  }

  /**
   * @dev Executed when a purchase has been validated and is ready to be executed. Not necessarily emits/sends tokens.
   * It computes the bonus and store it using the timelockController.
   * @param _beneficiary Address receiving the tokens
   * @param _tokenAmount Number of tokens to be purchased
   */
  function _processPurchase( address _beneficiary, uint256 _tokenAmount ) internal {
    tokensToBeDelivered = tokensToBeDelivered.add(_tokenAmount);
    // solium-disable-next-line security/no-block-members
    uint256 _bonus = getBonus(block.timestamp, _beneficiary, msg.value);
    uint256 _bonusTokens = _tokenAmount.mul(_bonus).div(100);
    // make sure the crowdsale contract has enough tokens to transfer the tokens and to create the timelock contract.
    uint256 _currentBalance = token.balanceOf(this);
    require(_currentBalance >= tokensToBeDelivered.add(_bonusTokens));
    if (_bonus>0) {
      require(token.approve(address(timelockController), _bonusTokens));
      require(
        timelockController.createInvestorTokenTimeLock(
          _beneficiary,
          _bonusTokens,
          deliveryTime,
          this
        )
      );
    }
    super._processPurchase(_beneficiary, _tokenAmount);
  }

  /**
   * @dev Validation of an incoming purchase. Allowas purchases only when crowdsale is not paused.
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal whenNotPaused {
    super._preValidatePurchase(_beneficiary, _weiAmount);
  }

  /**
   * @dev Computes the bonus. The bonus is
   * - 0 by default
   * - 30% before reaching the softCap for those whitelisted.
   * - 15% the first 8 days
   * - 10% the next 8 days
   * - 8% the next 8 days
   * - 6% the next 6 days
   * @param _time when the purchased happened.
   * @param _beneficiary Address performing the token purchase.
   * @param _value Value in wei involved in the purchase.
   */
  function getBonus(uint256 _time, address _beneficiary, uint256 _value) view internal returns (uint256 _bonus) {
    //default bonus is 0.
    _bonus = 0;
    
    // at this level the amount was added to weiRaised
    if ( (weiRaised.sub(_value) < goal) && whitelist(_beneficiary)) {
      _bonus = 30;
    } else {
      if (_time < openingTime.add(8 days)) {
        _bonus = 15;
      } else if (_time < openingTime.add(16 days)) {
        _bonus = 10;
      } else if (_time < openingTime.add(24 days)) {
        _bonus = 8;
      } else if (_time < openingTime.add(30 days)) {
        _bonus = 6;
      }
    }
    return _bonus;
  }

  /**
   * @dev Performs the finalization tasks:
   * - if goal reached, activate the controller and burn the remaining tokens
   * - transfer the ownershoip of the token contract back to the owner.
   */
  function finalization() internal {
    // only when the goal is reached we burn the tokens
    if (goalReached()) {
      timelockController.activate();
      timelockController.setCrowdsaleEnded();

      // calculate the quantity of tokens to be burnt. The bonuses are already transfered to the Controller.
      uint256 balance = token.balanceOf(this);
      uint256 remainingTokens = balance.sub(tokensToBeDelivered);
      if (remainingTokens>0) {
        BurnableToken(address(token)).burn(remainingTokens);
      }
    }

    Ownable(address(token)).transferOwnership(owner);
    super.finalization();
  }
}
