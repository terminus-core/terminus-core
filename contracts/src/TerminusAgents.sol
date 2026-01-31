// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TerminusAgents
 * @dev ERC-721 NFT contract for Terminus AI agent licenses
 * Each NFT represents ownership of a specific agent type
 */
contract TerminusAgents is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // Mapping from tokenId to agent type (e.g., "health-advisor")
    mapping(uint256 => string) private _agentTypes;
    
    // Events
    event AgentMinted(uint256 indexed tokenId, string agentType, address indexed owner);
    event AgentTypeUpdated(uint256 indexed tokenId, string newAgentType);

    constructor() ERC721("TerminusAgents", "TAGENT") Ownable(msg.sender) {}

    /**
     * @dev Mint a new agent NFT
     * @param to Address to mint to
     * @param agentType Type of agent (e.g., "health-advisor", "travel-planner")
     * @param tokenURI Metadata URI for the NFT
     */
    function mintAgent(
        address to,
        string memory agentType,
        string memory tokenURI
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        _agentTypes[tokenId] = agentType;
        
        emit AgentMinted(tokenId, agentType, to);
        return tokenId;
    }

    /**
     * @dev Batch mint multiple agent NFTs
     */
    function batchMintAgents(
        address to,
        string[] memory agentTypes,
        string[] memory tokenURIs
    ) external onlyOwner returns (uint256[] memory) {
        require(agentTypes.length == tokenURIs.length, "Arrays length mismatch");
        
        uint256[] memory tokenIds = new uint256[](agentTypes.length);
        
        for (uint256 i = 0; i < agentTypes.length; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            _agentTypes[tokenId] = agentTypes[i];
            tokenIds[i] = tokenId;
            
            emit AgentMinted(tokenId, agentTypes[i], to);
        }
        
        return tokenIds;
    }

    /**
     * @dev Get the agent type for a token
     */
    function getAgentType(uint256 tokenId) external view returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return _agentTypes[tokenId];
    }

    /**
     * @dev Get total number of agents minted
     */
    function totalAgents() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @dev Update agent type (owner only)
     */
    function setAgentType(uint256 tokenId, string memory newAgentType) external onlyOwner {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        _agentTypes[tokenId] = newAgentType;
        emit AgentTypeUpdated(tokenId, newAgentType);
    }

    /**
     * @dev Update token URI (owner only)
     */
    function updateTokenURI(uint256 tokenId, string memory newTokenURI) external onlyOwner {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        _setTokenURI(tokenId, newTokenURI);
    }
}
