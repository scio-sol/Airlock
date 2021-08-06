// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.6;

import "./restrictedAccessContract.sol";

contract ChainVersionsContract is RestrictedAccessContract {
    bool public broken;
    address public nextVersion;

    constructor() {
        nextVersion = address(0);
    }

    function setNextVersion(address _contract) public isDeveloper {
        require(nextVersion == address(0), "Chain of versions is immutable");
        nextVersion = _contract;
    }

    function setBroken() public isDeveloper {
        broken = true;
    }
}