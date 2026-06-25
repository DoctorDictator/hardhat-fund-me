const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Campaign System", function () {
      let factory;
      let deployer;
      let funder1;
      let funder2;
      let other;
      let priceFeed;
      let campaign;
      let campaignAddress;

const DECIMALS = 8;
const INITIAL_PRICE = ethers.utils.parseUnits("2000", 8);
const GOAL_USD = ethers.utils.parseEther("1000");
const MIN_CONTRIBUTION_USD = ethers.utils.parseEther("10");
const SEND_VALUE = ethers.utils.parseEther("0.01");
const METADATA_URI = "ipfs://QmTestCampaign";

async function deployCampaignDirect(priceFeedAddr, deadline, deployerAddr) {
  const Campaign = await ethers.getContractFactory("Campaign");
  const camp = await Campaign.deploy(
    METADATA_URI,
    GOAL_USD,
    MIN_CONTRIBUTION_USD,
    deadline,
    priceFeedAddr,
    deployerAddr
  );
  await camp.deployed();
  return camp;
}

      async function getFutureTimestamp(secondsFromNow = 3600) {
        const block = await ethers.provider.getBlock("latest");
        return block.timestamp + secondsFromNow;
      }

      async function createCampaign(deadlineOffset = 3600) {
        const deadline = await getFutureTimestamp(deadlineOffset);
        const tx = await factory.createCampaign(
          METADATA_URI,
          GOAL_USD,
          MIN_CONTRIBUTION_USD,
          deadline
        );
        const receipt = await tx.wait();
        const event = receipt.events.find(
          (e) => e.event === "CampaignCreated"
        );
        campaignAddress = event.args.campaign;
        campaign = await ethers.getContractAt("Campaign", campaignAddress);
        return { campaign, deadline };
      }

      beforeEach(async function () {
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        funder1 = accounts[1];
        funder2 = accounts[2];
        other = accounts[3];

        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        priceFeed = await MockPriceFeed.connect(deployer).deploy(
          DECIMALS,
          INITIAL_PRICE
        );
        await priceFeed.deployed();

        const CampaignFactory = await ethers.getContractFactory(
          "CampaignFactory"
        );
        factory = await CampaignFactory.connect(deployer).deploy(
          priceFeed.address
        );
        await factory.deployed();
      });

      describe("CampaignFactory", function () {
        it("creates a campaign and emits CampaignCreated", async function () {
          const deadline = await getFutureTimestamp();
          await expect(
            factory.createCampaign(
              METADATA_URI,
              GOAL_USD,
              MIN_CONTRIBUTION_USD,
              deadline
            )
          )
            .to.emit(factory, "CampaignCreated")
            .withArgs(
              anyValue,
              deployer.address,
              METADATA_URI,
              GOAL_USD,
              deadline
            );
        });

        it("stores campaign address and returns correct count", async function () {
          await createCampaign();
          expect(await factory.getCampaignCount()).to.equal(1);
          expect(await factory.getCampaign(0)).to.equal(campaignAddress);
        });

        it("increments campaign count on multiple creations", async function () {
          await createCampaign();
          const { campaign: c2 } = await createCampaign(7200);

          expect(await factory.getCampaignCount()).to.equal(2);
          expect(await factory.getCampaign(0)).to.not.equal(
            c2.address
          );
          expect(await factory.getCampaign(1)).to.equal(c2.address);
        });

        it("reverts if price feed is zero address", async function () {
          const CampaignFactory = await ethers.getContractFactory(
            "CampaignFactory"
          );
          await expect(
            CampaignFactory.deploy(ethers.constants.AddressZero)
          ).to.be.revertedWithCustomError(
            CampaignFactory,
            "CampaignFactory_InvalidPriceFeed"
          );
        });
      });

      describe("Constructor Validation", function () {
        it("reverts if deadline is in the past", async function () {
          const pastDeadline = (await getFutureTimestamp()) - 10000;
          const Campaign = await ethers.getContractFactory("Campaign");
          await expect(
            Campaign.deploy(
              METADATA_URI,
              GOAL_USD,
              MIN_CONTRIBUTION_USD,
              pastDeadline,
              priceFeed.address,
              deployer.address
            )
          ).to.be.revertedWithCustomError(Campaign, "Campaign_InvalidDeadline");
        });

        it("reverts if goal is zero", async function () {
          const deadline = await getFutureTimestamp();
          const Campaign = await ethers.getContractFactory("Campaign");
          await expect(
            Campaign.deploy(
              METADATA_URI,
              0,
              MIN_CONTRIBUTION_USD,
              deadline,
              priceFeed.address,
              deployer.address
            )
          ).to.be.revertedWithCustomError(Campaign, "Campaign_InvalidGoal");
        });

        it("reverts if min contribution is zero", async function () {
          const deadline = await getFutureTimestamp();
          const Campaign = await ethers.getContractFactory("Campaign");
          await expect(
            Campaign.deploy(
              METADATA_URI,
              GOAL_USD,
              0,
              deadline,
              priceFeed.address,
              deployer.address
            )
          ).to.be.revertedWithCustomError(
            Campaign,
            "Campaign_InvalidMinContribution"
          );
        });
      });

      describe("Funding", function () {
        beforeEach(async function () {
          await createCampaign();
        });

        it("accepts funding above minimum and emits Funded", async function () {
          await expect(
            campaign.connect(funder1).fund({ value: SEND_VALUE })
          )
            .to.emit(campaign, "Funded")
            .withArgs(funder1.address, SEND_VALUE, anyValue);
        });

        it("reverts if funding is below minimum USD value", async function () {
          const smallValue = ethers.utils.parseEther("0.0001");
          await expect(
            campaign.connect(funder1).fund({ value: smallValue })
          ).to.be.revertedWithCustomError(
            campaign,
            "Campaign_InvalidMinContribution"
          );
        });

        it("reverts funding after deadline", async function () {
          await network.provider.send("evm_increaseTime", [3601]);
          await network.provider.send("evm_mine");

          await expect(
            campaign.connect(funder1).fund({ value: SEND_VALUE })
          ).to.be.revertedWithCustomError(campaign, "Campaign_CampaignEnded");
        });

        it("reverts funding after cancellation", async function () {
          await campaign.connect(deployer).cancel();

          await expect(
            campaign.connect(funder1).fund({ value: SEND_VALUE })
          ).to.be.revertedWithCustomError(
            campaign,
            "Campaign_CampaignCancelled"
          );
        });

        it("allows same contributor to fund multiple times", async function () {
          await campaign.connect(funder1).fund({ value: SEND_VALUE });
          await campaign.connect(funder1).fund({ value: SEND_VALUE });

          const contribution = await campaign.getContribution(funder1.address);
          expect(contribution).to.equal(SEND_VALUE.mul(2));
        });

        it("tracks contributions and usd value correctly", async function () {
          await campaign.connect(funder1).fund({ value: SEND_VALUE });
          await campaign.connect(funder2).fund({ value: SEND_VALUE });

          expect(await campaign.totalRaisedEth()).to.equal(
            SEND_VALUE.mul(2)
          );
          expect(await campaign.contributorCount()).to.equal(2);
          expect(await campaign.totalRaisedUsd()).to.be.gt(0);
        });
      });

      describe("Withdrawal", function () {
        beforeEach(async function () {
          await createCampaign(3600);
        });

        it("allows creator to withdraw after deadline when goal is met", async function () {
          const largeValue = ethers.utils.parseEther("0.5");
          await campaign
            .connect(funder1)
            .fund({ value: largeValue });

          await network.provider.send("evm_increaseTime", [3601]);
          await network.provider.send("evm_mine");

          const balanceBefore = await ethers.provider.getBalance(
            deployer.address
          );
          const tx = await campaign.connect(deployer).withdraw();
          const receipt = await tx.wait();
          const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
          const balanceAfter = await ethers.provider.getBalance(
            deployer.address
          );

          expect(await ethers.provider.getBalance(campaign.address)).to.equal(
            0
          );
          expect(balanceAfter.add(gasCost)).to.be.closeTo(
            balanceBefore.add(largeValue),
            ethers.utils.parseEther("0.001")
          );
        });

        it("reverts withdrawal before deadline", async function () {
          const largeValue = ethers.utils.parseEther("0.5");
          await campaign
            .connect(funder1)
            .fund({ value: largeValue });

          await expect(
            campaign.connect(deployer).withdraw()
          ).to.be.revertedWithCustomError(
            campaign,
            "Campaign_DeadlineNotReached"
          );
        });

        it("reverts withdrawal if goal not reached", async function () {
          await campaign
            .connect(funder1)
            .fund({ value: SEND_VALUE });

          await network.provider.send("evm_increaseTime", [3601]);
          await network.provider.send("evm_mine");

          await expect(
            campaign.connect(deployer).withdraw()
          ).to.be.revertedWithCustomError(campaign, "Campaign_GoalNotReached");
        });

        it("reverts withdrawal by non-creator", async function () {
          const largeValue = ethers.utils.parseEther("0.5");
          await campaign
            .connect(funder1)
            .fund({ value: largeValue });

          await network.provider.send("evm_increaseTime", [3601]);
          await network.provider.send("evm_mine");

          await expect(
            campaign.connect(funder1).withdraw()
          ).to.be.revertedWithCustomError(campaign, "Campaign_NotCreator");
        });

        it("reverts second withdrawal attempt", async function () {
          const largeValue = ethers.utils.parseEther("0.5");
          await campaign
            .connect(funder1)
            .fund({ value: largeValue });

          await network.provider.send("evm_increaseTime", [3601]);
          await network.provider.send("evm_mine");

          await campaign.connect(deployer).withdraw();

          await expect(
            campaign.connect(deployer).withdraw()
          ).to.be.revertedWithCustomError(
            campaign,
            "Campaign_NothingToWithdraw"
          );
        });
      });

      describe("Refunds", function () {
        it("allows refund when campaign fails (deadline passed, goal not met)", async function () {
          await createCampaign(3600);
          await campaign
            .connect(funder1)
            .fund({ value: SEND_VALUE });

          await network.provider.send("evm_increaseTime", [3601]);
          await network.provider.send("evm_mine");

          const balanceBefore = await ethers.provider.getBalance(
            funder1.address
          );
          const tx = await campaign.connect(funder1).refund();
          const receipt = await tx.wait();
          const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
          const balanceAfter = await ethers.provider.getBalance(
            funder1.address
          );

          expect(await campaign.getContribution(funder1.address)).to.equal(0);
          expect(balanceAfter.add(gasCost)).to.be.closeTo(
            balanceBefore.add(SEND_VALUE),
            ethers.utils.parseEther("0.001")
          );
        });

        it("allows refund when campaign is cancelled", async function () {
          await createCampaign();
          await campaign
            .connect(funder1)
            .fund({ value: SEND_VALUE });

          await campaign.connect(deployer).cancel();

          const balanceBefore = await ethers.provider.getBalance(
            funder1.address
          );
          const tx = await campaign.connect(funder1).refund();
          const receipt = await tx.wait();
          const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
          const balanceAfter = await ethers.provider.getBalance(
            funder1.address
          );

          expect(await campaign.getContribution(funder1.address)).to.equal(0);
          expect(balanceAfter.add(gasCost)).to.be.closeTo(
            balanceBefore.add(SEND_VALUE),
            ethers.utils.parseEther("0.001")
          );
        });

        it("refunds exact ETH amount", async function () {
          await createCampaign();
          const val1 = ethers.utils.parseEther("0.1");
          const val2 = ethers.utils.parseEther("0.2");
          await campaign
            .connect(funder1)
            .fund({ value: val1 });
          await campaign
            .connect(funder1)
            .fund({ value: val2 });

          await campaign.connect(deployer).cancel();

          const balanceBefore = await ethers.provider.getBalance(
            funder1.address
          );
          const tx = await campaign.connect(funder1).refund();
          const receipt = await tx.wait();
          const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
          const balanceAfter = await ethers.provider.getBalance(
            funder1.address
          );

          expect(balanceAfter.add(gasCost)).to.be.closeTo(
            balanceBefore.add(val1).add(val2),
            ethers.utils.parseEther("0.001")
          );
        });

        it("reverts refund by non-contributor", async function () {
          await createCampaign();
          await campaign
            .connect(funder1)
            .fund({ value: SEND_VALUE });

          await campaign.connect(deployer).cancel();

          await expect(
            campaign.connect(other).refund()
          ).to.be.revertedWithCustomError(campaign, "Campaign_NotContributor");
        });

        it("reverts double refund", async function () {
          await createCampaign();
          await campaign
            .connect(funder1)
            .fund({ value: SEND_VALUE });

          await campaign.connect(deployer).cancel();

          await campaign.connect(funder1).refund();

          await expect(
            campaign.connect(funder1).refund()
          ).to.be.revertedWithCustomError(campaign, "Campaign_AlreadyRefunded");
        });

        it("reverts refund if campaign is successful", async function () {
          await createCampaign();
          const largeValue = ethers.utils.parseEther("0.5");
          await campaign
            .connect(funder1)
            .fund({ value: largeValue });

          await network.provider.send("evm_increaseTime", [3601]);
          await network.provider.send("evm_mine");

          await expect(
            campaign.connect(funder1).refund()
          ).to.be.revertedWithCustomError(
            campaign,
            "Campaign_GoalAlreadyReached"
          );
        });
      });

      describe("Cancellation", function () {
        beforeEach(async function () {
          await createCampaign();
        });

        it("allows creator to cancel and emits Cancelled", async function () {
          await expect(campaign.connect(deployer).cancel())
            .to.emit(campaign, "Cancelled")
            .withArgs(deployer.address);
          expect(await campaign.getState()).to.equal(3); // Cancelled enum
        });

        it("reverts cancellation by non-creator", async function () {
          await expect(
            campaign.connect(funder1).cancel()
          ).to.be.revertedWithCustomError(campaign, "Campaign_NotCreator");
        });

        it("reverts cancellation if goal already reached", async function () {
          const largeValue = ethers.utils.parseEther("0.5");
          await campaign
            .connect(funder1)
            .fund({ value: largeValue });

          await expect(
            campaign.connect(deployer).cancel()
          ).to.be.revertedWithCustomError(
            campaign,
            "Campaign_GoalAlreadyReached"
          );
        });
      });

      describe("getState", function () {
        it("returns Funding initially", async function () {
          await createCampaign();
          expect(await campaign.getState()).to.equal(0);
        });

        it("returns Successful when goal is reached", async function () {
          await createCampaign();
          const largeValue = ethers.utils.parseEther("0.5");
          await campaign
            .connect(funder1)
            .fund({ value: largeValue });

          expect(await campaign.getState()).to.equal(1);
        });

        it("returns Failed when deadline passes without goal", async function () {
          await createCampaign(3600);
          await campaign
            .connect(funder1)
            .fund({ value: SEND_VALUE });

          await network.provider.send("evm_increaseTime", [3601]);
          await network.provider.send("evm_mine");

          expect(await campaign.getState()).to.equal(2);
        });

        it("returns Cancelled after cancellation", async function () {
          await createCampaign();
          await campaign.connect(deployer).cancel();
          expect(await campaign.getState()).to.equal(3);
        });
      });

      describe("getSummary", function () {
        it("returns all campaign details", async function () {
          const deadline = await getFutureTimestamp();
          const tx = await factory.createCampaign(
            METADATA_URI,
            GOAL_USD,
            MIN_CONTRIBUTION_USD,
            deadline
          );
          const receipt = await tx.wait();
          const event = receipt.events.find(
            (e) => e.event === "CampaignCreated"
          );
          campaign = await ethers.getContractAt(
            "Campaign",
            event.args.campaign
          );

          await campaign
            .connect(funder1)
            .fund({ value: SEND_VALUE });

          const summary = await campaign.getSummary();

          expect(summary._creator).to.equal(deployer.address);
          expect(summary._metadataURI).to.equal(METADATA_URI);
          expect(summary._goalUsd).to.equal(GOAL_USD);
          expect(summary._totalRaisedUsd).to.be.gt(0);
          expect(summary._totalRaisedEth).to.equal(SEND_VALUE);
          expect(summary._deadline).to.equal(deadline);
          expect(summary._state).to.equal(0);
          expect(summary._contributorCount).to.equal(1);
        });
      });

      describe("Price Feed Safety", function () {
        it("reverts on stale price data", async function () {
          const staleTimestamp = (await getFutureTimestamp()) - 7200;
          await priceFeed.setLatestRoundData(2, INITIAL_PRICE, staleTimestamp, staleTimestamp, 2);

          const deadline = await getFutureTimestamp();
          const camp = await deployCampaignDirect(priceFeed.address, deadline, deployer.address);

          await expect(
            camp.connect(funder1).fund({ value: SEND_VALUE })
          ).to.be.revertedWithCustomError(camp, "PriceConverter_StalePrice");
        });

        it("reverts on zero price", async function () {
          await priceFeed.updateAnswer(0);

          const deadline = await getFutureTimestamp();
          const camp = await deployCampaignDirect(priceFeed.address, deadline, deployer.address);

          await expect(
            camp.connect(funder1).fund({ value: SEND_VALUE })
          ).to.be.revertedWithCustomError(camp, "PriceConverter_InvalidPrice");
        });

        it("reverts on negative price", async function () {
          await priceFeed.updateAnswer(-100);

          const deadline = await getFutureTimestamp();
          const camp = await deployCampaignDirect(priceFeed.address, deadline, deployer.address);

          await expect(
            camp.connect(funder1).fund({ value: SEND_VALUE })
          ).to.be.revertedWithCustomError(camp, "PriceConverter_InvalidPrice");
        });

        it("reverts on incomplete round (answeredInRound < roundId)", async function () {
          const now = (await getFutureTimestamp(0));
          await priceFeed.setLatestRoundData(5, INITIAL_PRICE, now, now, 3);

          const deadline = await getFutureTimestamp();
          const camp = await deployCampaignDirect(priceFeed.address, deadline, deployer.address);

          await expect(
            camp.connect(funder1).fund({ value: SEND_VALUE })
          ).to.be.revertedWithCustomError(camp, "PriceConverter_IncompleteRound");
        });

        it("accepts non-8-decimal feed", async function () {
          const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
          const weirdFeed = await MockPriceFeed.deploy(18, ethers.utils.parseUnits("2000", 18));
          await weirdFeed.deployed();

          const deadline = await getFutureTimestamp();
          const camp = await deployCampaignDirect(weirdFeed.address, deadline, deployer.address);

          await expect(
            camp.connect(funder1).fund({ value: SEND_VALUE })
          ).to.not.be.reverted;
        });
      });
    });
