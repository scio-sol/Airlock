const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Airlock contract", async function() {
    var factory;
    var contract;
    var owner, bobby, alice, addrs;
    var options;
    var nextReady, nextId;

    this.beforeAll(async () => {
        factory = await ethers.getContractFactory("Airlock");
        [owner, bobby, alice, ...addrs] = await ethers.getSigners();
        contractWithDelaysDone = await factory.deploy();
        options = { value: ethers.constants.WeiPerEther };
        await contractWithDelaysDone.setMinDelay(0);

        for(let i = 0; i < 50; i++)
        {
            await contractWithDelaysDone.connect(bobby).createTransaction(alice.address, 2, options);
        }

        await contractWithDelaysDone.setMinDelay(24 * 3600);
        await new Promise(resolve => {
            setTimeout(resolve, 2000);
        });

        nextReady = 1024;
        nextId = 1074;

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

            it("Should be able to return the correct minimum delay", async () => {
                expect(await contract.minDelay()).to.equal(24 * 3600);
                expect(await contract.connect(bobby).minDelay()).to.equal(24 * 3600);
            });

            it("Should be able to set the minimum delay", async () => {
                expect(await contract.minDelay()).to.equal(24 * 3600);
                expect(await contract.connect(bobby).minDelay()).to.equal(24 * 3600);
                contract.setMinDelay(1);
                expect(await contract.minDelay()).to.equal(1);
                expect(await contract.connect(bobby).minDelay()).to.equal(1);
            });

            it("Should reject setMinDelay requests by others than the dev", async () => {
                await expect(contract.connect(bobby).setMinDelay(1)).to.be.reverted;
            });

            it("Should come out of the constructor with the correct fee and delay", async () => {
                expect(await contract.fee()).to.equal(10 ** 15);
                expect(await contract.minDelay()).to.equal(24 * 3600);
            });
        });

        describe("Developer's money", async () => {
            it("Should be able to return the correct accumulated fee", async () => {
                expect(await contract.getDevMoney()).to.equal(0);
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                expect(await contract.getDevMoney()).to.equal(await contract.fee());
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                expect(await contract.getDevMoney()).to.equal(2 * (await contract.fee()));
            });

            it("Should reject getDevMoney requests by others than the dev", async () => {
                await expect(contract.connect(bobby).getDevMoney()).to.be.reverted;
            });

            it("Should be able to transfer the correct accumulated fee", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(alice).createTransaction(bobby.address, 48 * 3600, options);
                await contract.connect(bobby).createTransaction(owner.address, 48 * 3600, options);
                await contract.connect(owner).createTransaction(bobby.address, 48 * 3600, options);

                var fees = await contract.getDevMoney();
                expect(await contract.retrieveDevMoney(fees)).to.changeEtherBalances([owner, contract], [fees, -fees]);
            });

            it("Should reject retrieveDevMoney requests by others than the dev", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(alice).createTransaction(bobby.address, 48 * 3600, options);
                await contract.connect(bobby).createTransaction(owner.address, 48 * 3600, options);
                await contract.connect(owner).createTransaction(bobby.address, 48 * 3600, options);

                var fees = await contract.getDevMoney();
                await expect(contract.connect(bobby).retrieveDevMoney(fees)).to.be.reverted;
            });
        });
    });

    describe("Transactions", async () => {

        describe("Creating transactions", async () => {
            it("Should allow a regular transaction through", async () => {
                await expect(contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options)).to.not.be.reverted;
                await contract.setFee(ethers.constants.WeiPerEther.sub(1));
                await expect(contract.connect(bobby).createTransaction(alice.address, 24 * 3600, options)).to.not.be.reverted;
            });

            it("Should revert a transaction that does not have enough funds to cover the fees", async () => {
                await expect(contract.connect(bobby).createTransaction(alice.address, 48 * 3600))
                      .to.be.revertedWith("Transaction amount is too small to cover the fees");
                await contract.setFee(ethers.constants.WeiPerEther.mul(2));
                await expect(contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options))
                      .to.be.revertedWith("Transaction amount is too small to cover the fees");
            });

            it("Should revert a transaction that is not delayed enough", async () => {
                await expect(contract.connect(bobby).createTransaction(alice.address, 86399, options))
                      .to.be.revertedWith("Transaction delay is smaller than the minimum");
            });

            it("Should revert transactions with the following destinations: address(0), msg.sender, address(this)", async () => {
                await expect(contract.connect(bobby).createTransaction(ethers.constants.AddressZero, 48 * 3600, options))
                      .to.be.revertedWith("It is not allowed to send transactions to address(0)");
                await expect(contract.connect(bobby).createTransaction(bobby.address, 48 * 3600, options))
                      .to.be.revertedWith("It is not allowed to send transactions with the sender as destination");
                await expect(contract.connect(bobby).createTransaction(contract.address, 48 * 3600, options))
                      .to.be.revertedWith("It is not allowed to send transactions with this contract as destination");
            });

            it("Should assign a valid tx id that is equal to (last used)+1", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [ooo, iii] = await contract.connect(bobby).myTransactions();
                expect(ooo.length).to.equal(1);
                expect(ooo[0]).to.equal(1024);



                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                [ooo, iii] = await contract.connect(bobby).myTransactions();
                expect(ooo.length).to.equal(4);
                expect(ooo[0]).to.equal(1024);
                expect(ooo[1]).to.equal(1025);
                expect(ooo[2]).to.equal(1026);
                expect(ooo[3]).to.equal(1027);

            });

            it("Should set all the internal data points correctly: origin, destination, amount, delay; paid & reversed should be false", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1024);



                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);

                var block = await ethers.provider.getBlock();
                expect(maturity).to.equal(block.timestamp + 48 * 3600);

                expect(amount).to.equal(ethers.constants.WeiPerEther.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should set both indices correctly", async () => {
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                [os, is] = await contract.connect(bobby).myTransactions();
                [od, id] = await contract.connect(alice).myTransactions();

                expect(os.length).to.equal(1);
                expect(is.length).to.equal(0);
                expect(os[0]).to.equal(1024);

                expect(od.length).to.equal(0);
                expect(id.length).to.equal(1);
                expect(id[0]).to.equal(1024);
            });

            it("Should add the fee to the devMoney", async () => {
                var f = await contract.getDevMoney();

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                f += await contract.fee();

                expect(f).to.equal(await contract.getDevMoney());
            });

            it("Should not add the fee to the tx struct", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                
                amount = options.value.sub(await contract.fee());
                
                var t = await contract.connect(bobby).getTransaction(1024);

                expect(t[3]).to.equal(amount);

            });

            it("Should have an amount of funds that is always the devMoney plus all the pending txs", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var bal = await ethers.provider.getBalance(contract.address);
                
                bal = bal.sub(await contract.getDevMoney());
                
                var t = await contract.connect(bobby).getTransaction(1024);
                bal = bal.sub(t[3]);
                
                expect(bal).to.equal(0);

            });
        });

        describe("Reversing transactions", async () => {

            it("Should reverse a transaction when called by the sender", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                
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

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                
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

                await expect(contractWithDelaysDone.connect(bobby).reverseTransaction(n)).to.be.revertedWith("Not autorized for reversal");

            });

            it("Should reverse a transaction when called by the receiver", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                await expect(contract.connect(alice).reverseTransaction(1024)).to.not.be.reverted;

            });

            it("Should reverse a transaction when called by the receiver after maturity", async () => {

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(alice).reverseTransaction(n)).to.not.be.reverted;

            });

            it("Should refuse to reverse a transaction when called by other than sender or receiver", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                await expect(contract.connect(addrs[0]).reverseTransaction(1024)).to.be.revertedWith("Not autorized for reversal");
            });

            it("Should especially refuse to reverse a transaction when called by the developer", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                await expect(contract.reverseTransaction(1024)).to.be.revertedWith("Not autorized for reversal");

            });

            it("Should refuse to reverse a transaction when already reversed", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                await expect(contract.connect(alice).reverseTransaction(1024)).to.not.be.reverted;
                await expect(contract.connect(alice).reverseTransaction(1024)).to.be.revertedWith("Transaction was resolved already");

            });

            it("Should refuse to reverse a transaction when already finished", async () => {
                
                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(alice).finishTransaction(n)).to.not.be.reverted;
                await expect(contractWithDelaysDone.connect(alice).reverseTransaction(n)).to.be.revertedWith("Transaction was resolved already");

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

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                await expect(contract.connect(bobby).finishTransaction(1024)).to.be.revertedWith("Transaction has not yet reached maturity");

            });

            it("Should finish a transaction, if called by the receiver", async () => {

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(alice).finishTransaction(n)).to.not.be.reverted;

            });

            it("Should refuse to finish a transaction called by the receiver, if before maturity", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

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

                var n = nextReady;
                nextReady++;

                await expect(contractWithDelaysDone.connect(alice).reverseTransaction(n)).to.not.be.reverted;

                await expect(contractWithDelaysDone.connect(alice).finishTransaction(n)).to.be.revertedWith("Transaction was resolved already");

            });

        });

        describe("Viewing transactions", async () => {

            it("Should return the new transaction when called from the sender", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [o1, i1] = await contract.connect(bobby).myTransactions();

                expect(o1).to.not.be.undefined;
                expect(o1.length).to.be.equal(1);
                expect(o1[0]).to.be.equal(1024);
                
                expect(i1).to.not.be.undefined;
                expect(i1.length).to.be.equal(0);

                
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(alice).createTransaction(bobby.address, 48 * 3600, options);

                [o1, i1] = await contract.connect(bobby).myTransactions();

                expect(o1).to.not.be.undefined;
                expect(o1.length).to.be.equal(2);
                expect(o1[0]).to.be.equal(1024);
                expect(o1[1]).to.be.equal(1025);
                
                expect(i1).to.not.be.undefined;
                expect(i1.length).to.be.equal(1);
                expect(i1[0]).to.be.equal(1026);

            });

            it("Should not modify the other array", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [o1, i1] = await contract.connect(bobby).myTransactions();

                expect(o1.length).to.be.equal(1);
                expect(o1[0]).to.be.equal(1024);

                await contract.connect(alice).createTransaction(bobby.address, 48 * 3600, options);
                await contract.connect(alice).createTransaction(bobby.address, 48 * 3600, options);

                [o1, i1] = await contract.connect(bobby).myTransactions();

                expect(o1.length).to.be.equal(1);
                expect(o1[0]).to.be.equal(1024);

            });

            it("Should return the new transaction when called from the receiver", async () => {
                
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [o1, i1] = await contract.connect(alice).myTransactions();

                expect(i1).to.not.be.undefined;
                expect(i1.length).to.be.equal(1);
                expect(i1[0]).to.be.equal(1024);
                
                expect(o1).to.not.be.undefined;
                expect(o1.length).to.be.equal(0);

                
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(alice).createTransaction(bobby.address, 48 * 3600, options);

                [o1, i1] = await contract.connect(alice).myTransactions();

                expect(i1).to.not.be.undefined;
                expect(i1.length).to.be.equal(2);
                expect(i1[0]).to.be.equal(1024);
                expect(i1[1]).to.be.equal(1025);
                
                expect(o1).to.not.be.undefined;
                expect(o1.length).to.be.equal(1);
                expect(o1[0]).to.be.equal(1026);

            });

            it("Should not return the new transaction when called from a third party", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [o1, i1] = await contract.connect(addrs[0]).myTransactions();

                expect(i1).to.not.be.undefined;
                expect(i1.length).to.be.equal(0);
                
                expect(o1).to.not.be.undefined;
                expect(o1.length).to.be.equal(0);

                
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(alice).createTransaction(bobby.address, 48 * 3600, options);

                [o1, i1] = await contract.connect(addrs[0]).myTransactions();

                expect(i1).to.not.be.undefined;
                expect(i1.length).to.be.equal(0);
                
                expect(o1).to.not.be.undefined;
                expect(o1.length).to.be.equal(0);

            });

            it("Should not return the new transaction when called from the developer", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [o1, i1] = await contract.myTransactions();

                expect(i1).to.not.be.undefined;
                expect(i1.length).to.be.equal(0);
                
                expect(o1).to.not.be.undefined;
                expect(o1.length).to.be.equal(0);

                
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(alice).createTransaction(bobby.address, 48 * 3600, options);

                [o1, i1] = await contract.myTransactions();

                expect(i1).to.not.be.undefined;
                expect(i1.length).to.be.equal(0);
                
                expect(o1).to.not.be.undefined;
                expect(o1.length).to.be.equal(0);

            });

            it("Should still return the transaction when reversed", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await expect(contract.connect(bobby).reverseTransaction(1024)).to.not.be.reverted;

                var [o1, i1] = await contract.connect(bobby).myTransactions();

                expect(o1.length).to.be.equal(1);
                expect(o1[0]).to.be.equal(1024);

            });

            it("Should still return the transaction when ready to finish", async () => {
                
                var n = nextReady;
                nextReady++;

                var [o1, i1] = await contractWithDelaysDone.connect(bobby).myTransactions();

                expect(o1.length).to.be.equal(50);
                expect(o1[n - 1024]).to.be.equal(n);

            });

            it("Should still return the transaction when finished", async () => {

                var n = nextReady;
                nextReady++;

                await contractWithDelaysDone.connect(bobby).finishTransaction(n);
                var [o1, i1] = await contractWithDelaysDone.connect(bobby).myTransactions();

                expect(o1.length).to.be.equal(50);
                expect(o1[n - 1024]).to.be.equal(n);

            });

            it("Should return the new transaction by when called by id from the sender", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(48 * 3600).add(block.timestamp), 5);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

                await contract.connect(bobby).createTransaction(addrs[0].address, 36 * 3600, options);

                [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1025);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(addrs[0].address);
                block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(36 * 3600).add(block.timestamp), 5);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should not modify other transactions", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(48 * 3600).add(block.timestamp), 5);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

                await contract.connect(bobby).createTransaction(addrs[0].address, 36 * 3600, options);

                [origin, destination, maturity, amount, paid, reversed] = await contract.connect(bobby).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(48 * 3600).add(block.timestamp), 5);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should return the new transaction when called from the receiver", async () => {
                
                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(alice).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(48 * 3600).add(block.timestamp), 5);
                expect(amount).to.equal(options.value.sub(await contract.fee()));
                expect(paid).to.be.false;
                expect(reversed).to.be.false;

            });

            it("Should not return the new transaction when called from a third party", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                await expect(contract.connect(addrs[0]).getTransaction(1024)).to.be.revertedWith("Not authorized");

            });

            it("Should not return the new transaction when called from the developer", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);

                await expect(contract.getTransaction(1024)).to.be.revertedWith("Not authorized");

            });

            it("Should still return the transaction when reversed", async () => {

                await contract.connect(bobby).createTransaction(alice.address, 48 * 3600, options);
                await contract.connect(bobby).reverseTransaction(1024);

                var [origin, destination, maturity, amount, paid, reversed] = await contract.connect(alice).getTransaction(1024);

                expect(origin).to.equal(bobby.address);
                expect(destination).to.equal(alice.address);
                var block = await ethers.provider.getBlock();
                expect(maturity).to.be.closeTo(ethers.BigNumber.from(172800).add(block.timestamp), 5);
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