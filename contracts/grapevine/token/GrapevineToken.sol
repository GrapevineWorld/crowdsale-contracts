pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";


/**
 * @title Grapevine Token
 * @dev Grapevine Token
 **/
contract GrapevineToken is DetailedERC20, BurnableToken, StandardToken, Ownable {

  constructor() DetailedERC20("GVINE", "GVINE", 18) public {
    totalSupply_ = 825000000 * (10 ** uint256(decimals)); // Update total supply with the decimal amount
    balances[msg.sender] = totalSupply_;
    emit Transfer(address(0), msg.sender, totalSupply_);
  }

  /**
  * @dev burns the provided the _value, can be used only by the owner of the contract.
  * @param _value The value of the tokens to be burnt.
  */
  function burn(uint256 _value) public onlyOwner {
    super.burn(_value);
  }
}
