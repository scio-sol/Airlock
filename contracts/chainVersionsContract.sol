// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.7.3;

import "./restrictedAccessContract.sol";

contract ChainVersionsContract is RestrictedAccessContract {
    bool private broken;
    address private next;

    constructor() {
        next = address(0);
    }

    function nextVersion() public view returns (address) {
        return next;
    }

    function isBroken() public view returns (bool) {
        return broken;
    }

    function isLatest() public view returns (bool) {
        return next == address(0);
    }

    function setNextVersion(address _contract) public isDeveloper {
        require(isLatest(), "Chain of versions is immutable");
        next = _contract;
    }

    function setBroken() public isDeveloper {
        broken = true;
    }
}