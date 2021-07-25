const { ethers } = require("hardhat");

async function main() {
    const factory = await ethers.getContractFactory("Airlock");
    const [owner, bobby, alice] = await ethers.getSigners();
    var options = { gasPrice: 10 ** 9 }
    var depGas, setGas, sendGas, recGas;

    console.log("Owner address is: " + owner.address);
    console.log();
    var bal = await owner.getBalance();
    console.log("Owner balance is: " + bal/ethers.constants.WeiPerEther);
    depGas = ethers.BigNumber.from(bal);
    
    const airlock = await factory.deploy(options);

    bal = await owner.getBalance();
    console.log("Owner balance after deployment is: " + bal/ethers.constants.WeiPerEther);
    depGas = depGas.sub(bal);
    setGas = ethers.BigNumber.from(bal);

    bal = await bobby.getBalance();
    console.log("Bobby balance is: " + bal/ethers.constants.WeiPerEther);
    sendGas = ethers.BigNumber.from(bal);

    await airlock.setMinDelay(0, options);
    bal = await owner.getBalance();
    console.log("Owner balance after setting mindelay is: " + bal/ethers.constants.WeiPerEther);
    setGas -= bal;

    await airlock.connect(bobby).createTransaction(alice.address, 2, { value: ethers.constants.WeiPerEther, gasPrice: 10 ** 9 });
    bal = await bobby.getBalance();
    console.log("Bobby balance after sending one eth is: " + bal/ethers.constants.WeiPerEther);
    sendGas -= bal;
    sendGas -= ethers.constants.WeiPerEther;

    bal = await alice.getBalance();
    console.log("Alice balance is: " + bal/ethers.constants.WeiPerEther);
    recGas = ethers.BigNumber.from(bal);

    await new Promise(resolve => {
        setTimeout(resolve, 2000);
    });
    await airlock.connect(alice).finishTransaction(1024, options);
    bal = await alice.getBalance();
    console.log("Alice balance after finishing the tx is: " + bal/ethers.constants.WeiPerEther);
    recGas = recGas.add(ethers.constants.WeiPerEther).sub(bal);

    depGas /= 10 ** 9;
    setGas /= 10 ** 9;
    sendGas /= 10 ** 9;
    recGas /= 10 ** 9;

    console.log();
    console.log("gas spent:");
    console.log("deploy:        " + depGas);
    console.log("set minDelay:  " + setGas);
    console.log("createTx:      " + sendGas);
    console.log("finishTx:      " + recGas);

  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  