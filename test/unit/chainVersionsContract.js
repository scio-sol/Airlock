const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Chained Versions contract", async function() {
    var factory;
    var contract;
    var owner, addr2, addr3, addrs;

    this.beforeEach(async function() {
        factory = await ethers.getContractFactory("ChainVersionsContract");
        [owner, addr2, addr3, ...addrs] = await ethers.getSigners();
        contract = await factory.deploy();
    });

    it("Should have set the address of 0 as the default", async () => {
        expect(await contract.nextVersion()).to.equal(ethers.constants.AddressZero);
    });

    it("Should not tell us that it is broken by default", async () => {
        expect(await contract.isBroken()).to.false;
    });

    it("Should tell us that it is the latest by default", async () => {
        expect(await contract.isLatest()).to.true;
    });

    it("Should allow us to set next if it is the latest and we are the owner", async () => {
        var contract2 = await factory.deploy();
        await expect(contract.setNextVersion(contract2.address)).to.not.be.reverted;
        expect(await contract.isLatest()).to.false;
        expect(await contract.nextVersion()).to.equal(contract2.address);
    });

    it("Should not allow us to redirect if it is not the latest", async () => {
        var contract2 = await factory.deploy();
        var contract3 = await factory.deploy();
        await expect(contract.setNextVersion(contract2.address)).to.not.be.reverted;
        await expect(contract.setNextVersion(contract3.address)).to.be.reverted;
    });

    it("Should not allow us to redirect if we are not the owners", async () => {
        var contract2 = await factory.deploy();
        await expect(contract.connect(addr2).setNextVersion(contract2.address)).to.be.reverted;
    });

    it("Should allow us to set broken by default", async () => {
        await expect(contract.setBroken()).to.not.be.reverted;
        expect(await contract.isBroken()).to.true;
    });

    it("Should not allow us to set broken if we are not the owners", async () => {
        await expect(contract.connect(addr2).setBroken()).to.be.reverted;
        expect(await contract.isBroken()).to.false;
    });
});