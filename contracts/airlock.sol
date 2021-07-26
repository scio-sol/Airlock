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

    function reverseTransaction(uint256 _id) public {

        require((msg.sender == transactions[_id].origin && block.timestamp < transactions[_id].maturity) || 
                (msg.sender == transactions[_id].destination),
                "Not autorized for reversal");
        require(!transactions[_id].paid && !transactions[_id].reversed, "Transaction was resolved already");

        transactions[_id].reversed = true;

        transactions[_id].origin.transfer(transactions[_id].amount);

    }

    function finishTransaction(uint256 _id) public {

        transaction memory t = transactions[_id];

        require(msg.sender == t.origin ||
                msg.sender == t.destination, "Not autorized");
        require(block.timestamp >= t.maturity, "Transaction has not yet reached maturity");
        require(!t.paid && !t.reversed, "Transaction was resolved already");

        transactions[_id].paid = true;

        t.destination.transfer(t.amount);

    }

    function myTransactions() public view returns (uint256[] memory, uint256[] memory) {

        return (idByOrigin[msg.sender], idByDestination[msg.sender]);

    }

    function getTransaction(uint256 _id) public view 
        returns (
            address origin,
            address destination,
            uint256 maturity,
            uint256 amount,
            bool paid,
            bool reversed
        )
    {
        require(msg.sender == transactions[_id].origin || msg.sender == transactions[_id].destination,
                "Not authorized");

        return (
            transactions[_id].origin,
            transactions[_id].destination,
            transactions[_id].maturity,
            transactions[_id].amount,
            transactions[_id].paid,
            transactions[_id].reversed
        );
    }

    receive() external isDeveloper payable {
        devMoney += msg.value;
    }
}