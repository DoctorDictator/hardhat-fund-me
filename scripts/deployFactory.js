const { ethers, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat-config");

const DECIMALS = "8";
const INITIAL_PRICE = "200000000000"; // 2000 USD

async function main() {
  await deployFactory();
}

async function deployFactory() {
  const chainId = network.config.chainId;
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  let priceFeedAddress;

  if (chainId == 31337) {
    const mockFactory = await ethers.getContractFactory("MockPriceFeed");
    const mockPriceFeed = await mockFactory
      .connect(deployer)
      .deploy(DECIMALS, INITIAL_PRICE);
    await mockPriceFeed.deployed();
    priceFeedAddress = mockPriceFeed.address;
  } else {
    priceFeedAddress = networkConfig[chainId].ethUsdPriceFeed;
  }

  console.log("Deploying CampaignFactory...");
  const factoryFactory = await ethers.getContractFactory("CampaignFactory");
  const factory = await factoryFactory
    .connect(deployer)
    .deploy(priceFeedAddress);
  await factory.deployed();
  console.log(`Deployed CampaignFactory to ${factory.address}`);
  return factory;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = {
  deployFactory,
  DECIMALS,
  INITIAL_PRICE,
};
