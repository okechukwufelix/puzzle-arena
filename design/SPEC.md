# Agent ID Puzzle Arena — Design Spec (v1)

## 0. Source of truth

Hackathon announcement (read in full 2026-11-18):
https://www.binance.com/en/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf
X post: https://x.com/BinanceWallet/status/2122973166758945045

## 1. Hackathon facts (exact, from the announcement)

- **Host:** Binance Wallet + BNB Chain. **Prize pool: 60,000 USDC.**
- **Submission Period:** 2026-11-18 08:00 UTC → **2026-12-09 08:00 UTC** (= 09:00 WAT).
- Internal Review: 2026-12-09 → 2026-12-17 UTC. Public Review: 2026-12-17 → 2026-12-20 UTC.
  Rewards distributed within 14 business days after the public announcement period ends,
  to the reward-receiving address provided at submission.
- **Project Awards: 58,000 USDC** — two awards of 29,000 USDC each, top 10 each:
  1st 10,000 / 2nd 6,000 / 3rd 4,000 / 4th 3,000 / 5th 2,000 / 6th–10th 800 USDC.
  Each project may receive only ONE award.
- **Pioneer Award:** ranking from real on-chain data — weighted score of
  (a) number of Agent ID holder addresses interacting with the submitted contract(s),
  (b) transaction volume / transaction count. Only submitted contract addresses count;
  interacting addresses must hold an Agent ID.
- **Innovation Award:** judging panel (Binance Wallet, BNB Chain, technical/ecosystem reps),
  100-point system — Agent ID Application Depth 30%, Practicality & Feasibility 25%,
  Product Completion 25%, Innovation 20%. Eligibility: product LIVE, with
  **at least 30 Agent ID addresses** having interacted with the participating contract(s)
  during the Submission Period. Ties broken by depth of Agent ID integration, then completion.
- Top 20 projects (both awards) each get one eligibility spot to claim a **two-digit Agent ID**
  (higher rank = priority). Exceptionally outstanding winners may be featured on the
  Binance Wallet Agentic Wallet ecosystem page.
- **Community Promotion Campaign:** 2,000 USDC shared equally among 20 winners for original
  X posts about participating projects, with #BinanceWalletHackathon and #AgenticWallet,
  link submitted via the official campaign survey. (Side entry, not the main build.)
- **Requirements:** deploy contract(s) on BNB Chain; verify source on BscScan; make code
  publicly open-source; actively integrate Agent ID (access control, payments, identity);
  submit project name, website, contract address(es), Agent ID usage description and other
  required materials via "Submit Project Now" during the Submission Period. No registration
  needed. One project per team. During the period, actively guide Agent ID holders to
  interact with the project contract(s). New and existing projects eligible (existing: only
  data generated during the Submission Period counts).
- **Safety red lines (violation = immediate disqualification):**
  1. No web-based QR code login for Agentic Wallet. No scanning QR codes / entering pairing
     codes on third-party sites; no storing user login sessions on servers to act on their behalf.
  2. No prompts that bypass user transaction confirmation for asset operations
     (transfers, trades, approvals). Users must see and confirm every such action themselves.
  3. No unauthorized asset transfers: no scheduled collection, no automatic transfers to
     fixed addresses, no bundled extra transfers, no soliciting unlimited approvals.
  4. Contracts open-source with **disclosed owner permissions** (minting, tax changes,
     pausing, freezing, withdrawing user funds must be clearly documented).
  5. No impersonation of the Binance brand — project/token/domain names must not use
     "Binance" / "BNB" to impersonate the official brand.
  6. No collection of seed phrases, private keys, API secrets, or pairing codes.
  7. No promised returns externally ("passive income", "automatic money-making" prohibited).
  8. Trading products must display risk warnings on the page.
  9. Agent ID must NOT be packaged as a tool for "looking up other people's wallets by name".
  10. No abnormal behavior: no malicious volume manipulation, no illegitimate mass account
      registration for interactions.
- **Agent ID contract (BNB Chain):** `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`
  (SPACE ID Agent ID, ERC-721, non-transferable). Official holder check:
  `balanceOf(address) > 0` means the address holds an Agent ID. Agent ID is claimed only
  inside the Binance App (Wallet > homepage banner > Agent ID). Each user can claim only
  one Agent ID.
- Only users with an active Binance Account are eligible for rewards; rewards go to the
  address provided at submission. Binance reserves final determination on winners.

## 2. Product concept

**Name: Puzzle Arena** — "Twice-daily puzzles for Agent ID holders."
(Deliberately contains no "Binance" / "BNB" — red line 5. Token: "Puzzle Arena Solve",
symbol `PZSOLVE`. Do not use the name "Agent Arena" — an unrelated ARENA token exists.)

- Two puzzle rounds open every day, 12 hours apart (08:00 and 20:00 UTC — 09:00 and
  21:00 WAT). Each round runs for 12 hours. The puzzle is a riddle / logic puzzle whose
  answer is a single number (uint256).
- **Only Agent ID holders can play.** The contract verifies on-chain that the caller owns
  a specific Agent ID token before accepting a solve.
- **One entry per Agent ID per round**, enforced in the contract.
- A correct solve mints a **free, gas-only ERC-721 "Solve" NFT** to the solver.
  No payment, no approval, no fee of any kind. The NFT is a collectible with no monetary
  value — the site must say so plainly (red line 7: no promised returns).
- **Streaks:** consecutive UTC days solved build a streak, stored per Agent ID on-chain.
  Streaks count UTC *days*, not rounds: with two rounds per day, solving the second
  round of the same day leaves the streak unchanged (it must NOT reset it — the
  contract's `solve()` has an explicit same-day branch for this; see §4.2 step 6).
  The frontend shows streaks; a streak badge is a v1.1 stretch (see §7).
- **Leaderboard:** live, from on-chain `Solved` events — most solves, longest streaks,
  per-round participation. Display Agent IDs as truncated hashes (`0x7d72…e97`), never
  as handles or wallet lookups (red line 9).

**Why it wins:**
- Pioneer: the Agent ID community already plays daily puzzle mints (FIND / SPEC /
  AgentNova / WOOZ — dozens verified in this workspace). A free twice-daily puzzle is
  the proven magnet for holder count + repeat transactions. Every solve is one on-chain
  interaction from an Agent ID holder address, on our submitted contract — and with
  two rounds per day, each active holder generates up to 2 transactions per day,
  doubling the daily transaction count the Pioneer Award scores.
- Innovation: Agent ID is the core identity, not a bolt-on — access control (only holders
  can play), anti-sybil (one entry per Agent ID), and streak identity that accrues to the
  Agent ID, not the wallet. Depth 30% is the biggest single scoring bucket and this is
  exactly what it rewards.

## 3. Agent ID facts the build relies on

- Registry: `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` (BSC mainnet, chain 56).
- An Agent ID's tokenId = `keccak256(handle)` as bytes32/uint256.
  Proven: `keccak256("egwu") = 0x7d724b64fbcb9f34596af833b5ebda0ddb68a90d61def1c36f10e4cf53848e97`,
  and `registry.ownerOf(that tokenId) = 0x28279187F0a8020F3903B3d8F0d51122cfF8F774` (Felix, egwu.ai).
  NOTE: 2810 is only Felix's Ptah Agent number, NOT the registry tokenId. Never use 2810.
- The registry is non-transferable and one Agent ID per user, so one entry per Agent ID
  ≈ one entry per person. The contract enforces it by `agentId`, not by wallet alone.
- **NEVER hand-type function selectors.** Derive every selector from the ABI with a
  validated Keccak-256 (checks: `totalSupply()` = `0x18160ddd`,
  `balanceOf(address)` = `0x70a08231`, `transfer(address,uint256)` = `0xa9059cbb`).
  Encode calldata with a reference encoder (`eth_abi`), never hand-computed offsets
  (offsets must count the offset word itself — see the 2026-11-15 UNSOLVABLE loss).

## 4. Smart contract spec — `contracts/PuzzleArena.sol`

Solidity `^0.8.20`, OpenZeppelin ERC721 + Ownable (via npm `@openzeppelin/contracts`).
No proxy. No upgradeability. No payable functions. No `receive`/`fallback` that accepts BNB.

### 4.1 Interface (exact — the frontend is built against this)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract PuzzleArena is ERC721, Ownable {
    IAgentID public immutable agentID;   // 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F

    struct Round {
        bytes32 answerHash;   // keccak256(abi.encodePacked(answer))
        uint64  startTime;
        uint64  endTime;
        uint32  solves;       // incremented per solve
    }

    uint256 public totalMinted;                 // sequential Solve NFT ids, start at 1
    uint256 public roundCount;
    mapping(uint256 => Round) public rounds;                    // roundId -> Round (roundIds start at 1)
    mapping(uint256 => mapping(uint256 => bool)) public solved; // roundId -> agentId -> solved?
    mapping(uint256 => uint256) public streakOf;                // agentId -> current streak (days)
    mapping(uint256 => uint256) public lastSolveDay;            // agentId -> UTC day number of last solve
    mapping(uint256 => uint256) public solvesOf;                // agentId -> lifetime solves
    mapping(uint256 => uint256) public tokenRound;              // Solve tokenId -> roundId
    mapping(uint256 => uint256) public tokenStreak;             // Solve tokenId -> streak at mint time

    event RoundCreated(uint256 indexed roundId, uint64 startTime, uint64 endTime);
    event Solved(uint256 indexed roundId, uint256 indexed agentId, address indexed solver,
                 uint256 tokenId, uint256 streak);

    error RoundNotOpen();
    error WrongAnswer();
    error NotAgentHolder();
    error AlreadySolved();
    error InvalidRound();

    constructor(address agentID_, address owner_) ERC721("Puzzle Arena Solve", "PZSOLVE") Ownable(owner_);
    // NOTE: `owner_` is an explicit constructor argument, NOT msg.sender.
    // The contract is deployed through the CreateX factory, so msg.sender at
    // construction is the factory, not Felix. The owner is Felix's wallet
    // (0x28279187F0a8020F3903B3d8F0d51122cfF8F774).

    function createRound(bytes32 answerHash, uint64 startTime, uint64 endTime) external onlyOwner;
    function solve(uint256 roundId, uint256 agentId, uint256 answer) external;
    function tokenURI(uint256 tokenId) public view override returns (string memory);
}
```

### 4.2 Behaviour

- `createRound`: onlyOwner. Require `answerHash != bytes32(0)`, `endTime > startTime`,
  `startTime >= block.timestamp` (rounds may be created ahead of time). Appends a round,
  emits `RoundCreated`. This is the ONLY owner power.
- `solve(roundId, agentId, answer)`:
  1. Round exists (`roundId >= 1 && roundId <= roundCount`) else `InvalidRound`.
  2. `block.timestamp` within `[startTime, endTime]` else `RoundNotOpen`.
  3. `keccak256(abi.encodePacked(answer)) == rounds[roundId].answerHash` else `WrongAnswer`.
  4. `agentID.ownerOf(agentId) == msg.sender` else `NotAgentHolder`.
     (This also proves `balanceOf(msg.sender) > 0`. A wrong/foreign agentId reverts.)
  5. `!solved[roundId][agentId]` else `AlreadySolved`.
  6. Mark solved; `uint256 day = block.timestamp / 86400;`
     streak: if `lastSolveDay[agentId] == day` (second round of the same UTC day,
     the 12h-cadence case) then the streak is UNCHANGED; else if
     `lastSolveDay[agentId] == day - 1` then `streakOf[agentId] += 1`
     else `streakOf[agentId] = 1`; set `lastSolveDay[agentId] = day`.
     (`day - 1` underflow is impossible in practice; guard with `day > 0`.)
  7. Mint Solve NFT: `tokenId = ++totalMinted; _safeMint(msg.sender, tokenId);`
     Record `tokenRound[tokenId]`, `tokenStreak[tokenId]`; `solvesOf[agentId]++`,
     `rounds[roundId].solves++`. Emit `Solved`.
- `tokenURI`: on-chain SVG data URI (`data:image/svg+xml;base64,...`) rendering:
  "PUZZLE ARENA", round number, token id, streak at mint, and a "SOLVED" mark.
  No external URLs, no IPFS dependency. Must be deterministic and valid for every minted id.
- Gas target: `solve()` < 220,000 gas (comparable puzzle mints cost ~195k).
  Keep storage writes minimal; do not store the question text on-chain.

### 4.3 Cleanliness (hackathon red line 4 + Felix's own standard)

- NO withdraw function. NO function that moves user funds. NO payable entry point.
- NO pause, NO freeze, NO token seizure, NO URI setter, NO tax/fee parameter.
- Owner powers (disclose ALL of them in `contracts/README.md` and the site footer):
  1. `createRound` — schedule a new puzzle round (answer hash + window).
  2. `transferOwnership` / `renounceOwnership` — standard Ownable.
- That is the complete permission list. Nothing else.

## 5. Rounds — puzzle format and data

- Two rounds per day, 12h windows. Windows: 08:00 → 20:00 UTC and 20:00 → 08:00 UTC
  (= 09:00 → 21:00 WAT and 21:00 → 09:00 WAT). **DECIDED 2026-11-18 by Felix:
  12h cadence (twice-daily)** — doubles the daily on-chain transactions the
  Pioneer Award scores, at the cost of twice the puzzle-writing work. The round
  bank is 10 rounds (≈ 5 days at 12h cadence); more rounds must be written before
  they run out.
- Puzzle: a short riddle / logic puzzle with a single numeric answer (uint256).
  Examples of the proven format: FIND answers 114, AgentNova 18, WOOZ 34 — small integers.
- Round content lives in `web/rounds.json` (committed in the repo) with schema:
  `{ "roundId": 1, "question": "...", "hint": "...", "startTime": <unix>, "endTime": <unix> }`.
  The answer itself is NEVER in the repo: only `answerHash = keccak256(abi.encodePacked(answer))`
  goes on-chain at `createRound` time. The deployer keeps the answer list privately until
  a round ends (answers may be published after the round seals).
- Rounds 1–10 content drafted as part of v1 (rounds 1–3) + the 12h update
  (rounds 4–10), so the first ~5 days can run without new work. Hashes must be
  computed with the validated Keccak (never hand-typed) and cross-checked:
  `keccak256(abi.encodePacked(answer))`.

## 6. Frontend spec — `web/` (static site, no backend, no server)

- Pure static files: `index.html`, `app.js`, `style.css`, `rounds.json`. No build step
  required to view; must be hostable as-is on any static host (e.g. GitHub Pages).
- Library: ethers v6 via CDN (jsDelivr). No WalletConnect, no QR, no server sessions.
- Wallet: injected provider only (`window.ethereum` — Binance Wallet / MetaMask).
  Connect button → `eth_requestAccounts`. Chain check: BSC mainnet (chainId 56);
  offer `wallet_switchEthereumChain` (user confirms in their own wallet).
- Flow:
  1. Connect wallet. Read `registry.balanceOf(user)`. If 0 → show "You need an Agent ID —
     claim one in the Binance App (Wallet > homepage banner > Agent ID)" and disable solving.
  2. Ask the user to type their OWN Agent ID handle once (e.g. `egwu`), stored in
     `localStorage`. Compute `agentId = keccak256(handle)` in JS, verify on-chain
     `registry.ownerOf(agentId) == connected wallet` before enabling the solve button.
     (Never look up or display other people's handles — red line 9. Only the connected
     user's own handle is ever entered or shown.)
  3. Show the current round (question, window, solves so far, your solved/not-solved state
     via `solved(roundId, agentId)`).
  4. User enters the numeric answer → frontend builds the `solve(roundId, agentId, answer)`
     call, shows the exact transaction (contract, function, value 0, gas estimate) and the
     user confirms in their own wallet. Value is always 0. No approvals are ever requested.
  5. After mining, read the tokenId from the receipt's Transfer event and show it, plus a
     "Share on X" button (plain Web Intent link, user posts themselves).
- Leaderboard: read `Solved` events via `eth_getLogs` from a public BSC RPC
  (default `https://bsc-dataseed.binance.org`, fallbacks: dataseed1/2, 1rpc).
  Aggregate per agentId: total solves, best streak, last solve. Top 10 table.
  Display agentIds truncated (`0x7d72…e97`) — never handles, never wallet addresses.
- Pages/sections on one page: Hero (what it is, free to play, gas only), Current Round,
  How it works, Leaderboard, Past Rounds, FAQ, Footer.
- Copy rules: say "free to play — you only pay network gas", "the Solve NFT is a
  collectible with no monetary value", "no prizes or returns are promised". Never use
  "passive income", "earn", "automatic money-making" or any promised-return language.
  No trading happens on the site, so no trading risk warning is needed; include a footer
  line: "Puzzle Arena is an independent hackathon entry. Not affiliated with Binance."
- Accessibility/robustness: works without a wallet connected for reading (rounds,
  leaderboard); all contract reads go through the public RPC, not a private node.

## 7. Tests spec — `tests/` (Hardhat)

- Hardhat project at the goal root: `package.json`, `hardhat.config.js`
  (`contracts/` = contracts dir, `tests/` = test dir, Solidity 0.8.20, optimizer on).
- A mock Agent ID registry (`contracts/test/MockAgentID.sol`, test-only, NOT submitted):
  minimal ERC721 with `mint(to, tokenId)` for tests, `ownerOf`/`balanceOf` standard.
- Test cases (all must pass):
  1. Deploy: name/symbol, registry address stored, owner set.
  2. `createRound` onlyOwner; rejects zero hash, end <= start, start in the past.
  3. Non-holder cannot solve (`NotAgentHolder`); holder with a foreign agentId cannot solve.
  4. Wrong answer reverts (`WrongAnswer`); correct answer mints, emits `Solved`,
     token owner is solver, `solved` flag set, `solvesOf` = 1.
  5. Second solve of the same round by the same agentId reverts (`AlreadySolved`) —
     including from a different wallet (impossible via ownerOf, but assert the flag path).
  6. Solve before `startTime` / after `endTime` reverts (`RoundNotOpen`).
  7. Streaks: solve day 1 → streak 1; solve next UTC day → streak 2; skip a day →
     next solve resets streak to 1. (Use Hardhat time manipulation.)
  7b. 12h cadence: a second solve on the SAME UTC day keeps the streak (day 2
     streak 2, second solve same day → still 2; day 3 solve → streak 3).
     Required by the 12h cadence — without it a same-day second solve would
     reset a live streak to 1.
  8. `tokenURI` returns a valid `data:image/svg+xml;base64` URI containing the round id
     and token id; decodes cleanly.
  9. Sending BNB to the contract reverts (no payable entry point).
  10. Gas report: `solve()` gas printed and asserted < 220,000.
  11. Multi-round: solving round 1 then round 2 works; solves are independent per round.
- Optional (if a BSC RPC is reachable from the VM): one fork test against the REAL
  registry `0x60B926...` proving `ownerOf(keccak256("egwu"))` returns Felix's wallet
  and a mainnet-fork solve simulation passes with a test account impersonating that
  holder. If the RPC is unreachable, skip and note it — do not fail the suite on it.

## 8. Repo layout

```
~/workspace/goals/agent-id-hackathon-puzzle-arena/
  design/SPEC.md            (this file)
  contracts/PuzzleArena.sol
  contracts/test/MockAgentID.sol
  contracts/README.md       (full owner-permission disclosure + security notes)
  tests/PuzzleArena.test.js (Hardhat)
  web/index.html  web/app.js  web/style.css  web/rounds.json
  package.json  hardhat.config.js
  README.md                 (project README: what it is, how to run, how to deploy,
                             submission checklist, no-promised-returns notice)
```

## 9. Open decisions for Felix (do NOT guess — surface these)

1. **Round cadence:** ~~24h daily rounds (recommended — matches the community's daily habit)
   vs 12h rounds (2× transactions, more Pioneer volume, but twice the puzzle-writing work).~~
   **DECIDED 2026-11-18 by Felix: 12h rounds (twice-daily).** Applied in v1.1:
   12h windows, 10-round bank, same-day streak fix in `solve()` + test 7b.
2. **First round start:** ~~day after deployment (recommended) vs immediately at deploy.~~
   **DECIDED 2026-11-18 by Felix: day after deployment** (a day to verify the contract and site before play starts).
3. **NFT art:** on-chain SVG (recommended — no external dependency, fully verifiable)
   vs designed IPFS art (prettier, needs an artist/pinning).
4. **Streak badge:** v1.1 soulbound badge at a 7-day streak (adds Innovation depth) vs
   streaks shown on the leaderboard only in v1.
5. **Project name:** ~~"Puzzle Arena" (proposed; must stay clear of "Binance"/"BNB").~~
   **DECIDED 2026-11-18 by Felix: "Puzzle Arena".**
6. **Reward-receiving address for submission:** Felix's BSC wallet (to confirm at submission).

## 10. Deployment checklist (for the later, separate step — NOT this build)

- [ ] Compile + all tests green (this build).
- [ ] Deploy `PuzzleArena` to BSC mainnet (chain 56) from Felix's wallet — needs his exact
      preview confirmation. Deployment goes through the CreateX factory
      (`0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed`) via `deployCreate2`
      (see `design/DEPLOY_CHECKLIST.md` §1 for the selector, salt and precomputed address).
      The owner is an explicit constructor argument — Felix's wallet — because the
      factory is `msg.sender` at construction (only `createRound` power).
- [ ] Verify source on BscScan (flattened or multi-file, exact compiler version + settings).
- [ ] Publish code open-source (public repo) + host the static site.
- [ ] Create round 1 (answer hash on-chain; question in `rounds.json` + site).
- [ ] Drive Agent ID holders to play (Telegram agentidcall channel, Boltbook feed, X).
- [ ] Submit via "Submit Project Now" before 2026-12-09 09:00 WAT with: project name,
      website, contract address, Agent ID usage description, reward-receiving address.
- [ ] Optional: community-promotion X post (#BinanceWalletHackathon #AgenticWallet).
- Budget note: Felix's wallet held ~0.00219 BNB on 2026-11-18 afternoon (after a
  +0.0013156 BNB top-up and 3 puzzle claims); his session was re-signed 2026-11-18
  ~13:16 WAT and is good until Fri 2026-11-20 13:16 WAT; devMode until 2026-11-25.
  Deployment gas measured from the compiled contract in this build: 1,948,531.
  The CreateX factory call adds overhead — take the exact gas from the `baw` preview.

## 11. Hard limits for this build

- Do NOT deploy anything to any chain. Do NOT sign any transaction. Do NOT spend any BNB.
  Do NOT connect any wallet. Local build/test only.
- Do NOT submit anything to Binance. Submission is a separate step with Felix's confirmation.
- Do NOT collect or store any user data, keys, or sessions anywhere in the code.
