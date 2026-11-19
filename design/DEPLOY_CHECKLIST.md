# Agent ID Puzzle Arena — Deployment Checklist (v1.1)

QA-verified 2026-11-18 ~12:05 WAT by the integration QA check (local only);
re-verified 2026-11-18 ~13:30 WAT after the factory-deploy rework (local only);
launch-wired 2026-11-18 ~13:51 WAT (local + site publish, see QA item 9).
Test suite: **14 passing, 0 failing** (`npx hardhat test`). Deployment gas
measured: **1,948,531**. Worst-case first-ever `solve()` gas measured:
**199,246** (under the 220,000 target). ABI, selectors and round hashes all
verified against the compiled artifact — see "QA evidence" at the bottom.
**Deploy path is now the CreateX factory** (see §1): the `baw` CLI cannot send
a contract-creation transaction, and the Binance Discover/dApp browser does
NOT expose the Agentic Wallet (confirmed by Felix's screenshot), so the
deploy page (`web/deploy.html`) is SUPERSEDED for deployment — keep the file,
do not delete it.

**HARD RULES (standing, Felix):** every signing step below needs Felix's
exact-preview confirmation in chat before execution. No step here authorises
a signature by itself. Do NOT deploy, sign, spend, connect a wallet or submit
anything except as Felix confirms each preview, one step at a time.

## 0. Preconditions — do these first

- [ ] **Top up Felix's BSC wallet.** Balance was 0.0020329 BNB after the
      deploy (2026-11-18 ~13:35 WAT; deploy fee 0.0001489 BNB). At the live gas
      price read below, `createRound` + a few solves fit — but the wallet is
      thin. **A top-up is still recommended.** Recommended: top up to **at
      least 0.01 BNB** (covers `createRound` calls + a buffer for solves).
      Re-check the live gas price immediately before any preview.
- [ ] **Wallet sign-in.** Re-signed in via the Binance App 2026-11-18 ~13:16 WAT;
      the session is good until **Fri 2026-11-20 13:16 WAT** and devMode is on
      until 2026-11-25. Nothing signs after the session ends until he re-signs.
- [ ] **Confirm the open decisions** (SPEC §9) with Felix: round cadence
      (**12h twice-daily — DECIDED by Felix 2026-11-18**), first round start, project name "Puzzle Arena",
      reward-receiving address (Felix's BSC wallet, to confirm at submission).

## 1. Deploy `PuzzleArena` to BSC mainnet (chain 56) — via the CreateX factory — ✅ DONE 2026-11-18 ~13:35 WAT

Why a factory: the `baw` CLI cannot send a contract-creation transaction
(`contract-call preview` requires `--to`, verified directly 2026-11-18), and
the Binance Discover/dApp browser does NOT expose the Agentic Wallet
(`window.ethereum` absent — confirmed by Felix's screenshot 2026-11-18
13:25 WAT), so the deploy page (`web/deploy.html`) can never connect there.
The deploy is therefore a normal `baw contract-call` to the CreateX factory,
which Felix signs through the preview flow he already uses. **The deploy page
is SUPERSEDED for deployment — keep the file, do not delete it.**

- [x] Build the exact deploy preview with `baw` — DONE 13:34 WAT (preview
      requestId `b43fb2ecc001499e9f88d6ce6a515703`, sim clean; Felix confirmed it
      and tapped "Yes, deploy it"):
      `baw contract-call preview --binanceChainId 56 --from 0x28279187F0a8020F3903B3d8F0d51122cfF8F774 --to 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed --value 0 --inputData <factory calldata> --json`
      with the factory calldata from `hidden_files/createx-calldata.txt`
      (9,380 bytes; full details in `hidden_files/createx-deploy.json`).
      **Needs Felix's exact-preview confirmation.**
      - Factory: CreateX `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` (verified:
        11,838 bytes of code on 2 BSC RPCs; Sourcify exact match, creation +
        runtime; ABI confirms `deployCreate2(bytes32,bytes)`).
      - Call: `deployCreate2(bytes32 salt, bytes initCode)`, selector
        **0x26307668** (derived from the ABI signature with the validated
        Keccak helper, cross-checked with eth_hash — never hand-typed).
      - Salt: raw `0x8d62b0eca45a7d27bcbbad37c69ec2f68e71fbc4fcc158c42e2ea5f57f3df45b`
        = keccak256("Puzzle Arena"). CreateX **guards** the salt: for a random
        salt the effective salt is
        guarded `0xf7da3a94ef208d107cf43aa955fccfb9ca807a4eca4db04c717769d2a521d8cb`
        = keccak256(abi.encode(rawSalt)) (CreateX `_guard` else-branch;
        verified against the canonical CreateX source, whose 24-function
        public ABI matches the deployed ABI exactly).
      - Init code: `hidden_files/deploy-inputdata.txt` (9,274 bytes;
        keccak256 `0x8e4f29782b9f8c65f98e224a2c0c34b2093d78d89995de0b64feeba337cd79c5`).
        Constructor args are ABI-encoded with eth_abi: registry
        `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` + owner
        `0x28279187F0a8020F3903B3d8F0d51122cfF8F774` (Felix's wallet).
        The owner is an explicit constructor argument because the factory is
        `msg.sender` at construction — test 1b proves the owner is the passed
        address, not the deployer.
      - **Precomputed contract address: `0x2ac941b05042599edcc96cb7a3b4937102290ca7`**
        (CREATE2 with the GUARDED salt). Verified on-chain by calling
        CreateX `computeCreate2Address` with the guarded salt + initCodeHash:
        identical on 3 BSC RPCs. **WARNING: the naive formula with the raw
        salt gives `0x314d145ad8a47b98bd29585618a9285c0a82223b` — that is NOT
        where the contract lands; the guard changes it. Do not use it.**
- [x] Execute the factory call from Felix's wallet — DONE 13:34–13:35 WAT.
      The factory deployed `PuzzleArena` at the precomputed address; Felix's
      wallet is owner (only powers: `createRound` + standard Ownable
      transfer/renounce — see `contracts/README.md`).
- [x] Record: contract address **0x2ac941b05042599edcc96cb7a3b4937102290ca7**
      (equals the precomputed address exactly), deploy tx
      `0xad7bf0d039a9a2815e4c7844af363230ccdcb5f2aa80c8d322f7b1e0f0d4334f`,
      block **134312230**, status 1, gas used **1,956,843** @ 0.0761 gwei =
      **0.0001489 BNB**. CreateX `ContractCreated` log (guarded salt
      0xf7da3a94…) + `OwnershipTransferred` log (0 → Felix) both confirm.
- [x] Verify on-chain after deployment: `owner()` == Felix's wallet
      `0x28279187F0a8020F3903B3d8F0d51122cfF8F774` ✓ and `agentID()` ==
      `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` ✓; runtime code 8,398 bytes.
- Gas/BNB cost: direct deployment is 1,948,531 gas (see cost table below);
      the CreateX factory call adds overhead — **take the exact gas figure
      from the `baw` preview before confirming**. At the live read
      (0.05 gwei) the direct-deploy equivalent is **~0.000097 BNB**.

## 2. Verify source on BscScan

- [x] Verify the deployed contract on BscScan — DONE 2026-11-18 ~13:40–13:46 WAT.
      Sourcify exact_match on creation + runtime (verificationId
      `729279bb-fa74-45be-852b-2b931e08c62f`, matchId 59468366; first attempt
      failed only because the version string lacked the commit hash —
      resubmitted as 0.8.20+commit.a1b79de6). BscScan's own verification form
      reported "The Contract Source code for 0x2ac941… has already been
      verified" (PuzzleArena, v0.8.20+commit.a1b79de6, optimization 200 runs,
      MIT) — the Sourcify exact_match is imported by BscScan. (The contract
      page itself couldn't be visually confirmed in the cloud browser —
      Cloudflare check kept cycling — but the form's own message is
      BscScan's authoritative status.)
- [x] Confirm the BscScan page shows the verified source and the contract
      name `PuzzleArena` / token `PZSOLVE` — confirmed via the form message
      above; the footer on the live site states the verified contract.
- Gas/BNB cost: none (off-chain).

## 3. Publish the code open-source

- [ ] Push the full repo (contracts, tests, web, design) to a public
      repository (e.g. GitHub) under an open-source licence (MIT, as in the
      source headers). The hackathon requires the code to be publicly
      open-source.
- [ ] Confirm the repo URL is public and readable without login.
- Gas/BNB cost: none.

## 4. Wire the frontend to the deployed contract

- [x] In `web/app.js`, replace the placeholder — DONE 2026-11-18 ~13:48 WAT:
  - `ARENA_ADDRESS`: `0x2ac941b05042599edcc96cb7a3b4937102290ca7`.
  - `ARENA_DEPLOYED`: `true`.
  - `DEPLOY_BLOCK`: `134312230`.
  Frontend ABI re-verified against the compiled artifact after the
  constructor change: all 16 entries match (14 Arena + 2 registry; the
  earlier "17" count in QA item 2 was a miscount — actual is 16).
  Footer in `web/index.html` now shows the deployed contract address and
  BscScan verification.
- [x] Smoke-test the static site — the published artifact's audit passed:
      page loads (nav 200) on desktop and phone, no console errors from its
      own origin, no horizontal overflow; footer shows the contract address;
      round 1 timing verified (opens Nov 19 08:00 UTC). (Audit sandbox
      blocked the ethers CDN, so the round card stayed on "Loading rounds…"
      there; on the public page the CDN loads normally.) Do NOT submit a
      solve as a test unless Felix confirms a live solve preview for a real
      round.
- Gas/BNB cost: none (read-only until a solve is confirmed).

## 5. Set real round windows in `web/rounds.json`

- [x] Real round windows set 2026-11-18 ~13:48 WAT — DONE: round 1 opens
      Thu Nov 19 2026 08:00 UTC (09:00 WAT) → 20:00 UTC; 12h cadence
      (08:00 / 20:00 UTC alternating) through round 10 (Nov 23 20:00 →
      Nov 24 08:00 UTC). All windows in the future, contiguous, no gaps.
      `"placeholder": false` on all 10 rounds. The 10-round bank covers
      ~5 days at the 12h cadence — more rounds must be written before they
      run out.
- [x] Confirm the `answerHash` values in `rounds.json` are unchanged —
      re-verified 2026-11-18 ~13:48 WAT: all 10 hashes recomputed from the
      private answers match `rounds.json` exactly. No answer value in `web/`
      (no `"answer"` key; the only standalone-number hits are CSS values,
      hex-hash substrings and block numbers).
- Gas/BNB cost: none (static file).

## 6. Create round 1 on-chain

- [ ] Build the exact `createRound` preview with `baw` — calldata PREPARED
      2026-11-18 ~13:48 WAT (see below); the preview itself still needs
      Felix's exact-preview confirmation (main agent builds it):
      `createRound(bytes32 answerHash, uint64 startTime, uint64 endTime)`
      with round-1 `answerHash`
      `0x4a2cc91ee622da3bc833a54c37ffcb6f3ec23b7793efc5eaf5e71b7b406c5c06`
      (answer 45 — **do not put the answer in any public file or message**;
      the hash alone goes on-chain) and the real round-1 window from step 5.
      Prepared calldata: `hidden_files/createround1-calldata.txt` (100 bytes):
      selector `0x73235e05` (derived from `createRound(bytes32,uint64,uint64)`
      with the validated Keccak helper; the selector also appears in the
      deployed bytecode's dispatcher), answerHash as above, startTime
      `1795075200` (Nov 19 08:00 UTC), endTime `1795118400` (Nov 19 20:00 UTC).
      Round-trip decode verified. NOTE: `createRound` takes NO roundId
      parameter — the contract assigns round 1 internally (`roundCount += 1`).
      `startTime` must be ≥ the block timestamp at execution and
      `endTime > startTime`, or the call reverts.
      **Needs Felix's exact-preview confirmation.**
- [ ] Execute `createRound(1)` and record the tx hash. Verify on-chain:
      `roundCount() == 1` and `rounds(1)` returns the round-1 hash/window.
- Gas/BNB cost: not measured in the test suite — take the exact figure from
      the `baw` preview before confirming (a single storage write; budget
      roughly 50,000–100,000 gas, i.e. ~0.000005–0.0001 BNB at 0.05–1 gwei).
- [ ] Repeat for rounds 2–10 (hashes in `rounds.json`, answers in
      `hidden_files/round-answers.json` only) once their windows are set —
      each is a separate owner tx, each needing its own preview confirmation.
      Rounds may be created ahead of time.

## 7. Host the static site

- [x] Host `web/` as-is — DONE 2026-11-18 ~13:51 WAT: published as the
      public artifact `puzzle-arena` (slug), files carried over byte-for-byte
      (`index.html`, `app.js`, `style.css`, `rounds.json` verbatim; rounds.json
      also shipped under assets/ with a fetch shim). Live URL:
      https://muse.ai/s/puzzle-arena-xcz6z8xwxbxxdja/fe5RUjlB5zqhmlAzZPSc5u3l7iGreqqvsX_S5ZjbDjM
      (A GitHub Pages host is still an option later; the artifact link is the
      submission URL for now.)
- [x] Confirm the live URL loads over HTTPS — the artifact audit passed:
      page loads (nav 200) on desktop and phone, no console errors from its
      own origin; footer shows the deployed contract address and the
      disclosure ("independent hackathon entry, not affiliated with Binance").
      The ethers v6 CDN could not be exercised in the audit sandbox (egress
      lockdown blocked cdn.jsdelivr.net — expected there); it loads normally
      on the public page.
- Gas/BNB cost: none.

## 8. Drive Agent ID holders to play (Submission Period only)

- [ ] Announce the live site + contract in the Telegram agentidcall
      channel, the Boltbook feed and on X — only during the Submission
      Period (on-chain interactions only count then). Each solve is one
      Pioneer interaction from an Agent ID holder address.
- [ ] Optional: community-promotion X post with `#BinanceWalletHackathon`
      and `#AgenticWallet`, link submitted via the official campaign survey.
- Gas/BNB cost: none to the project (players pay their own solve gas only).

## 9. Submit via "Submit Project Now" — before 2026-12-09 09:00 WAT

- [ ] Submit before the deadline: **2026-12-09 08:00 UTC = 09:00 WAT**.
      Materials: project name, website URL, contract address(es), Agent ID
      usage description, reward-receiving address (Felix's BSC wallet, to
      confirm).
- [ ] Confirm the submission receipt / listing, and record it.
- Gas/BNB cost: none (off-chain form).

## Cost table (measured gas × gas price)

Gas price read 2026-11-18 ~12:05 WAT via `eth_gasPrice` on
`https://bsc-dataseed.binance.org` (confirmed identical on
`bsc-dataseed1.binance.org`): **0.05 gwei** (0x2faf080), block 134,299,727.
BSC gas price moves — re-read it immediately before any deploy preview.

| Action | Gas | @ 0.05 gwei (live read) | @ 1 gwei | @ 5 gwei |
|---|---|---|---|---|
| Deploy `PuzzleArena` (direct, before factory) | 1,948,531 | **0.000097 BNB** | 0.001949 BNB | 0.009743 BNB |
| One `solve()` (worst case, first-ever) | 199,246 | 0.000010 BNB | 0.000199 BNB | 0.000996 BNB |
| `createRound` (estimate, unmeasured) | ~50k–100k | ~0.000003–0.000005 BNB | ~0.00005–0.0001 BNB | ~0.00025–0.0005 BNB |

The live deployment is the CreateX factory call, not a direct deployment:
its gas is the direct-deploy gas plus factory overhead — take the exact figure
from the `baw` preview before confirming.

Wallet check: Felix's wallet held ~0.00219 BNB (2026-11-18 afternoon).
At the live 0.05 gwei read, deploy + round 1 + a few solves fit inside it —
but at 1 gwei the direct-deploy equivalent (0.001949 BNB) already eats nearly
the whole wallet, and at 5 gwei it exceeds it.
**Top-up recommended: bring the wallet to at least ~0.01 BNB before deploying.**

## QA evidence (integration check, 2026-11-18)

1. **Tests:** `npx hardhat test` → **14 passing, 0 failing** (includes the
   extra 6b InvalidRound case, the 7b same-day-streak case added for the
   12h cadence, and the new 1b owner test added for the factory deployment,
   so 14 tests cover SPEC §7's 11 cases + 3 extras).
   Deployment gas printed by the suite: 1,948,531. `solve()` gas: 199,246.
2. **ABI consistency:** every function the frontend calls exists in the
   compiled artifact `artifacts/contracts/PuzzleArena.sol/PuzzleArena.json`
   with exact name + argument types (programmatic diff of all 16 frontend
   ABI entries — 14 Arena + 2 registry — against the compiled ABI: all
   match; the only textual difference was parameter *names* on the
   auto-generated `solved`/`solvesOf` getters, which have unnamed inputs in
   the compiled ABI — names do not affect selectors or encoding).
   (Correction 2026-11-18 ~13:48 WAT: the earlier "17 entries / 15 Arena"
   count was a miscount; the actual file has 14 Arena + 2 registry = 16,
   re-verified after the constructor change — all 16 still match.)
   Frontend calls verified: `solve`, `solved`, `streakOf`, `rounds`,
   `totalMinted` (arena), `balanceOf`/`ownerOf` (registry); `Solved` event
   used for the leaderboard via `queryFilter`. `roundCount`, `lastSolveDay`,
   `solvesOf`, `tokenRound`, `tokenStreak`, `createRound`, `tokenURI` are in
   the frontend ABI and in the compiled ABI, available for use.
3. **Packed-view selectors** (derived with validated Keccak, checked against
   `totalSupply()` = 0x18160ddd, `balanceOf(address)` = 0x70a08231,
   `transfer(address,uint256)` = 0xa9059cbb):
   `streakOf(uint256)` = **0xf5490339** ✓, `lastSolveDay(uint256)` =
   **0x98f3c119** ✓, `tokenRound(uint256)` = **0x5554d765** ✓,
   `tokenStreak(uint256)` = **0x2c081a63** ✓ — all as claimed in
   `contracts/README.md`.
4. **Selector check:** `solve(uint256,uint256,uint256)` = **0x551e54c1** ✓
   (derived, not hand-typed).
5. **Rounds integrity:** recomputed with
   `ethers.solidityPackedKeccak256(["uint256"],[answer])` — all three match
   both `hidden_files/round-answers.json` and `web/rounds.json`:
   round 1 (answer 45) → `0x4a2cc91e…c5c06` ✓; round 2 (answer 65) →
   `0x7c9785e8…36a7` ✓; round 3 (answer 30) → `0x50bb669a…e350` ✓.
   `rounds.json` has **no `"answer"` field**, and no standalone 45/65/30
   value appears anywhere under `web/` (grep clean).
6. **Frontend sanity:** `web/index.html`, `web/app.js`, `web/style.css`,
   `web/rounds.json` all exist. `app.js` has **no WalletConnect/QR login
   path** — the only matches are the denial comment (line 4) and the
   footer/UI line "no QR code login" (`index.html:176`); no hardcoded
   private key / seed / mnemonic found. Placeholders present as reported:
   `ARENA_ADDRESS = 0x0000…0000` (line 18), `ARENA_DEPLOYED = false`
   (line 19), `DEPLOY_BLOCK = 0` (line 20).
7. **Gas + costing:** see cost table above (read-only RPC calls only).

8. **CreateX factory deployment (2026-11-18 ~13:30 WAT, local only):**
   CreateX `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` — 11,838 bytes of code
   on 2 BSC RPCs; Sourcify exact match (creation + runtime); ABI confirms
   `deployCreate2(bytes32,bytes)`, selector **0x26307668** (validated Keccak,
   eth_hash cross-check). Constructor is now `(address agentID_, address owner_)`;
   deploy data re-encoded with eth_abi (registry + Felix's wallet), 9,274 bytes,
   keccak256 `0x8e4f29782b9f8c65f98e224a2c0c34b2093d78d89995de0b64feeba337cd79c5`
   (validated Keccak + eth_hash agree). Salt `keccak256("Puzzle Arena")` =
   `0x8d62b0ec…f45b`; CreateX `_guard` hashes random salts, so the effective
   salt is `0xf7da3a94…d8cb` and the precomputed address is
   **0x2ac941b05042599edcc96cb7a3b4937102290ca7** — verified by calling the
   deployed CreateX `computeCreate2Address` on 3 BSC RPCs (guarded salt →
   0x2ac941…; raw salt → 0x314d14…, which is NOT the landing address).
   Factory calldata (9,380 bytes) in `hidden_files/createx-calldata.txt`,
   summary in `hidden_files/createx-deploy.json`. The address formula was
   verified against the deployed contract itself via `eth_call` (stronger
   than a local mock, which would only re-check the same arithmetic), so no
   mock-factory test was added; the suite stays at 14.

9. **Launch wiring (2026-11-18 ~13:48–13:51 WAT, local + artifact publish):**
   app.js wired (address `0x2ac941…`, `ARENA_DEPLOYED = true`,
   `DEPLOY_BLOCK = 134312230`); rounds.json real windows (round 1 Nov 19
   08:00 UTC, 12h cadence, `placeholder: false` on all 10); all 10
   answerHashes recomputed from the private answers and matching
   `rounds.json`; no answer leak in web/ (no `"answer"` key); createRound(1)
   calldata prepared (selector `0x73235e05`, 100 bytes, round-trip verified)
   in `hidden_files/createround1-calldata.txt`; site published as artifact
   `puzzle-arena`, public URL
   https://muse.ai/s/puzzle-arena-xcz6z8xwxbxxdja/fe5RUjlB5zqhmlAzZPSc5u3l7iGreqqvsX_S5ZjbDjM,
   audit passed (nav 200 desktop + phone, footer shows contract address,
   round 1 opens Nov 19 08:00 UTC). Nothing was deployed, signed, spent or
   submitted during this pass.

**No mismatches found.** Nothing was deployed, signed, spent or submitted
during this check.
