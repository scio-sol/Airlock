// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

contract moot {
    string greeting;

    constructor(string memory _greeting) {
        greeting = _greeting;
    }

    function greetMe() public view returns (string memory) {
        return greeting;
    }

    function changeGreeting(string memory _str) public {
        greeting = _str;
    }
}