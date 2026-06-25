// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";

error Campaign_NotCreator();
error Campaign_NotContributor();
error Campaign_CampaignEnded();
error Campaign_CampaignCancelled();
error Campaign_DeadlineNotReached();
error Campaign_GoalNotReached();
error Campaign_GoalAlreadyReached();
error Campaign_NothingToWithdraw();
error Campaign_TransferFailed();
error Campaign_AlreadyRefunded();
error Campaign_InvalidDeadline();
error Campaign_InvalidGoal();
error Campaign_InvalidMinContribution();
error Campaign_Reentrant();

contract Campaign {
    using PriceConverter for uint256;

    enum CampaignState { Funding, Successful, Failed, Cancelled }

    event Funded(address indexed contributor, uint256 ethAmount, uint256 usdValue);
    event Withdrawn(address indexed creator, uint256 amount);
    event Refunded(address indexed contributor, uint256 amount);
    event Cancelled(address indexed creator);

    string public metadataURI;
    uint256 public goalUsd;
    uint256 public minContributionUsd;
    uint256 public deadline;
    address public creator;
    AggregatorV3Interface public priceFeed;

    uint256 public totalRaisedUsd;
    uint256 public totalRaisedEth;
    uint256 public contributorCount;

    CampaignState private s_state;
    mapping(address => uint256) private s_contributions;
    mapping(address => bool) private s_hasRefunded;
    bool private s_reentrancyGuard;

    modifier onlyCreator() {
        if (msg.sender != creator) revert Campaign_NotCreator();
        _;
    }

    modifier onlyContributor() {
        if (s_contributions[msg.sender] == 0) revert Campaign_NotContributor();
        _;
    }

    modifier isActive() {
        if (s_state == CampaignState.Cancelled) revert Campaign_CampaignCancelled();
        if (block.timestamp >= deadline) revert Campaign_CampaignEnded();
        _;
    }

    modifier nonReentrant() {
        if (s_reentrancyGuard) revert Campaign_Reentrant();
        s_reentrancyGuard = true;
        _;
        s_reentrancyGuard = false;
    }

    constructor(
        string memory _metadataURI,
        uint256 _goalUsd,
        uint256 _minContributionUsd,
        uint256 _deadline,
        address _priceFeed,
        address _creator
    ) {
        if (_deadline <= block.timestamp) revert Campaign_InvalidDeadline();
        if (_goalUsd == 0) revert Campaign_InvalidGoal();
        if (_minContributionUsd == 0) revert Campaign_InvalidMinContribution();

        metadataURI = _metadataURI;
        goalUsd = _goalUsd;
        minContributionUsd = _minContributionUsd;
        deadline = _deadline;
        creator = _creator;
        priceFeed = AggregatorV3Interface(_priceFeed);
        s_state = CampaignState.Funding;
    }

    function fund() external payable isActive nonReentrant {
        if (msg.value == 0) revert Campaign_InvalidMinContribution();

        uint256 usdValue = msg.value.getConversionRate(priceFeed);
        if (usdValue < minContributionUsd) revert Campaign_InvalidMinContribution();

        if (s_contributions[msg.sender] == 0) {
            contributorCount++;
        }

        s_contributions[msg.sender] += msg.value;
        totalRaisedEth += msg.value;
        totalRaisedUsd += usdValue;

        if (totalRaisedUsd >= goalUsd) {
            s_state = CampaignState.Successful;
        }

        emit Funded(msg.sender, msg.value, usdValue);
    }

    function withdraw() external onlyCreator nonReentrant {
        if (block.timestamp < deadline) revert Campaign_DeadlineNotReached();
        if (totalRaisedUsd < goalUsd) revert Campaign_GoalNotReached();

        uint256 balance = address(this).balance;
        if (balance == 0) revert Campaign_NothingToWithdraw();

        (bool success, ) = creator.call{value: balance}("");
        if (!success) revert Campaign_TransferFailed();

        emit Withdrawn(creator, balance);
    }

    function refund() external nonReentrant {
        CampaignState currentState = getState();
        if (currentState == CampaignState.Funding) revert Campaign_CampaignEnded();
        if (currentState == CampaignState.Successful) revert Campaign_GoalAlreadyReached();
        if (s_hasRefunded[msg.sender]) revert Campaign_AlreadyRefunded();
        if (s_contributions[msg.sender] == 0) revert Campaign_NotContributor();

        uint256 contribution = s_contributions[msg.sender];
        s_hasRefunded[msg.sender] = true;
        s_contributions[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: contribution}("");
        if (!success) revert Campaign_TransferFailed();

        emit Refunded(msg.sender, contribution);
    }

    function cancel() external onlyCreator {
        if (totalRaisedUsd >= goalUsd) revert Campaign_GoalAlreadyReached();

        s_state = CampaignState.Cancelled;
        emit Cancelled(creator);
    }

    function getState() public view returns (CampaignState) {
        if (s_state == CampaignState.Cancelled) return CampaignState.Cancelled;
        if (totalRaisedUsd >= goalUsd) return CampaignState.Successful;
        if (block.timestamp >= deadline) return CampaignState.Failed;
        return CampaignState.Funding;
    }

    function getContribution(address contributor) external view returns (uint256) {
        return s_contributions[contributor];
    }

    function getHasRefunded(address contributor) external view returns (bool) {
        return s_hasRefunded[contributor];
    }

    function getSummary() external view returns (
        address _creator,
        string memory _metadataURI,
        uint256 _goalUsd,
        uint256 _totalRaisedUsd,
        uint256 _totalRaisedEth,
        uint256 _deadline,
        CampaignState _state,
        uint256 _contributorCount
    ) {
        return (creator, metadataURI, goalUsd, totalRaisedUsd, totalRaisedEth, deadline, getState(), contributorCount);
    }
}
