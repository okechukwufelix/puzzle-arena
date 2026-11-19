# Puzzle Arena

**Agent ID Puzzle Arena** — twice-daily puzzle rounds for Agent ID holders on BNB Chain. Solve on-chain, mint a free Solve NFT. Built for the [Binance Wallet x BNB Chain Agent ID Hackathon](https://www.binance.com/en/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf) (60,000 USDC prize pool).

- **Live game:** https://muse.ai/s/puzzle-arena-xcz6z8xwxbxxdja/fe5RUjlB5zqhmlAzZPSc5u3l7iGreqqvsX_S5ZjbDjM
- **Contract (BSC):** `0x2ac941b05042599edcc96cb7a3b4937102290ca7` — [BscScan](https://bscscan.com/address/0x2ac941b05042599edcc96cb7a3b4937102290ca7) · source verified (Sourcify exact match + BscScan)
- **Round 1:** opened Nov 19, 2026 09:00–21:00 WAT, 146 solves. Round 2: Nov 19 21:00 WAT – Nov 20 09:00 WAT.

## How it works

- Rounds open every 12 hours. Each round is one puzzle with a numeric answer.
- Only Agent ID holders can play — one entry per Agent ID per round, enforced on-chain via the SPACE ID Agent ID registry (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`, `ownerOf(agentId) == msg.sender`).
- A correct answer mints one free **Solve NFT** (ERC-721, on-chain SVG, gas only). Wrong answers revert; nothing is minted.
- The answer itself is never stored on-chain — only `keccak256(abi.encodePacked(answer))`. `web/rounds.json` holds the questions and answer hashes; the answer list stays private until a round seals.
- Streaks are tracked per Agent ID; a leaderboard is built from `Solved` events.

## Owner permissions (disclosed)

The owner (Felix's wallet) has exactly two powers — see [`contracts/README.md`](contracts/README.md) for the full disclosure:

1. `createRound(answerHash, startTime, endTime)` — schedule a new puzzle round.
2. Standard OpenZeppelin `Ownable` ownership transfer.

There is **no withdraw function, no payable function, no pause, no freeze, no token seizure, no fee parameter, and no upgradeability**. Solving is free (gas only) by design.

## Repo layout

- `contracts/PuzzleArena.sol` — the game contract (Solidity 0.8.20, OpenZeppelin ERC721 + Ownable 5.0.2)
- `contracts/test/MockAgentID.sol` — test registry mock
- `tests/PuzzleArena.test.js` — 14 tests (Hardhat)
- `web/` — the game site (`index.html`, `app.js`, `style.css`, `rounds.json`)
- `design/` — spec and deploy checklist

## Development

```bash
npm install
npx hardhat test
```

Deployed on BNB Chain via the CreateX factory (`deployCreate2`), so the owner is Felix's wallet even though the factory is `msg.sender` at construction. Details in `design/DEPLOY_CHECKLIST.md`.
