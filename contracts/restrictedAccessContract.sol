// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.7.3;

contract RestrictedAccessContract {
    address payable internal developer;

    event OwnerSet(address indexed oldDev, address indexed newDev);

    modifier isDeveloper() {
        require(msg.sender == developer, "Access restricted to the developer");
        _;
    }

    constructor() {
        developer = msg.sender;
    }

    function changeDev(address payable _newDev) public isDeveloper {
        emit OwnerSet(developer, _newDev);
        developer = _newDev;
    }
}