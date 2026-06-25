// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockPriceFeed is AggregatorV3Interface {
    uint8 public override decimals;
    string public override description;
    uint256 public override version;

    uint80 private s_roundId;
    int256 private s_answer;
    uint256 private s_startedAt;
    uint256 private s_updatedAt;
    uint80 private s_answeredInRound;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        s_answer = _initialAnswer;
        s_updatedAt = block.timestamp;
        s_startedAt = block.timestamp;
        s_roundId = 1;
        s_answeredInRound = 1;
        description = "MockPriceFeed";
        version = 0;
    }

    function setLatestRoundData(
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) external {
        s_roundId = roundId;
        s_answer = answer;
        s_startedAt = startedAt;
        s_updatedAt = updatedAt;
        s_answeredInRound = answeredInRound;
    }

    function updateAnswer(int256 _answer) external {
        s_answer = _answer;
        s_updatedAt = block.timestamp;
        s_startedAt = block.timestamp;
        s_roundId++;
        s_answeredInRound = s_roundId;
    }

    function getRoundData(uint80) external view override returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        return (s_roundId, s_answer, s_startedAt, s_updatedAt, s_answeredInRound);
    }

    function latestRoundData() external view override returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        return (s_roundId, s_answer, s_startedAt, s_updatedAt, s_answeredInRound);
    }
}
