// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.7.3;

contract RestrictedAccessContract {
    address payable private developer;

    event OwnerSet(address indexed oldDev, address indexed newDev);

    modifier isDeveloper() {
        require(msg.sender == developer, "Access denied: not the dev");
        _;
    }

    constructor() {
        developer = msg.sender;
    }

    function amITheDev() public view returns (bool) {
        return developer == msg.sender;
    }

    function getDev() public view returns (address) {
        return developer;
    }

    function changeDev(address payable _newDev) public isDeveloper {
        emit OwnerSet(developer, _newDev);
        developer = _newDev;
    }
}