pragma solidity ^0.4.23;

/**
 * @title Grapevine Whitelist extends the zeppelin Whitelist and adding off-chain signing capabilities.
 * @dev Grapevine Crowdsale
 **/

contract GrapevineWhitelistInterface {

  /**
   * @dev Function to check if an address is whitelisted or not
   * @param _address address The address to be checked.
   */
  function whitelist(address _address) view external returns (bool);

  /**
   * @dev Handles the off-chain whitelisting.
   * @param _addr Address of the sender.
   * @param _sig signed message provided by the sender.
   */
  function handleOffchainWhitelisted(address _addr, bytes _sig) external returns (bool);
}