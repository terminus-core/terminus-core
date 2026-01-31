// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TerminusReputation
 * @dev On-chain reputation tracking for Terminus agents
 */
contract TerminusReputation is Ownable {
    // Reputation data per agent
    struct Reputation {
        uint256 totalScore;    // Cumulative score (0-500 per feedback, representing 0.00-5.00)
        uint256 feedbackCount; // Number of feedbacks received
    }

    mapping(uint256 => Reputation) private _reputations;

    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed submitter,
        uint256 score,
        uint256 newAverage
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Submit feedback for an agent (score 0-500, representing 0.00-5.00)
     */
    function submitFeedback(uint256 agentId, uint256 score) external {
        require(score <= 500, "Score must be 0-500");
        
        Reputation storage rep = _reputations[agentId];
        rep.totalScore += score;
        rep.feedbackCount++;
        
        uint256 average = rep.totalScore / rep.feedbackCount;
        emit FeedbackSubmitted(agentId, msg.sender, score, average);
    }

    /**
     * @dev Get reputation for an agent
     * @return score Average score (0-500)
     * @return count Number of feedbacks
     */
    function getReputation(uint256 agentId) external view returns (uint256 score, uint256 count) {
        Reputation storage rep = _reputations[agentId];
        if (rep.feedbackCount == 0) {
            return (0, 0);
        }
        return (rep.totalScore / rep.feedbackCount, rep.feedbackCount);
    }

    /**
     * @dev Get feedback count for an agent
     */
    function getFeedbackCount(uint256 agentId) external view returns (uint256) {
        return _reputations[agentId].feedbackCount;
    }

    /**
     * @dev Get raw total score for an agent
     */
    function getTotalScore(uint256 agentId) external view returns (uint256) {
        return _reputations[agentId].totalScore;
    }
}
