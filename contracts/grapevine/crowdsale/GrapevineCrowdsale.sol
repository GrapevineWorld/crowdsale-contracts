pragma solidity ^0.4.23;

import "./GrapevineWhitelistInterface.sol";
import "./TokenTimelockControllerInterface.sol";
import "./BurnableTokenInterface.sol";
import "openzeppelin-solidity/contracts/ownership/Whitelist.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/PostDeliveryCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";


/**
 * @title Grapevine Crowdsale, combining capped, timed, PostDelivery and refundable crowdsales
 * while being pausable.
 * @dev Grapevine Crowdsale
 **/
contract GrapevineCrowdsale is CappedCrowdsale, TimedCrowdsale, Pausable, RefundableCrowdsale, PostDeliveryCrowdsale {
  using SafeMath for uint256;

  TokenTimelockControllerInterface public timelockController;
  GrapevineWhitelistInterface  public authorisedInvestors;
  GrapevineWhitelistInterface public earlyInvestors;

  mapping(address => uint256) public bonuses;

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
    TokenTimelockControllerInterface _timelockController,
    GrapevineWhitelistInterface _authorisedInvestors,
    GrapevineWhitelistInterface _earlyInvestors,
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
    authorisedInvestors = _authorisedInvestors;
    earlyInvestors = _earlyInvestors;
    // token delivery starts 5 days after the crowdsale ends.
    deliveryTime = _closingTime.add(60*60*24*5);
    // deliveryTime = _closingTime.add(60*5);
  }

  /**
   * @dev low level token purchase
   * @param _beneficiary Address performing the token purchase
   */
  function buyTokens(address _beneficiary, bytes _whitelistSign) public payable {
    // since the earlyInvestors are by definition autorised, we check first the earlyInvestors.
    if (!earlyInvestors.handleOffchainWhitelisted(_beneficiary, _whitelistSign)) {
      authorisedInvestors.handleOffchainWhitelisted(_beneficiary, _whitelistSign);
    }
    super.buyTokens(_beneficiary);
  }

  /**
   * @dev Withdraw tokens only after the deliveryTime.
   */
  function withdrawTokens() public {
    require(goalReached());
    // solium-disable-next-line security/no-block-members
    require(block.timestamp > deliveryTime);
    super.withdrawTokens();
    uint256 _bonusTokens = bonuses[msg.sender];
    if (_bonusTokens > 0) {
      bonuses[msg.sender] = 0;
      require(token.approve(address(timelockController), _bonusTokens));
      require(
        timelockController.createInvestorTokenTimeLock(
          msg.sender,
          _bonusTokens,
          deliveryTime,
          this
        )
      );
    }
  }

  /**
   * @dev Executed when a purchase has been validated and is ready to be executed. Not necessarily emits/sends tokens.
   * It computes the bonus and store it using the timelockController.
   * @param _beneficiary Address receiving the tokens
   * @param _tokenAmount Number of tokens to be purchased
   */
  function _processPurchase( address _beneficiary, uint256 _tokenAmount ) internal {
    uint256 _totalTokens = _tokenAmount;
    // solium-disable-next-line security/no-block-members
    uint256 _bonus = getBonus(block.timestamp, _beneficiary, msg.value);
    if (_bonus>0) {
      uint256 _bonusTokens = _tokenAmount.mul(_bonus).div(100);
      // make sure the crowdsale contract has enough tokens to transfer the purchased tokens and to create the timelock bonus.
      uint256 _currentBalance = token.balanceOf(this);
      require(_currentBalance >= _totalTokens.add(_bonusTokens));
      bonuses[_beneficiary] = bonuses[_beneficiary].add(_bonusTokens);
      _totalTokens = _totalTokens.add(_bonusTokens);
    }
    tokensToBeDelivered = tokensToBeDelivered.add(_totalTokens);
    super._processPurchase(_beneficiary, _tokenAmount);
  }

  /**
   * @dev Validation of an incoming purchase. Allowas purchases only when crowdsale is not paused and the _beneficiary is authorized to buy.
   * The early investors went through the KYC process, so they are authorised by default.
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal whenNotPaused {
    require(authorisedInvestors.whitelist(_beneficiary) || earlyInvestors.whitelist(_beneficiary));
    super._preValidatePurchase(_beneficiary, _weiAmount);
  }

  /**
   * @dev Computes the bonus. The bonus is
   * - 0 by default
   * - 30% before reaching the softCap for those whitelisted.
   * - 15% the first week
   * - 10% the second week
   * - 8% the third week
   * - 6% the remaining time.
   * @param _time when the purchased happened.
   * @param _beneficiary Address performing the token purchase.
   * @param _value Value in wei involved in the purchase.
   */
  function getBonus(uint256 _time, address _beneficiary, uint256 _value) view internal returns (uint256 _bonus) {
    //default bonus is 0.
    _bonus = 0;
    
    // at this level the amount was added to weiRaised
    if ( (weiRaised.sub(_value) < goal) && earlyInvestors.whitelist(_beneficiary) ) {
      _bonus = 30;
    } else {
      if (_time < openingTime.add(7 days)) {
        _bonus = 15;
      } else if (_time < openingTime.add(14 days)) {
        _bonus = 10;
      } else if (_time < openingTime.add(21 days)) {
        _bonus = 8;
      } else {
        _bonus = 6;
      }
    }
    return _bonus;
  }

  /**
   * @dev Performs the finalization tasks:
   * - if goal reached, activate the controller and burn the remaining tokens
   * - transfer the ownership of the token contract back to the owner.
   */
  function finalization() internal {
    // only when the goal is reached we burn the tokens and activate the controller.
    if (goalReached()) {
      // activate the controller to enable the investors and team members 
      // to claim their tokens when the time comes.
      timelockController.activate();

      // calculate the quantity of tokens to be burnt. The bonuses are already transfered to the Controller.
      uint256 balance = token.balanceOf(this);
      uint256 remainingTokens = balance.sub(tokensToBeDelivered);
      if (remainingTokens>0) {
        BurnableTokenInterface(address(token)).burn(remainingTokens);
      }
    }
    Ownable(address(token)).transferOwnership(owner);
    super.finalization();
  }
}
