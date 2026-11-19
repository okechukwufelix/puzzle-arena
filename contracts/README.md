# PuzzleArena — contract disclosure & security notes

Contract: `contracts/PuzzleArena.sol` — "Puzzle Arena Solve" (`PZSOLVE`), ERC-721.
Agent ID registry (BSC mainnet): `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
(SPACE ID Agent ID, ERC-721, non-transferable). An Agent ID's tokenId is
`keccak256(handle)` as bytes32/uint256.

## Complete list of owner permissions

The contract owner (Felix's wallet, passed as an explicit constructor
argument `owner_` — NOT the deployer, because the contract is deployed
through the CreateX factory and the factory is `msg.sender` at construction)
has exactly TWO powers. Nothing else.

1. **`createRound(bytes32 answerHash, uint64 startTime, uint64 endTime)`** —
   schedule a new puzzle round: the keccak256 hash of the numeric answer
   (`keccak256(abi.encodePacked(answer))`) plus the round's open window.
   Validation: `answerHash != 0`, `endTime > startTime`,
   `startTime >= block.timestamp`. The answer itself is never stored on-chain.
   This is the ONLY functional owner power.
2. **Standard OpenZeppelin Ownable ownership transfer:**
   `transferOwnership(address)` and `renounceOwnership()`. These move or give up
   the owner role only; they touch no funds, no tokens, no rounds.

## What the owner CANNOT do (by construction — the code does not contain it)

- **No withdraw function.** There is no function that moves BNB or any token
  out of the contract, to the owner or anyone else.
- **No funds can enter the contract.** There is no payable function, no
  `receive()` and no `fallback()` that accepts BNB. Any plain BNB transfer to
  the contract reverts. `solve()` is not payable and costs value 0.
- **No pause, no freeze, no token seizure.** No function can pause solving,
  freeze a token, or move a Solve NFT out of its holder's wallet.
- **No URI setter.** `tokenURI()` is fully deterministic on-chain SVG; no one
  can change a token's metadata after mint.
- **No tax, fee, or price parameter.** Solving is free (gas only) by design;
  there is no parameter that could introduce a fee later.
- **No upgradeability, no proxy.** The deployed bytecode is final.

## How solving works (for players)

- Only an Agent ID holder can solve: `solve(roundId, agentId, answer)` checks
  `registry.ownerOf(agentId) == msg.sender` on-chain. This also proves
  `balanceOf(msg.sender) > 0`.
- One entry per Agent ID per round (`solved[roundId][agentId]`), enforced
  on-chain — one Agent ID ≈ one person (registry is non-transferable, one
  per user).
- A correct answer mints one free Solve NFT (sequential id from 1) to the
  solver. A wrong answer reverts (`WrongAnswer`); nothing is minted.
- Streaks accrue to the **Agent ID**, not the wallet: consecutive UTC days
  solved increment `streakOf[agentId]`; a skipped day resets it to 1. A second
  solve on the SAME UTC day (the 12h-cadence case — two rounds per day) leaves
  the streak unchanged; it does not reset it.
- The Solve NFT is a collectible with **no monetary value**. No prizes or
  returns are promised.

## Answer privacy

Only `answerHash = keccak256(abi.encodePacked(answer))` is stored on-chain.
The answer list is kept privately by the round creator until a round ends;
answers may be published after the round seals. Answers are small integers
in the proven puzzle format, so the hash is a commitment, not secrecy against
brute force — the anti-sybil protection is the one-entry-per-Agent-ID rule,
not the secrecy of the answer.

## Test-only file

`contracts/test/MockAgentID.sol` is a minimal ERC-721 mock with a public
`mint(to, tokenId)` used only by the Hardhat test suite. It is NOT part of
the submission and must never be deployed to a live chain.

## Verification

- Solidity `^0.8.20`, OpenZeppelin Contracts 5.x (`ERC721`, `Ownable`,
  `Base64`, `Strings`). Optimizer enabled (200 runs).
- Full test suite: `npx hardhat test` (see `tests/PuzzleArena.test.js`).
- `solve()` gas is asserted < 220,000 in the tests.

## Implementation note — gas packing (not a spec change)

SPEC §4.1 lists `streakOf`, `lastSolveDay`, `tokenRound` and `tokenStreak`
as public mappings. A first-ever solve with that naive layout writes 9
fresh storage slots and costs ~243,000 gas — over the §4.2 target of
220,000. The contract therefore packs streak + last-solve-day into one
slot (`_streakData`) and token round + token streak into one slot
(`_tokenData`), and exposes `streakOf` / `lastSolveDay` / `tokenRound` /
`tokenStreak` as view functions with the **exact same ABI** as the
public-mapping getters (same function selectors, same return values —
verified against the compiled ABI). The frontend, built against §4.1,
is unaffected. Worst-case (first-ever) `solve()` now costs ~199,000 gas.
