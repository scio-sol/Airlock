// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.7.3;

import "./chainVersionsContract.sol";
import "./restrictedAccessContract.sol";

contract Airlock is RestrictedAccessContract, ChainVersionsContract {

    struct transaction {
        address payable origin;
        address payable destination;
        uint256 maturity;
        uint256 amount;
        bool paid;
        bool reversed;
    }

    uint256 private devMoney;
    uint256 public fee;
    uint256 public delay;
    uint256 private nonce;
    mapping ( address => uint256[] ) private idByOrigin;
    mapping ( address => uint256[] ) private idByDestination;
    mapping ( uint256 => transaction ) private transactions;

    constructor() {
        fee = 10 ** 15;
        delay = 24 * 3600;
        nonce = 1024;
    }

    function setFee(uint256 _amount) external isDeveloper {
        fee = _amount;
    }

    function setDelay(uint256 _amount) external isDeveloper {
        delay = _amount;
    }

    function getDevMoney() external view isDeveloper returns (uint256) {
        return devMoney;
    }

    function retrieveDevMoney(uint256 _amount) external isDeveloper {
        require(_amount <= devMoney, "Not enough money");
        devMoney -= _amount;
        msg.sender.transfer(_amount);
    }

    function createTransaction(address payable _destination) public payable {

        require(msg.value > fee, "Transaction amount is too small to cover the fees");
        require(!broken, "This version of Airlock is considered broken (or vulnerable) and will not accept any new transactions");
        require(_destination != address(0), "It is not allowed to send transactions to address(0)"); // Likely a mistake by the user
        require(_destination != msg.sender, "It is not allowed to send transactions with the sender as destination"); // Likely a mistake by the user
        require(_destination != address(this), "It is not allowed to send transactions with this contract as destination"); // No way to recover this funds

        transaction storage t = transactions[nonce];
        t.origin = msg.sender;
        t.destination = _destination;
        t.maturity = block.timestamp + delay;
        t.amount = msg.value - fee;
        idByOrigin[msg.sender].push(nonce);
        idByDestination[_destination].push(nonce);
        devMoney += fee;
        nonce++;

    }

    function reverseTransaction(uint256 id) public {

        transaction memory t = transactions[id];

        require(msg.sender == t.origin ||
                msg.sender == t.destination, "Not autorized");
        require(block.timestamp < t.maturity, "Transaction has already reached maturity");
        require(!t.paid && !t.reversed, "Transaction was resolved already");

        transactions[id].reversed = true;

        t.origin.transfer(t.amount);

    }

    function finishTransaction(uint256 id) public {

        transaction memory t = transactions[id];

        require(msg.sender == t.origin ||
                msg.sender == t.destination, "Not autorized");
        require(block.timestamp >= t.maturity, "Transaction has not yet reached maturity");
        require(!t.paid && !t.reversed, "Transaction was resolved already");

        transactions[id].paid = true;

        t.destination.transfer(t.amount);

    }

    function myTransactions() public view
        returns (
            uint256[] memory id,
            address[] memory origin,
            address[] memory destination,
            uint256[] memory maturity,
            uint256[] memory amount,
            bool[] memory paid,
            bool[] memory reversed
        )
    {

        uint256 len = idByOrigin[msg.sender].length;
        uint256 len2 = idByDestination[msg.sender].length;

        id = new uint256[](len + len2);
        origin = new address[](len + len2);
        destination = new address[](len + len2);
        maturity = new uint256[](len + len2);
        amount = new uint256[](len + len2);
        paid = new bool[](len + len2);
        reversed = new bool[](len + len2);

        for(uint256 i = 0; i < len; i++)
        {
            id[i] = idByOrigin[msg.sender][i];
            origin[i] = (transactions[idByOrigin[msg.sender][i]].origin);
            destination[i] = (transactions[idByOrigin[msg.sender][i]].destination);
            maturity[i] = (transactions[idByOrigin[msg.sender][i]].maturity);
            amount[i] = (transactions[idByOrigin[msg.sender][i]].amount);
            paid[i] = (transactions[idByOrigin[msg.sender][i]].paid);
            reversed[i] = (transactions[idByOrigin[msg.sender][i]].reversed);
        }
        for(uint256 i = 0; i < len2; i++)
        {
            id[i + len] = idByDestination[msg.sender][i];
            origin[i + len] = (transactions[idByDestination[msg.sender][i]].origin);
            destination[i + len] = (transactions[idByDestination[msg.sender][i]].destination);
            maturity[i + len] = (transactions[idByDestination[msg.sender][i]].maturity);
            amount[i + len] = (transactions[idByDestination[msg.sender][i]].amount);
            paid[i + len] = (transactions[idByDestination[msg.sender][i]].paid);
            reversed[i + len] = (transactions[idByDestination[msg.sender][i]].reversed);
        }
        
        return (
            id,
            origin,
            destination,
            maturity,
            amount,
            paid,
            reversed
        );

    }

    function getTransaction(uint256 id) public view 
        returns (
            address origin,
            address destination,
            uint256 maturity,
            uint256 amount,
            bool paid,
            bool reversed
        )
    {
        require(msg.sender == transactions[id].origin || msg.sender == transactions[id].destination,
                "Not authorized");

        return (
            transactions[id].origin,
            transactions[id].destination,
            transactions[id].maturity,
            transactions[id].amount,
            transactions[id].paid,
            transactions[id].reversed
        );
    }

    receive() external isDeveloper payable {
        devMoney += msg.value;
    }
}