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

    it("Should change developers when the dev calls changeDev", async () => {
        await expect(RAC.changeDev(addr2.address)).to.not.be.reverted;
        await expect(RAC.changeDev(addr2.address)).to.be.reverted;
    });

    it("Should NOT change developers when a third account calls changeDev", async () => {
        await expect(RAC.connect(addr2).changeDev(addr2.address)).to.be.reverted;
    });
});