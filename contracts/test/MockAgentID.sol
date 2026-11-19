// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice TEST-ONLY mock of the SPACE ID Agent ID registry.
///          NOT part of the Puzzle Arena submission and never deployed to any
///          live chain. The real registry is
///          0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F on BSC mainnet.
///          Minimal ERC721 with a public mint(to, tokenId) for tests only.
contract MockAgentID is ERC721 {
    constructor() ERC721("Mock Agent ID", "MOCKAGENTID") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}
