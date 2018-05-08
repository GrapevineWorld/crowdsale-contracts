pragma solidity 0.4.23;

import "./PausableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";


/**
 * @title Grapevine Token
 * @dev Grapevine Token
 **/
contract GrapevineToken is DetailedERC20, BurnableToken, PausableToken {

  constructor() DetailedERC20("GRAPE", "GRAPE", 18) public {
    totalSupply_ = 3676401383 * (10 ** uint256(decimals)); // Update total supply with the decimal amount
    balances[msg.sender] = totalSupply_;
    emit Transfer(address(0), msg.sender, totalSupply_);
    addAddressToWhitelist(msg.sender);
    pause();
  }

  // -----------------------------------------------------------------------
  // Don't accept ETH
  // -----------------------------------------------------------------------
  function () public payable {
    revert();
  }

  /**
  * @dev burns the provided the _value, can be used only by Authorized Users.
  * @param _value The value of the tokens to be burnt.
  */
  function burn(uint256 _value) public onlyWhitelisted {
    super.burn(_value);
  }
}
