// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./Campaign.sol";

error CampaignFactory_InvalidPriceFeed();

contract CampaignFactory {
    event CampaignCreated(address indexed campaign, address indexed creator, string metadataURI, uint256 goalUsd, uint256 deadline);

    address[] private s_campaigns;
    AggregatorV3Interface private s_priceFeed;

    constructor(address priceFeed) {
        if (priceFeed == address(0)) revert CampaignFactory_InvalidPriceFeed();
        s_priceFeed = AggregatorV3Interface(priceFeed);
    }

    function createCampaign(
        string calldata metadataURI,
        uint256 goalUsd,
        uint256 minContributionUsd,
        uint256 deadline
    ) external returns (address) {
        Campaign campaign = new Campaign(metadataURI, goalUsd, minContributionUsd, deadline, address(s_priceFeed), msg.sender);
        s_campaigns.push(address(campaign));
        emit CampaignCreated(address(campaign), msg.sender, metadataURI, goalUsd, deadline);
        return address(campaign);
    }

    function getCampaign(uint256 index) external view returns (address) {
        return s_campaigns[index];
    }

    function getCampaignCount() external view returns (uint256) {
        return s_campaigns.length;
    }

    function getPriceFeed() external view returns (address) {
        return address(s_priceFeed);
    }
}
