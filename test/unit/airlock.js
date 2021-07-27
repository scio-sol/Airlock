const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Airlock contract", async function() {
    var factory;
    var contract;
    var owner, bobby, alice, addrs;
    var options;
    var nextReady, nextId;
    var reversedAndThenMature;

    this.beforeAll(async () => {
        factory = await ethers.getContractFactory("Airlock");
        [owner, bobby, alice, ...addrs] = await ethers.getSigners();
        contractWithDelaysDone = await factory.deploy();
        options = { value: ethers.constants.WeiPerEther };
        await contractWithDelaysDone.setDelay(0);

        for(let i = 0; i < 50; i++)
        {
            await contractWithDelaysDone.connect(bobby).createTransaction(alice.address, options);
        }
        reversedAndThenMature = 1074;
        await contractWithDelaysDone.setDelay(2);
        await contractWithDelaysDone.connect(bobby).createTransaction(alice.address, options);
        await contractWithDelaysDone.connect(bobby).reverseTransaction(reversedAndThenMature);

        await contractWithDelaysDone.setDelay(24 * 3600);
        await new Promise(resolve => {
            setTimeout(resolve, 2000);
        });

        nextReady = 1024;
        nextId = 1075;

    });

    this.beforeEach(async () => {
        contract = await factory.deploy();
    });

    describe("Restricted functions", async () => {

        describe("Fees and delays", async () => {
            it("Should be able to return the correct fee", async () => {
                expect(await contract.fee()).to.equal(10 ** 15);
                expect(await contract.connect(bobby).fee()).to.equal(10 ** 15);
            });

            it("Should be able to set the fee", async () => {
                expect(await contract.fee()).to.equal(10 ** 15);
                expect(await contract.connect(bobby).fee()).to.equal(10 ** 15);
                contract.setFee(95);
                expect(await contract.fee()).to.equal(95);
                expect(await contract.connect(bobby).fee()).to.equal(95);
            });

            it("Should reject setFee requests by others than the dev", async () => {
                await expect(contract.connect(bobby).setFee(95)).to.be.reverted;
            });

            it("Should be able to return the correct delay", async () => {
                expect(await contract.delay()).to.equal(24 * 3600);
                expect(await contract.connect(bobby).delay()).to.equal(24 * 3600);
            });

            it("Should be able to set the delay", async () => {
                expect(await contract.delay()).to.equal(24 * 3600);
                expect(await contract.connect(bobby).delay()).to.equal(24 * 3600);
                contract.setDelay(1);
                expect(await contract.delay()).to.equal(1);
                expect(await contract.connect(bobby).delay()).to.equal(1);
            });

            it("Should reject setDelay requests by others than the dev", async () => {
                await expect(contract.connect(bobby).setDelay(1)).to.be.reverted;
            });

            it("Should come out of the constructor with the correct fee and delay", async () => {
                expect(await contract.fee()).to.equal(10 ** 15);
                expect(await contract.delay()).to.equal(24 * 3600);
            });
        });

        describe("Developer's money", async () => {
            it("Should be able to return the correct accumulated fee", async () => {
                expect(await contract.getDevMoney()).to.equal(0);
                await contract.connect(bobby).createTransaction(alice.address, options);
                expect(await contract.getDevMoney()).to.equal(await contract.fee());
                await contract.connect(bobby).createTransaction(alice.address, options);
                expect(await contract.getDevMoney()).to.equal(2 * (await contract.fee()));
            });

            it("Should reject getDevMoney requests by others than the dev", async () => {
                await expect(contract.connect(bobby).getDevMoney()).to.be.reverted;
            });

            it("Should be able to transfer the correct accumulated fee", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);
                await contract.connect(alice).createTransaction(bobby.address, options);
                await contract.connect(bobby).createTransaction(owner.address, options);
                await contract.connect(owner).createTransaction(bobby.address, options);

                var fees = await contract.getDevMoney();
                expect(await contract.retrieveDevMoney(fees)).to.changeEtherBalances([owner, contract], [fees, -fees]);
            });

            it("Should reject retrieveDevMoney requests by others than the dev", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);
                await contract.connect(alice).createTransaction(bobby.address, options);
                await contract.connect(bobby).createTransaction(owner.address, options);
                await contract.connect(owner).createTransaction(bobby.address, options);

                var fees = await contract.getDevMoney();
                await expect(contract.connect(bobby).retrieveDevMoney(fees)).to.be.reverted;
            });
        });
    });

    describe("Transactions", async () => {

        describe("Creating transactions", async () => {
            it("Should allow a regular transaction through", async () => {
                await expect(contract.connect(bobby).createTransaction(alice.address, options)).to.not.be.reverted;
                await contract.setFee(ethers.constants.WeiPerEther.sub(1));
                await expect(contract.connect(bobby).createTransaction(alice.address, options)).to.not.be.reverted;
            });

            it("Should revert a transaction that does not have enough funds to cover the fees", async () => {
                await expect(contract.connect(bobby).createTransaction(alice.address))
                      .to.be.revertedWith("Transaction amount is too small to cover the fees");
                await contract.setFee(ethers.constants.WeiPerEther.mul(2));
                await expect(contract.connect(bobby).createTransaction(alice.address, options))
                      .to.be.revertedWith("Transaction amount is too small to cover the fees");
            });

            it("Should revert transactions with the following destinations: address(0), msg.sender, address(this)", async () => {
                await expect(contract.connect(bobby).createTransaction(ethers.constants.AddressZero, options))
                      .to.be.revertedWith("It is not allowed to send transactions to address(0)");
                await expect(contract.connect(bobby).createTransaction(bobby.address, options))
                      .to.be.revertedWith("It is not allowed to send transactions with the sender as destination");
                await expect(contract.connect(bobby).createTransaction(contract.address, options))
                      .to.be.revertedWith("It is not allowed to send transactions with this contract as destination");
            });

            it("Should assign a valid tx id that is equal to (last used)+1", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                var [ooo, iii] = await contract.connect(bobby).myTransactions();
                expect(ooo.length).to.equal(1);
                expect(ooo[0]).to.equal(1024);



                await contract.connect(bobby).createTransaction(alice.address, options);
                await contract.connect(bobby).createTransaction(alice.address, options);
                await contract.connect(bobby).createTransaction(alice.address, options);

                [ooo, iii] = await contract.connect(bobby).myTransactions();
                expect(ooo.length).to.equal(4);
                expect(ooo[0]).to.equal(1024);
                expect(ooo[1]).to.equal(1025);
                expect(ooo[2]).to.equal(1026);
                expect(ooo[3]).to.equal(1027);

            });

            it("Should set all the internal data points correctly: origin, destination, amount, delay; paid & reversed should be false", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);
                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1024);



                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);

                var block = await ethers.provider.getBlock();
                expect(maturity).to.equal(block.timestamp + 24 * 3600);

                expect(amount).to.equal(ethers.constants.WeiPerEther.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should set both indices correctly", async () => {
                await contract.connect(bobby).createTransaction(alice.address, options);

                [id] = await contract.connect(bobby).myTransactions();
                [id_alice_pov] = await contract.connect(alice).myTransactions();

                expect(id.length).to.equal(1);
                expect(id[0]).to.equal(1024);

                expect(id_alice_pov.length).to.equal(1);
                expect(id_alice_pov[0]).to.equal(1024);
            });

            it("Should add the fee to the devMoney", async () => {
                var f = await contract.getDevMoney();

                await contract.connect(bobby).createTransaction(alice.address, options);

                f += await contract.fee();

                expect(f).to.equal(await contract.getDevMoney());
            });

            it("Should not add the fee to the tx struct", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);
                
                amount = options.value.sub(await contract.fee());
                
                var t = await contract.connect(bobby).getTransaction(1024);

                expect(t[3]).to.equal(amount);

            });

            it("Should have an amount of funds that is always the devMoney plus all the pending txs", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                var bal = await ethers.provider.getBalance(contract.address);
                
                bal = bal.sub(await contract.getDevMoney());
                
                var t = await contract.connect(bobby).getTransaction(1024);
                bal = bal.sub(t[3]);
                
                expect(bal).to.equal(0);

            });

            it("Should not work anymore with broken==true", async () => {

                var newContract = await factory.deploy();

                await newContract.setBroken();

                await expect(newContract.connect(bobby).createTransaction(alice.address, options)).to.be.reverted;

            });
        });

        describe("Reversing transactions", async () => {

            it("Should reverse a transaction when called by the sender", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);
                
                var contract_balance_before = await ethers.provider.getBalance(contract.address);
                var bobby_balance_before = await ethers.provider.getBalance(bobby.address);
                var alice_balance_before = await ethers.provider.getBalance(alice.address);
                var devMoneyBefore = await contract.getDevMoney();
                
                var t = await contract.connect(bobby).getTransaction(1024);

                await contract.connect(bobby).reverseTransaction(1024);

                var contract_balance_after = await ethers.provider.getBalance(contract.address);
                var bobby_balance_after = await ethers.provider.getBalance(bobby.address);
                var alice_balance_after = await ethers.provider.getBalance(alice.address);
                var devMoneyAfter = await contract.getDevMoney();

                expect(contract_balance_after).to.be.equal(contract_balance_before.sub(t[3]));
                expect(bobby_balance_after.sub(t[3])).to.be.closeTo(bobby_balance_before, ethers.constants.WeiPerEther.div(10));
                expect(alice_balance_after).to.be.equal(alice_balance_before);
                expect(devMoneyAfter).to.be.equal(devMoneyBefore);
                
            });

            it("Should update the tx reversed boolean and nothing else in the struct", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);
                
                var t = await contract.connect(bobby).getTransaction(1024);

                await contract.connect(bobby).reverseTransaction(1024);

                var t2 = await contract.connect(bobby).getTransaction(1024);

                expect(t2[0]).to.be.equal(t[0]);
                expect(t2[1]).to.be.equal(t[1]);
                expect(t2[2]).to.be.equal(t[2]);
                expect(t2[3]).to.be.equal(t[3]);
                expect(t2[4]).to.be.equal(t[4]);

                expect(t2[5]).to.be.true;
                expect(t[5]).to.be.false;
                
            });

            it("Should refuse to reverse a transaction when called by the sender after maturity", async () => {

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(bobby).reverseTransaction(n)).to.be.revertedWith("Transaction has already reached maturity");

            });

            it("Should reverse a transaction when called by the receiver", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                await expect(contract.connect(alice).reverseTransaction(1024)).to.not.be.reverted;

            });

            it("Should refuse to reverse a transaction when called by the sender after maturity", async () => {

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(alice).reverseTransaction(n)).to.be.revertedWith("Transaction has already reached maturity");

            });

            it("Should refuse to reverse a transaction when called by other than sender or receiver", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                await expect(contract.connect(addrs[0]).reverseTransaction(1024)).to.be.revertedWith("Not autorized");
            });

            it("Should especially refuse to reverse a transaction when called by the developer", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                await expect(contract.reverseTransaction(1024)).to.be.revertedWith("Not autorized");

            });

            it("Should refuse to reverse a transaction when already reversed", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                await expect(contract.connect(bobby).reverseTransaction(1024)).to.not.be.reverted;
                await expect(contract.connect(alice).reverseTransaction(1024)).to.be.reverted;

            });

            it("Should refuse to reverse a transaction when already finished", async () => {
                
                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(bobby).finishTransaction(n)).to.not.be.reverted;
                await expect(contractWithDelaysDone.connect(alice).reverseTransaction(n)).to.be.reverted;

            });

            it("Should still work with broken==true", async () => {

                var newContract = await factory.deploy();

                await newContract.connect(bobby).createTransaction(alice.address, options);

                await newContract.setBroken();

                await expect(newContract.connect(bobby).reverseTransaction(1024)).to.not.be.reverted;

            });

        });

        describe("Finishing transactions", async () => {

            it("Should finish a transaction, if called by the sender", async () => {

                var n = nextReady;
                nextReady++;

                var contract_balance_before = await ethers.provider.getBalance(contractWithDelaysDone.address);
                var bobby_balance_before = await ethers.provider.getBalance(bobby.address);
                var alice_balance_before = await ethers.provider.getBalance(alice.address);
                var devMoneyBefore = await contractWithDelaysDone.getDevMoney();
                
                var t = await contractWithDelaysDone.connect(bobby).getTransaction(n);

                await contractWithDelaysDone.connect(bobby).finishTransaction(n);

                var contract_balance_after = await ethers.provider.getBalance(contractWithDelaysDone.address);
                var bobby_balance_after = await ethers.provider.getBalance(bobby.address);
                var alice_balance_after = await ethers.provider.getBalance(alice.address);
                var devMoneyAfter = await contractWithDelaysDone.getDevMoney();

                expect(contract_balance_after).to.be.equal(contract_balance_before.sub(t[3]));
                expect(bobby_balance_after).to.be.closeTo(bobby_balance_before, ethers.constants.WeiPerEther.div(10));
                expect(alice_balance_after.sub(t[3])).to.be.equal(alice_balance_before);
                expect(devMoneyAfter).to.be.equal(devMoneyBefore);

            });

            it("Should update the tx paid boolean and nothing else in the struct", async () => {

                var n = nextReady;
                nextReady++;

                var t = await contractWithDelaysDone.connect(bobby).getTransaction(n);

                await contractWithDelaysDone.connect(bobby).finishTransaction(n);

                var t2 = await contractWithDelaysDone.connect(bobby).getTransaction(n);

                expect(t2[0]).to.be.equal(t[0]);
                expect(t2[1]).to.be.equal(t[1]);
                expect(t2[2]).to.be.equal(t[2]);
                expect(t2[3]).to.be.equal(t[3]);

                expect(t2[4]).to.be.true;
                expect(t[4]).to.be.false;

                expect(t2[5]).to.be.equal(t[4]);

            });

            it("Should refuse to finish a transaction called by the sender, if before maturity", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                await expect(contract.connect(bobby).finishTransaction(1024)).to.be.revertedWith("Transaction has not yet reached maturity");

            });

            it("Should finish a transaction, if called by the receiver", async () => {

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(alice).finishTransaction(n)).to.not.be.reverted;

            });

            it("Should refuse to finish a transaction called by the receiver, if before maturity", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                await expect(contract.connect(alice).finishTransaction(1024)).to.be.revertedWith("Transaction has not yet reached maturity");

            });

            it("Should refuse to finish a transaction when called by other than sender or receiver", async () => {

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(addrs[0]).finishTransaction(n)).to.be.revertedWith("Not autorized");

            });

            it("Should especially refuse to finish a transaction when called by the developer", async () => {

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.finishTransaction(n)).to.be.revertedWith("Not autorized");

            });

            it("Should refuse to finish a transaction twice", async () => {

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(alice).finishTransaction(n)).to.not.be.reverted;
                await expect(contractWithDelaysDone.connect(alice).finishTransaction(n)).to.be.revertedWith("Transaction was resolved already");

            });

            it("Should refuse to finish a transaction that was reversed", async () => {

                await expect(contractWithDelaysDone.connect(alice).finishTransaction(reversedAndThenMature)).to.be.revertedWith("Transaction was resolved already");

            });

            it("Should still work with broken==true", async () => {

                var newContract = await factory.deploy();

                await newContract.setDelay(0);
                await newContract.connect(bobby).createTransaction(alice.address, options);

                await newContract.setBroken();

                await expect(newContract.connect(bobby).finishTransaction(1024)).to.not.be.reverted;

            });

        });

        describe("Viewing transactions", async () => {

            it("Should return all transactions when myTransactions called", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                var [id, origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).myTransactions();

                expect(id).to.not.be.undefined;
                expect(id.length).to.be.equal(1);
                expect(id[0]).to.be.equal(1024);

                expect(origin).to.not.be.undefined;
                expect(origin.length).to.be.equal(1);
                expect(origin[0]).to.be.equal(bobby.address);

                expect(destination).to.not.be.undefined;
                expect(destination.length).to.be.equal(1);
                expect(destination[0]).to.be.equal(alice.address);

                expect(maturity).to.not.be.undefined;
                expect(maturity.length).to.be.equal(1);
                var block = await ethers.provider.getBlock();
                expect(maturity[0]).to.be.closeTo(ethers.BigNumber.from(24 * 3600).add(block.timestamp), 1000);

                expect(amount).to.not.be.undefined;
                expect(amount.length).to.be.equal(1);
                expect(amount[0]).to.be.equal(options.value.sub(await contract.fee()));

                expect(paid).to.not.be.undefined;
                expect(paid.length).to.be.equal(1);
                expect(paid[0]).to.be.equal(false);

                expect(reversed).to.not.be.undefined;
                expect(reversed.length).to.be.equal(1);
                expect(reversed[0]).to.be.equal(false);
                
                await contract.connect(bobby).createTransaction(alice.address, options);
                await contract.connect(alice).createTransaction(bobby.address, options);

                [, origin, , , , , ] = await contract.connect(bobby).myTransactions();

                expect(origin).to.not.be.undefined;
                expect(origin.length).to.be.equal(3);
                expect(origin[0]).to.be.equal(bobby.address);
                expect(origin[1]).to.be.equal(bobby.address);
                expect(origin[2]).to.be.equal(alice.address);

            });

            it("Should not return any transaction when myTransactions called from a third party", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                var [, origin] = await contract.connect(addrs[0]).myTransactions();

                expect(origin).to.not.be.undefined;
                expect(origin.length).to.be.equal(0);
                
                await contract.connect(bobby).createTransaction(alice.address, options);
                await contract.connect(alice).createTransaction(bobby.address, options);

                [, origin] = await contract.connect(addrs[0]).myTransactions();

                expect(origin).to.not.be.undefined;
                expect(origin.length).to.be.equal(0);

            });

            it("Should not return any transaction when myTransactions called from the developer", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                var [, origin] = await contract.myTransactions();

                expect(origin).to.not.be.undefined;
                expect(origin.length).to.be.equal(0);
                
                await contract.connect(bobby).createTransaction(alice.address, options);
                await contract.connect(alice).createTransaction(bobby.address, options);

                [, origin] = await contract.myTransactions();

                expect(origin).to.not.be.undefined;
                expect(origin.length).to.be.equal(0);

            });

            it("Should still return the transaction when reversed and myTransactions called", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);
                await expect(contract.connect(bobby).reverseTransaction(1024)).to.not.be.reverted;

                var [, , , , , , reversed] = await contract.connect(bobby).myTransactions();

                expect(reversed.length).to.be.equal(1);
                expect(reversed[0]).to.be.true;

            });

            it("Should still return the transaction when ready to finish and myTransactions called", async () => {
                
                var n = nextReady;
                nextReady++;

                var [, , , , , paid, reversed] = await contractWithDelaysDone.connect(bobby).myTransactions();

                expect(paid.length).to.be.equal(nextId - 1024);
                expect(paid[n - 1024]).to.be.false;
                expect(reversed[n - 1024]).to.be.false;

            });

            it("Should still return the transaction when finished and myTransactions called", async () => {

                var n = nextReady;
                nextReady++;

                await contractWithDelaysDone.connect(bobby).finishTransaction(n);
                var [, , , , , paid, ] = await contractWithDelaysDone.connect(bobby).myTransactions();

                expect(paid.length).to.be.equal(nextId - 1024);
                expect(paid[n - 1024]).to.be.true;

            });

            it("Should return the new transaction by when called by id from the sender", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(24 * 3600).add(block.timestamp), 1000);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

                await contract.connect(bobby).createTransaction(addrs[0].address, options);

                [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1025);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(addrs[0].address);
                block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(24 * 3600).add(block.timestamp), 1000);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should not modify other transactions", async () => {

                await contract.connect(bobby).createTransaction(alice.address,  options);

                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(24 * 3600).add(block.timestamp), 1000);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

                await contract.connect(bobby).createTransaction(addrs[0].address, options);

                [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(24 * 3600).add(block.timestamp), 1000);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should return the new transaction when called from the receiver", async () => {
                
                await contract.connect(bobby).createTransaction(alice.address, options);

                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(alice).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(24 * 3600).add(block.timestamp), 1000);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should not return the new transaction when called from a third party", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                await expect(contract.connect(addrs[0]).getTransaction(1024)).to.be.revertedWith("Not authorized");

            });

            it("Should not return the new transaction when called from the developer", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);

                await expect(contract.getTransaction(1024)).to.be.revertedWith("Not authorized");

            });

            it("Should still return the transaction when reversed", async () => {

                await contract.connect(bobby).createTransaction(alice.address, options);
                await contract.connect(bobby).reverseTransaction(1024);

                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(alice).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(24 * 3600).add(block.timestamp), 1000);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.true;

            });

            it("Should still return the transaction when ready to finish", async () => {

                var n = nextReady;
                nextReady++;

                var [origin, destination, maturity, amount, paid, reversed] = await contractWithDelaysDone.connect(alice).getTransaction(n);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(2).add(block.timestamp), 1000);
                expect(amount).to.equal(options.value.sub(await contractWithDelaysDone.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should still return the transaction when finished", async () => {

                var n = nextReady;
                nextReady++;

                await contractWithDelaysDone.connect(bobby).finishTransaction(n);

                var [origin, destination, maturity, amount, paid, reversed] = await contractWithDelaysDone.connect(alice).getTransaction(n);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(2).add(block.timestamp), 1000);
                expect(amount).to.equal(options.value.sub(await contractWithDelaysDone.fee()));
                expect(paid).to.be.true;
                expect(reversed).to.be.false;

            });

        });
    });

    describe("receive() function", async () => {

        it("Should accept a transaction from the developer", async () => {
            await expect(owner.sendTransaction({ to: contract.address, value: ethers.constants.WeiPerEther })).to.not.be.reverted;
        });

        it("Should not accept a transaction from other parties", async () => {
            await expect(bobby.sendTransaction({ to: contract.address, value: ethers.constants.WeiPerEther })).to.be.reverted;
        });

        it("Should update the devMoney value when received a transaction from the developer", async () => {

            var v = await contract.getDevMoney();
            await owner.sendTransaction({ to: contract.address, value: ethers.constants.WeiPerEther });

            expect(await contract.getDevMoney()).to.equal(ethers.constants.WeiPerEther.add(v));

        });

        it("Should update the balance when received a transaction from the developer", async () => {

            var v = await ethers.provider.getBalance(contract.address);
            await owner.sendTransaction({ to: contract.address, value: ethers.constants.WeiPerEther });

            expect(await ethers.provider.getBalance(contract.address)).to.equal(ethers.constants.WeiPerEther.add(v));

        });

        it("Should not update the devMoney value or the balance when received a transaction from others", async () => {

            var v = await contract.getDevMoney();
            var v2 = await ethers.provider.getBalance(contract.address);
            await expect(bobby.sendTransaction({ to: contract.address, value: ethers.constants.WeiPerEther })).to.be.reverted;

            expect(await contract.getDevMoney()).to.equal(v);
            expect(await ethers.provider.getBalance(contract.address)).to.equal(v2);

        });
    });
});