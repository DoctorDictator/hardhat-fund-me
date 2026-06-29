// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./Campaign.sol";

error CampaignFactory_InvalidPriceFeed();

contract CampaignFactory {
    event CampaignCreated(address indexed campaign, address indexed creator, string metadataURI, uint256 goalUsd, uint256 deadline);

    address[] private s_campaigns;
    mapping(address => address[]) private s_creatorCampaigns;
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
        s_creatorCampaigns[msg.sender].push(address(campaign));
        emit CampaignCreated(address(campaign), msg.sender, metadataURI, goalUsd, deadline);
        return address(campaign);
    }

    function getCampaign(uint256 index) external view returns (address) {
        return s_campaigns[index];
    }

    function getCampaignCount() external view returns (uint256) {
        return s_campaigns.length;
    }

    function getCampaigns(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 total = s_campaigns.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = s_campaigns[offset + i];
        }
        return result;
    }

    function getCreatorCampaignCount(address creator) external view returns (uint256) {
        return s_creatorCampaigns[creator].length;
    }

    function getCreatorCampaign(address creator, uint256 index) external view returns (address) {
        return s_creatorCampaigns[creator][index];
    }

    function getPriceFeed() external view returns (address) {
        return address(s_priceFeed);
    }
}
