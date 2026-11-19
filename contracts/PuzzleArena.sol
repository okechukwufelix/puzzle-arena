// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Puzzle Arena Solve
/// @notice Daily puzzles for Agent ID holders. A correct solve mints a free,
///         gas-only ERC-721 "Solve" NFT. No payment, no fee, no approvals.
/// @dev Agent ID registry: 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F (BSC mainnet).
///      The registry is non-transferable and one Agent ID per user, so one entry
///      per Agent ID is approximately one entry per person.
///      This contract holds no funds: there is no payable function, no receive()
///      and no fallback(), and no withdraw function exists anywhere in it.
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract PuzzleArena is ERC721, Ownable {
    using Strings for uint256;

    IAgentID public immutable agentID;

    struct Round {
        bytes32 answerHash; // keccak256(abi.encodePacked(answer))
        uint64 startTime;
        uint64 endTime;
        uint32 solves; // incremented per solve
    }

    uint256 public totalMinted; // sequential Solve NFT ids, start at 1
    uint256 public roundCount;
    mapping(uint256 => Round) public rounds; // roundId -> Round (roundIds start at 1)
    mapping(uint256 => mapping(uint256 => bool)) public solved; // roundId -> agentId -> solved?
    mapping(uint256 => uint256) public solvesOf; // agentId -> lifetime solves

    // Gas packing (SPEC §4.2 gas target: solve() < 220,000):
    // A first-ever solve writes 9 fresh storage slots in the naive layout
    // (~243k gas). Streak + last-solve-day and token round + token streak are
    // therefore packed into one slot each. The PUBLIC getters below have the
    // exact same ABI as the public mappings in SPEC §4.1
    // (same selectors, same return values), so the frontend is unaffected.
    // _streakData[agentId]: bits [0..64) = lastSolveDay (uint64),
    //                      bits [64..96) = current streak (uint32).
    mapping(uint256 => uint256) internal _streakData;
    // _tokenData[tokenId]: bits [0..32) = roundId (uint32),
    //                    bits [32..64) = streak at mint (uint32).
    mapping(uint256 => uint256) internal _tokenData;

    event RoundCreated(uint256 indexed roundId, uint64 startTime, uint64 endTime);
    event Solved(
        uint256 indexed roundId,
        uint256 indexed agentId,
        address indexed solver,
        uint256 tokenId,
        uint256 streak
    );

    error RoundNotOpen();
    error WrongAnswer();
    error NotAgentHolder();
    error AlreadySolved();
    error InvalidRound();

    /// @dev Owner is an explicit constructor argument, NOT msg.sender:
    ///      the contract is deployed through a factory (CreateX), so
    ///      msg.sender at construction is the factory, not the human owner.
    ///      The owner is Felix's wallet; its only powers are `createRound`
    ///      plus standard Ownable transfer/renounce.
    constructor(address agentID_, address owner_) ERC721("Puzzle Arena Solve", "PZSOLVE") Ownable(owner_) {
        agentID = IAgentID(agentID_);
    }

    /// @notice Current streak (days) for an Agent ID. ABI-identical to the
    ///         public mapping getter in SPEC §4.1.
    function streakOf(uint256 agentId) external view returns (uint256) {
        return uint32(_streakData[agentId] >> 64);
    }

    /// @notice UTC day number of an Agent ID's last solve. ABI-identical to
    ///         the public mapping getter in SPEC §4.1.
    function lastSolveDay(uint256 agentId) external view returns (uint256) {
        return uint64(_streakData[agentId]);
    }

    /// @notice Round a Solve token was minted for. ABI-identical to the public
    ///         mapping getter in SPEC §4.1.
    function tokenRound(uint256 tokenId) external view returns (uint256) {
        return uint32(_tokenData[tokenId]);
    }

    /// @notice Streak at the time a Solve token was minted. ABI-identical to
    ///         the public mapping getter in SPEC §4.1.
    function tokenStreak(uint256 tokenId) external view returns (uint256) {
        return uint32(_tokenData[tokenId] >> 32);
    }

    /// @notice Schedule a new puzzle round. ONLY owner power (besides standard
    ///         Ownable ownership transfer). The answer itself is never stored;
    ///         only keccak256(abi.encodePacked(answer)).
    function createRound(bytes32 answerHash, uint64 startTime, uint64 endTime) external onlyOwner {
        require(answerHash != bytes32(0), "PuzzleArena: zero answer hash");
        require(endTime > startTime, "PuzzleArena: end must be after start");
        require(startTime >= block.timestamp, "PuzzleArena: start in the past");
        roundCount += 1;
        rounds[roundCount] = Round({answerHash: answerHash, startTime: startTime, endTime: endTime, solves: 0});
        emit RoundCreated(roundCount, startTime, endTime);
    }

    /// @notice Solve a round. Caller must own `agentId` in the Agent ID registry.
    ///         One entry per Agent ID per round. Correct answer mints a free Solve NFT.
    function solve(uint256 roundId, uint256 agentId, uint256 answer) external {
        if (roundId < 1 || roundId > roundCount) revert InvalidRound();
        Round storage round = rounds[roundId];
        if (block.timestamp < round.startTime || block.timestamp > round.endTime) revert RoundNotOpen();
        if (keccak256(abi.encodePacked(answer)) != round.answerHash) revert WrongAnswer();
        if (agentID.ownerOf(agentId) != msg.sender) revert NotAgentHolder();
        if (solved[roundId][agentId]) revert AlreadySolved();

        solved[roundId][agentId] = true;

        uint256 day = block.timestamp / 86400;
        uint256 packed = _streakData[agentId];
        uint256 streak;
        uint256 lastDay = uint64(packed);
        if (day > 0 && lastDay == day) {
            // Already solved today (second round of a 12h-cadence day):
            // streak is unchanged — a same-day solve must NOT reset it.
            streak = uint32(packed >> 64);
        } else if (day > 0 && lastDay == day - 1) {
            streak = uint32(packed >> 64) + 1;
        } else {
            streak = 1;
        }
        _streakData[agentId] = (streak << 64) | day;

        uint256 tokenId = ++totalMinted;
        _safeMint(msg.sender, tokenId);
        _tokenData[tokenId] = (streak << 32) | roundId;
        solvesOf[agentId] += 1;
        round.solves += 1;

        emit Solved(roundId, agentId, msg.sender, tokenId, streak);
    }

    /// @notice On-chain SVG metadata, returned directly as a
    ///         `data:image/svg+xml;base64,...` URI (per design spec §4.2/§7.8 —
    ///         NOT a JSON metadata envelope, so wallets render the image itself).
    ///         Deterministic, no external URLs, no IPFS.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "PuzzleArena: token does not exist");
        uint256 packed = _tokenData[tokenId];
        uint256 roundId = uint32(packed);
        uint256 streak = uint32(packed >> 32);

        string memory svg = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
                '<rect width="400" height="400" fill="#0b1020"/>',
                '<rect x="12" y="12" width="376" height="376" fill="none" stroke="#f0b90b" stroke-width="4"/>',
                '<text x="200" y="80" font-family="monospace" font-size="30" fill="#f0b90b" text-anchor="middle">PUZZLE ARENA</text>',
                '<text x="200" y="150" font-family="monospace" font-size="22" fill="#ffffff" text-anchor="middle">ROUND ',
                roundId.toString(),
                '</text>',
                '<text x="200" y="200" font-family="monospace" font-size="22" fill="#ffffff" text-anchor="middle">TOKEN #',
                tokenId.toString(),
                '</text>',
                '<text x="200" y="250" font-family="monospace" font-size="22" fill="#ffffff" text-anchor="middle">STREAK ',
                streak.toString(),
                '</text>',
                '<text x="200" y="330" font-family="monospace" font-size="28" fill="#22c55e" text-anchor="middle">SOLVED</text>',
                '</svg>'
            )
        );

        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
    }
}
