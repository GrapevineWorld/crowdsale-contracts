pragma solidity 0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/AllowanceCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";


/**
 * @title Grapevine Crowdsale, combining capped, timed and allownce crowdsales
 * while being pausable.
 * @dev Grapevine Crowdsale
 **/

contract GrapevineCrowdsale is CappedCrowdsale, AllowanceCrowdsale, TimedCrowdsale, Pausable, RefundableCrowdsale {

    /**
    * @param _rate Number of token units a buyer gets per wei
    * @param _wallet Address where collected funds will be forwarded to
    * @param _token Address of the token being sold
    * @param _openingTime Crowdsale opening time
    * @param _closingTime Crowdsale closing time
    * @param _softCap Funding goal
    * @param _hardCap Max amount of wei to be contributed
    * @param _tokenWallet Address holding the tokens, which has approved allowance to the crowdsale
    */
  constructor(
    uint256 _rate, 
    address _wallet,
    ERC20 _token, 
    uint256 _openingTime, 
    uint256 _closingTime, 
    uint256 _softCap, 
    uint256 _hardCap, 
    address _tokenWallet)
    Crowdsale(_rate, _wallet, _token)
    CappedCrowdsale(_hardCap)
    TimedCrowdsale(_openingTime, _closingTime) 
    AllowanceCrowdsale(_tokenWallet)
    RefundableCrowdsale(_softCap)
    public
    {
        
  }

  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal whenNotPaused {
    super._preValidatePurchase(_beneficiary, _weiAmount);
  }
}
