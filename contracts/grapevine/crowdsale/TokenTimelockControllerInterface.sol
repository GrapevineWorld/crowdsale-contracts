pragma solidity ^0.4.23;


/**
 * @title TokenTimelock Controller Interface
 * @dev This contract allows the crowdsale to create locked bonuses and activate the controller.
 **/
contract TokenTimelockControllerInterface {

  /**
   * @dev Function to activate the controller.
   * It can be called only by the crowdsale address.
   */
  function activate() external;

  /**
   * @dev Creates a lock for the provided _beneficiary with the provided amount
   * The creation can be peformed only if:
   * - the sender is the address of the crowdsale;
   * - the _beneficiary and _tokenHolder are valid addresses;
   * - the _amount is greater than 0 and was appoved by the _tokenHolder prior to the transaction.
   * The investors will have a lock with a lock period of 6 months.
   * @param _beneficiary Address that will own the lock.
   * @param _amount the amount of the locked tokens.
   * @param _start when the lock should start.
   * @param _tokenHolder the account that approved the amount for this contract.
   */
  function createInvestorTokenTimeLock(
    address _beneficiary,
    uint256 _amount, 
    uint256 _start,
    address _tokenHolder
    ) external returns (bool);
}