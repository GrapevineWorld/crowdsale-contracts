pragma solidity ^0.4.23;

import "./GrapevineWhitelistInterface.sol";
import "openzeppelin-solidity/contracts/access/SignatureBouncer.sol";


/**
 * @title Grapevine Whitelist extends the zeppelin Whitelist and adding off-chain signing capabilities.
 * @dev Grapevine Crowdsale
 **/
contract GrapevineWhitelist is SignatureBouncer, GrapevineWhitelistInterface {

  event WhitelistedAddressAdded(address addr);
  event WhitelistedAddressRemoved(address addr);
  event UselessEvent(address addr, bytes sign, bool ret);

  mapping(address => bool) public whitelist;

  address crowdsale;

  constructor(address _signer) public {
    require(_signer != address(0));
    addBouncer(_signer);
  }

  modifier onlyOwnerOrCrowdsale() {
    require(msg.sender == owner || msg.sender == crowdsale);
    _;
  }

  /**
   * @dev Function to check if an address is whitelisted
   * @param _address address The address to be checked.
   */
  function whitelist(address _address) view external returns (bool) {
    return whitelist[_address];
  }
  
  /**
   * @dev Function to set the crowdsale address
   * @param _crowdsale address The address of the crowdsale.
   */
  function setCrowdsale(address _crowdsale) external onlyOwner {
    require(_crowdsale != address(0));
    crowdsale = _crowdsale;
  }

  /**
   * @dev Adds list of addresses to whitelist. Not overloaded due to limitations with truffle testing.
   * @param _beneficiaries Addresses to be added to the whitelist
   */
  function addAddressesToWhitelist(address[] _beneficiaries) external onlyOwnerOrCrowdsale {
    for (uint256 i = 0; i < _beneficiaries.length; i++) {
      addAddressToWhitelist(_beneficiaries[i]);
    }
  }

  /**
   * @dev Removes single address from whitelist.
   * @param _beneficiary Address to be removed to the whitelist
   */
  function removeAddressFromWhitelist(address _beneficiary) external onlyOwnerOrCrowdsale {
    whitelist[_beneficiary] = false;
    emit WhitelistedAddressRemoved(_beneficiary);
  }

  /**
   * @dev Handles the off-chain whitelisting.
   * @param _addr Address of the sender.
   * @param _sig signed message provided by the sender.
   */
  function handleOffchainWhitelisted(address _addr, bytes _sig) external onlyOwnerOrCrowdsale returns (bool) {
    bool valid;
    // no need for consuming gas when the address is already whitelisted 
    if (whitelist[_addr]) {
      valid = true;
    } else {
      valid = isValidSignature(_addr, _sig);
      if (valid) {
        // no need for consuming gas again if the address calls the contract again. 
        addAddressToWhitelist(_addr);
      }
    }
    return valid;
  }

  /**
   * @dev Adds single address to whitelist.
   * @param _beneficiary Address to be added to the whitelist
   */
  function addAddressToWhitelist(address _beneficiary) public onlyOwnerOrCrowdsale {
    whitelist[_beneficiary] = true;
    emit WhitelistedAddressAdded(_beneficiary);
  }
}