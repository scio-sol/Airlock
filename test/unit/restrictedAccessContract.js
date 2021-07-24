const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Restricted Access contract", async function() {
    var RAC;
    var owner, addr2, addr3, addrs;

    this.beforeEach(async function() {
        const factory = await ethers.getContractFactory("RestrictedAccessContract");
        [owner, addr2, addr3, ...addrs] = await ethers.getSigners();
        RAC = await factory.deploy();
    });

    it("Should have set the dev as the deployer address", async () => {
        expect(await RAC.amITheDev()).to.true;
    });

    it("Should simply return false if amITheDev() called from a different address than the deployer", async () => {
        expect(await RAC.connect(addr2).amITheDev()).to.false;
    });

    it("Should change developers when the dev calls changeDev", async () => {
        await RAC.changeDev(addr2.address);
        expect(await RAC.amITheDev()).to.false;
        expect(await RAC.connect(addr2).amITheDev()).to.true;
    });

    it("Should return the address of the developer no matter who calls the call", async () => {
        expect(await RAC.getDev()).to.equal(owner.address);
        expect(await RAC.connect(addr2).getDev()).to.equal(owner.address);
    });

    it("Should NOT change developers when a third account calls changeDev", async () => {
        await expect(RAC.connect(addr2).changeDev(addr2.address)).to.be.reverted;
        expect(await RAC.amITheDev()).to.true;
        expect(await RAC.connect(addr2).amITheDev()).to.false;
    });
});