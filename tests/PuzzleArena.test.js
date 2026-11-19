const { expect } = require("chai");
const hre = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { ethers } = hre;

// Puzzle Arena test suite — SPEC §7, all 11 cases.
// Answer hash is derived with ethers' keccak256 (solidityPackedKeccak256),
// never hand-typed: keccak256(abi.encodePacked(answer)).

const ANSWER = 42n;
const OTHER_ANSWER = 7n;

function answerHash(answer) {
  return ethers.solidityPackedKeccak256(["uint256"], [answer]);
}

function agentIdOf(handle) {
  return BigInt(ethers.solidityPackedKeccak256(["string"], [handle]));
}

describe("PuzzleArena", function () {
  async function deployFixture() {
    const [owner, holder, otherHolder, stranger] = await ethers.getSigners();

    const MockAgentID = await ethers.getContractFactory("MockAgentID");
    const mock = await MockAgentID.deploy();

    const holderAgentId = agentIdOf("egwu");
    const otherAgentId = agentIdOf("otheragent");
    await mock.mint(holder.address, holderAgentId);
    await mock.mint(otherHolder.address, otherAgentId);

    const PuzzleArena = await ethers.getContractFactory("PuzzleArena");
    const arena = await PuzzleArena.deploy(await mock.getAddress(), owner.address);

    return { arena, mock, owner, holder, otherHolder, stranger, holderAgentId, otherAgentId };
  }

  // Helper: create a round starting at `start` (or just after the latest block
  // if `start` is already behind — each mined tx advances the clock by 1s),
  // lasting `duration` seconds. Returns the actual start used.
  async function createOpenRound(arena, start, duration = 86400) {
    const startTime = Math.max(start, (await time.latest()) + 1);
    const end = startTime + duration;
    await arena.createRound(answerHash(ANSWER), startTime, end);
    return { start: startTime, end };
  }

  // 1. Deploy: name/symbol, registry address stored, owner set.
  it("1. deploys with correct name, symbol, registry and owner", async function () {
    const { arena, mock, owner } = await deployFixture();
    expect(await arena.name()).to.equal("Puzzle Arena Solve");
    expect(await arena.symbol()).to.equal("PZSOLVE");
    expect(await arena.agentID()).to.equal(await mock.getAddress());
    expect(await arena.owner()).to.equal(owner.address);
    expect(await arena.totalMinted()).to.equal(0);
    expect(await arena.roundCount()).to.equal(0);

    // Deployment gas (reported for the deployment budget, SPEC §10).
    const receipt = await arena.deploymentTransaction().wait();
    console.log(`      deployment gas: ${receipt.gasUsed}`);
  });

  // 1b. Owner is the passed constructor argument, NOT the deployer.
  // (The live deployment goes through a factory, so msg.sender at
  // construction is the factory — ownership must come from owner_.)
  it("1b. owner is the passed address, not the deployer", async function () {
    const { mock, owner, stranger } = await deployFixture();
    const PuzzleArena = await ethers.getContractFactory("PuzzleArena");
    // Deployed BY `owner`, but owned by `stranger`.
    const arena = await PuzzleArena.deploy(await mock.getAddress(), stranger.address);

    expect(await arena.owner()).to.equal(stranger.address);
    expect(await arena.owner()).to.not.equal(owner.address);

    // The passed owner can createRound; the deployer cannot.
    const now = await time.latest();
    const start = now + 3600;
    const end = start + 86400;
    await expect(arena.connect(stranger).createRound(answerHash(ANSWER), start, end))
      .to.emit(arena, "RoundCreated")
      .withArgs(1, start, end);
    await expect(arena.createRound(answerHash(ANSWER), start, end))
      .to.be.revertedWithCustomError(arena, "OwnableUnauthorizedAccount");
  });

  // 2. createRound onlyOwner; rejects zero hash, end <= start, start in the past.
  it("2. createRound: onlyOwner and input validation", async function () {
    const { arena, stranger } = await deployFixture();
    const now = await time.latest();
    const start = now + 3600;
    const end = start + 86400;

    await expect(arena.connect(stranger).createRound(answerHash(ANSWER), start, end))
      .to.be.revertedWithCustomError(arena, "OwnableUnauthorizedAccount");

    await expect(arena.createRound(ethers.ZeroHash, start, end)).to.be.revertedWith(
      "PuzzleArena: zero answer hash",
    );
    await expect(arena.createRound(answerHash(ANSWER), start, start)).to.be.revertedWith(
      "PuzzleArena: end must be after start",
    );
    await expect(arena.createRound(answerHash(ANSWER), start, start - 1)).to.be.revertedWith(
      "PuzzleArena: end must be after start",
    );
    await expect(arena.createRound(answerHash(ANSWER), now - 1, end)).to.be.revertedWith(
      "PuzzleArena: start in the past",
    );

    await expect(arena.createRound(answerHash(ANSWER), start, end))
      .to.emit(arena, "RoundCreated")
      .withArgs(1, start, end);
    expect(await arena.roundCount()).to.equal(1);
    const round = await arena.rounds(1);
    expect(round.answerHash).to.equal(answerHash(ANSWER));
    expect(round.startTime).to.equal(start);
    expect(round.endTime).to.equal(end);
    expect(round.solves).to.equal(0);
  });

  // 3. Non-holder cannot solve; holder with a foreign agentId cannot solve.
  it("3. non-holder and foreign-agentId solves revert NotAgentHolder", async function () {
    const { arena, holder, otherHolder, stranger, holderAgentId, otherAgentId } =
      await deployFixture();
    const now = await time.latest();
    await createOpenRound(arena, now);

    // Stranger holds no Agent ID at all.
    await expect(arena.connect(stranger).solve(1, holderAgentId, ANSWER)).to.be.revertedWithCustomError(
      arena,
      "NotAgentHolder",
    );
    // Holder passes someone else's agentId.
    await expect(arena.connect(holder).solve(1, otherAgentId, ANSWER)).to.be.revertedWithCustomError(
      arena,
      "NotAgentHolder",
    );
    // Other holder passes the first holder's agentId.
    await expect(
      arena.connect(otherHolder).solve(1, holderAgentId, ANSWER),
    ).to.be.revertedWithCustomError(arena, "NotAgentHolder");
  });

  // 4. Wrong answer reverts; correct answer mints, emits Solved, sets state.
  it("4. wrong answer reverts; correct answer mints the Solve NFT", async function () {
    const { arena, holder, holderAgentId } = await deployFixture();
    const now = await time.latest();
    await createOpenRound(arena, now);

    await expect(arena.connect(holder).solve(1, holderAgentId, OTHER_ANSWER))
      .to.be.revertedWithCustomError(arena, "WrongAnswer");
    expect(await arena.solved(1, holderAgentId)).to.equal(false);

    await expect(arena.connect(holder).solve(1, holderAgentId, ANSWER))
      .to.emit(arena, "Solved")
      .withArgs(1, holderAgentId, holder.address, 1, 1);

    expect(await arena.ownerOf(1)).to.equal(holder.address);
    expect(await arena.totalMinted()).to.equal(1);
    expect(await arena.solved(1, holderAgentId)).to.equal(true);
    expect(await arena.solvesOf(holderAgentId)).to.equal(1);
    expect(await arena.streakOf(holderAgentId)).to.equal(1);
    expect(await arena.tokenRound(1)).to.equal(1);
    expect(await arena.tokenStreak(1)).to.equal(1);
    const round = await arena.rounds(1);
    expect(round.solves).to.equal(1);
  });

  // 5. Second solve of the same round by the same agentId reverts AlreadySolved.
  it("5. double-solve of the same round reverts AlreadySolved", async function () {
    const { arena, holder, otherHolder, holderAgentId } = await deployFixture();
    const now = await time.latest();
    await createOpenRound(arena, now);

    await arena.connect(holder).solve(1, holderAgentId, ANSWER);
    await expect(arena.connect(holder).solve(1, holderAgentId, ANSWER)).to.be.revertedWithCustomError(
      arena,
      "AlreadySolved",
    );
    // A different wallet cannot pass the ownerOf check for this agentId either.
    await expect(
      arena.connect(otherHolder).solve(1, holderAgentId, ANSWER),
    ).to.be.revertedWithCustomError(arena, "NotAgentHolder");
  });

  // 6. Solve before startTime / after endTime reverts RoundNotOpen.
  it("6. solve outside the round window reverts RoundNotOpen", async function () {
    const { arena, holder, holderAgentId } = await deployFixture();
    const now = await time.latest();
    const start = now + 3600;
    const end = start + 3600;
    await arena.createRound(answerHash(ANSWER), start, end);

    await expect(arena.connect(holder).solve(1, holderAgentId, ANSWER)).to.be.revertedWithCustomError(
      arena,
      "RoundNotOpen",
    );

    await time.increaseTo(end + 1);
    await expect(arena.connect(holder).solve(1, holderAgentId, ANSWER)).to.be.revertedWithCustomError(
      arena,
      "RoundNotOpen",
    );
  });

  // 6b. Unknown roundId reverts InvalidRound (SPEC §4.2 behaviour step 1).
  it("6b. unknown roundId reverts InvalidRound", async function () {
    const { arena, holder, holderAgentId } = await deployFixture();
    await expect(arena.connect(holder).solve(0, holderAgentId, ANSWER)).to.be.revertedWithCustomError(
      arena,
      "InvalidRound",
    );
    await expect(arena.connect(holder).solve(99, holderAgentId, ANSWER)).to.be.revertedWithCustomError(
      arena,
      "InvalidRound",
    );
  });

  // 7. Streaks across UTC days (Hardhat time manipulation).
  it("7. streaks increment on consecutive UTC days and reset after a skipped day", async function () {
    const { arena, holder, holderAgentId } = await deployFixture();

    // Day 1: solve round 1 -> streak 1.
    let now = await time.latest();
    const day1 = Math.floor(now / 86400);
    await createOpenRound(arena, now);
    await arena.connect(holder).solve(1, holderAgentId, ANSWER);
    expect(await arena.streakOf(holderAgentId)).to.equal(1);

    // Day 2 (next UTC day): solve round 2 -> streak 2.
    const day2Start = (day1 + 1) * 86400 + 60;
    await time.increaseTo(day2Start);
    await createOpenRound(arena, day2Start);
    await arena.connect(holder).solve(2, holderAgentId, ANSWER);
    expect(await arena.streakOf(holderAgentId)).to.equal(2);
    expect(await arena.lastSolveDay(holderAgentId)).to.equal(day1 + 1);

    // Day 4 (skip day 3): solve round 3 -> streak resets to 1.
    const day4Start = (day1 + 3) * 86400 + 60;
    await time.increaseTo(day4Start);
    await createOpenRound(arena, day4Start);
    await arena.connect(holder).solve(3, holderAgentId, ANSWER);
    expect(await arena.streakOf(holderAgentId)).to.equal(1);
    expect(await arena.solvesOf(holderAgentId)).to.equal(3);
    expect(await arena.tokenStreak(3)).to.equal(1);
  });

  // 7b. 12h cadence: a second solve on the SAME UTC day keeps the streak
  // (it must not reset it — with two rounds per day this is the common case).
  it("7b. same-day second solve keeps the streak (12h cadence)", async function () {
    const { arena, holder, holderAgentId } = await deployFixture();

    // Day 1: solve round 1 -> streak 1.
    let now = await time.latest();
    const day1 = Math.floor(now / 86400);
    await createOpenRound(arena, now);
    await arena.connect(holder).solve(1, holderAgentId, ANSWER);
    expect(await arena.streakOf(holderAgentId)).to.equal(1);

    // Day 2: solve round 2 -> streak 2.
    const day2Start = (day1 + 1) * 86400 + 60;
    await time.increaseTo(day2Start);
    await createOpenRound(arena, day2Start);
    await arena.connect(holder).solve(2, holderAgentId, ANSWER);
    expect(await arena.streakOf(holderAgentId)).to.equal(2);

    // Day 2 again (second round of the day): solve round 3 -> streak STAYS 2.
    await createOpenRound(arena, day2Start);
    await arena.connect(holder).solve(3, holderAgentId, ANSWER);
    expect(await arena.streakOf(holderAgentId)).to.equal(2);
    expect(await arena.lastSolveDay(holderAgentId)).to.equal(day1 + 1);
    expect(await arena.tokenStreak(3)).to.equal(2);
    expect(await arena.solvesOf(holderAgentId)).to.equal(3);

    // Day 3: solve round 4 -> streak 3 (builds on the preserved streak).
    const day3Start = (day1 + 2) * 86400 + 60;
    await time.increaseTo(day3Start);
    await createOpenRound(arena, day3Start);
    await arena.connect(holder).solve(4, holderAgentId, ANSWER);
    expect(await arena.streakOf(holderAgentId)).to.equal(3);
  });

  // 8. tokenURI returns a valid data:image/svg+xml;base64 URI with round + token id.
  it("8. tokenURI is a valid on-chain SVG data URI", async function () {
    const { arena, holder, holderAgentId } = await deployFixture();
    const now = await time.latest();
    await createOpenRound(arena, now);
    await arena.connect(holder).solve(1, holderAgentId, ANSWER);

    const uri = await arena.tokenURI(1);
    expect(uri.startsWith("data:image/svg+xml;base64,")).to.equal(true);
    const svg = Buffer.from(uri.replace("data:image/svg+xml;base64,", ""), "base64").toString(
      "utf8",
    );
    expect(svg).to.include("<svg");
    expect(svg).to.include("PUZZLE ARENA");
    expect(svg).to.include("ROUND 1");
    expect(svg).to.include("TOKEN #1");
    expect(svg).to.include("STREAK 1");
    expect(svg).to.include("SOLVED");
    // No external resources: the only "http" in the SVG is the mandatory
    // xmlns namespace identifier, never a fetched URL.
    expect(svg).to.not.include("https://");
    expect(svg).to.not.include("href=");

    await expect(arena.tokenURI(999)).to.be.revertedWith("PuzzleArena: token does not exist");
  });

  // 9. Sending BNB to the contract reverts (no payable entry point).
  it("9. sending BNB to the contract reverts", async function () {
    const { arena, holder } = await deployFixture();
    await expect(
      holder.sendTransaction({ to: await arena.getAddress(), value: ethers.parseEther("0.01") }),
    ).to.be.reverted;
    expect(await ethers.provider.getBalance(await arena.getAddress())).to.equal(0);
  });

  // 10. solve() gas < 220,000.
  it("10. solve() gas is under 220,000", async function () {
    const { arena, holder, holderAgentId } = await deployFixture();
    const now = await time.latest();
    await createOpenRound(arena, now);

    const tx = await arena.connect(holder).solve(1, holderAgentId, ANSWER);
    const receipt = await tx.wait();
    console.log(`      solve() gas used: ${receipt.gasUsed}`);
    expect(receipt.gasUsed).to.be.lessThan(220000);
  });

  // 11. Multi-round independence.
  it("11. solving round 1 then round 2 works; solves are independent per round", async function () {
    const { arena, holder, otherHolder, holderAgentId, otherAgentId } = await deployFixture();
    const now = await time.latest();
    await createOpenRound(arena, now);
    await createOpenRound(arena, now);

    await arena.connect(holder).solve(1, holderAgentId, ANSWER);
    await arena.connect(holder).solve(2, holderAgentId, ANSWER);
    await arena.connect(otherHolder).solve(1, otherAgentId, ANSWER);

    expect(await arena.solved(1, holderAgentId)).to.equal(true);
    expect(await arena.solved(2, holderAgentId)).to.equal(true);
    expect(await arena.solved(1, otherAgentId)).to.equal(true);
    expect(await arena.solved(2, otherAgentId)).to.equal(false);
    expect(await arena.solvesOf(holderAgentId)).to.equal(2);
    expect(await arena.solvesOf(otherAgentId)).to.equal(1);
    expect(await arena.totalMinted()).to.equal(3);
    expect(await arena.ownerOf(2)).to.equal(holder.address);
    expect(await arena.ownerOf(3)).to.equal(otherHolder.address);
    expect(await arena.tokenRound(2)).to.equal(2);
    expect(await arena.tokenRound(3)).to.equal(1);
    const r1 = await arena.rounds(1);
    const r2 = await arena.rounds(2);
    expect(r1.solves).to.equal(2);
    expect(r2.solves).to.equal(1);
  });
});
