pragma solidity 0.4.23;

import "openzeppelin-solidity/contracts/ownership/Whitelist.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";


/**
 * @title Pausable Token
 * @dev Same implementation as zeppeling PausableToken, except that the users from the whitelist can still 
 * perform the contract operations, even when it is paused.
 **/
contract PausableToken is StandardToken, Pausable, Whitelist {

 /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPausedOrWhitelisted() {
    require(!paused || whitelist[msg.sender]);
    _;
  }

  /**
  * @dev Allows another address to spend '_value' tokens on behalf of the sender.
  *
  * @param _spender The address of the account which will be approved for transfer of tokens.
  * @param _value The number of tokens to be approved for transfer.
  *
  * @return Whether the approval was successful or not.
  */
  function approve(address _spender, uint256 _value) public whenNotPausedOrWhitelisted returns (bool) {
    return super.approve(_spender, _value);
  }

  /**
  * @dev Makes the transfer function useable even when the contract is paused for authorized users.
  *
  * @param _to The target address to which the '_value' number of tokens will be sent.
  * @param _value The number of tokens to send.
  *
  * @return Whether the transfer was successful or not.
  */
  function transfer(address _to, uint256 _value) public whenNotPausedOrWhitelisted returns (bool) {
    return super.transfer(_to, _value);
  }

  /**
  * @dev Send '_value' tokens to '_to' from '_from' if '_from' has approved the operation.
  *
  * @param _from The address of the sender.
  * @param _to The address of the recipient.
  * @param _value The number of tokens to be transferred.
  *
  * @return Whether the transfer was successful or not.
  */
  function transferFrom(address _from, address _to, uint256 _value) public whenNotPausedOrWhitelisted returns (bool) {
    return super.transferFrom(_from, _to, _value);
  }

  /**
   * @dev Increase the amount of tokens that an owner allowed to a spender. We added only the modifier.
   *
   * approve should be called when allowed[_spender] == 0. To increment
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _addedValue The amount of tokens to increase the allowance by.
   */
  function increaseApproval(address _spender, uint _addedValue) public whenNotPausedOrWhitelisted returns (bool success) {
    return super.increaseApproval(_spender, _addedValue);
  }

  /**
   * @dev Decrease the amount of tokens that an owner allowed to a spender. We added only the modifier.
   *
   * approve should be called when allowed[_spender] == 0. To decrement
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _subtractedValue The amount of tokens to decrease the allowance by.
   */
  function decreaseApproval(address _spender, uint _subtractedValue) public whenNotPausedOrWhitelisted returns (bool success) {
    return super.decreaseApproval(_spender, _subtractedValue);
  }
}
