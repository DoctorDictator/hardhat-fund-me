// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library PriceConverter {
    error PriceConverter_StalePrice();
    error PriceConverter_InvalidPrice();
    error PriceConverter_IncompleteRound();

    function getPrice(AggregatorV3Interface priceFeed) internal view returns (uint256) {
        uint8 decimals = priceFeed.decimals();
        (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) = priceFeed.latestRoundData();

        if (answer <= 0) revert PriceConverter_InvalidPrice();
        if (updatedAt + 1 hours < block.timestamp) revert PriceConverter_StalePrice();
        if (answeredInRound < roundId) revert PriceConverter_IncompleteRound();

        return uint256(answer) * 10 ** (18 - decimals);
    }

    function getConversionRate(uint256 ethAmount, AggregatorV3Interface priceFeed) internal view returns (uint256) {
        uint256 ethPrice = getPrice(priceFeed);
        return (ethPrice * ethAmount) / 10 ** 18;
    }
}
