const { ethers, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat-config");
const DECIMALS = "8";
const INITIAL_PRICE = "200000000000"; // 2000

async function deployFundMe() {
  const chainId = network.config.chainId;
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  let mockPriceFeedAddress;
  if (chainId == 31337) {
    const MockV3Aggregator = await ethers.getContractFactory(
      "MockV3Aggregator"
    );
    const mockPriceFeed = await MockV3Aggregator
      .connect(deployer)
      .deploy(DECIMALS, INITIAL_PRICE);
    await mockPriceFeed.deployed();
    mockPriceFeedAddress = mockPriceFeed.address;
  } else {
    mockPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"];
  }
  console.log("Deploying, please wait...")
  const fundMeFactory = await ethers.getContractFactory("FundMe");
  const fundMe = await fundMeFactory
    .connect(deployer)
    .deploy(mockPriceFeedAddress);
  await fundMe.deployed();
  console.log(`Deployed FundMe to ${fundMe.address}`);
  return fundMe;
}

if (require.main === module) {
  deployFundMe()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  deployFundMe,
  INITIAL_PRICE,
};
