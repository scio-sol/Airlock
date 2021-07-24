const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Testing basic setup", async function() {

    it("Tests whether we can access the moot contract", async function() {
        var str = "Hello, World!";

        const Moot = await ethers.getContractFactory("moot");
        const moot = await Moot.deploy(str);

        expect(await moot.greetMe()).to.equal(str);

    });

    it("Tests whether we can change the greeting given by the moot constract", async function() {

        var str = "Hello, World!";
        var str2 = "Chg";

        const Moot = await ethers.getContractFactory("moot");
        const moot = await Moot.deploy(str);
        await moot.changeGreeting(str2);

        expect(await moot.greetMe()).to.equal(str2);

    });
});