/* Puzzle Arena — static dApp frontend.
 *
 * Injected provider only (window.ethereum — Binance Wallet / MetaMask).
 * No WalletConnect, no QR code, no server sessions, no backend.
 * All contract reads go through a public BSC RPC, so the page works
 * read-only without a wallet connected.
 *
 * Contract interface: exactly SPEC section 4.1. No extra functions assumed.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- config
  // Deployed 2026-11-18 ~13:35 WAT via the CreateX factory:
  // PuzzleArena 0x2ac941b05042599edcc96cb7a3b4937102290ca7 on BSC mainnet
  // (chain 56), block 134312230, owner = Felix's wallet. The solve flow and
  // the on-chain leaderboard are live.
  var ARENA_ADDRESS = '0x2ac941b05042599edcc96cb7a3b4937102290ca7';
  var ARENA_DEPLOYED = true;
  var DEPLOY_BLOCK = 134312230; // first block to scan for Solved events

  var REGISTRY_ADDRESS = '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F';
  var BSC_CHAIN_ID = 56;
  var BSC_CHAIN_ID_HEX = '0x38';

  // Public BSC RPCs, tried in order. Never a private node.
  var RPC_URLS = [
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://1rpc.io/bnb'
  ];

  // Registry ABI (Agent ID, ERC-721): only the two functions the spec uses.
  var REGISTRY_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)'
  ];

  // PuzzleArena ABI — exactly SPEC section 4.1, nothing extra.
  var ARENA_ABI = [
    'function totalMinted() view returns (uint256)',
    'function roundCount() view returns (uint256)',
    'function rounds(uint256) view returns (bytes32 answerHash, uint64 startTime, uint64 endTime, uint32 solves)',
    'function solved(uint256 roundId, uint256 agentId) view returns (bool)',
    'function streakOf(uint256 agentId) view returns (uint256)',
    'function lastSolveDay(uint256 agentId) view returns (uint256)',
    'function solvesOf(uint256 agentId) view returns (uint256)',
    'function tokenRound(uint256 tokenId) view returns (uint256)',
    'function tokenStreak(uint256 tokenId) view returns (uint256)',
    'function createRound(bytes32 answerHash, uint64 startTime, uint64 endTime)',
    'function solve(uint256 roundId, uint256 agentId, uint256 answer)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'event RoundCreated(uint256 indexed roundId, uint64 startTime, uint64 endTime)',
    'event Solved(uint256 indexed roundId, uint256 indexed agentId, address indexed solver, uint256 tokenId, uint256 streak)'
  ];

  // ---------------------------------------------------------------- state
  var rounds = [];            // from rounds.json
  var currentRound = null;
  var readProvider = null;    // public RPC (no wallet needed)
  var registryRead = null;
  var arenaRead = null;
  var walletProvider = null;  // injected provider, only after connect
  var signer = null;
  var walletAddress = null;
  var agentId = null;         // BigInt, derived from the user's own handle
  var agentIdVerified = false;
  var pendingTx = null;       // { roundId, agentId, answer, gasEstimate }

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function setStatus(node, msg, kind) {
    node.textContent = msg;
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  function truncAgentId(agentIdValue) {
    // Display only: 0x7d72…e97 — never a handle, never a wallet address.
    var hex = BigInt(agentIdValue).toString(16).padStart(64, '0');
    return '0x' + hex.slice(0, 4) + '…' + hex.slice(-3);
  }

  function fmtTime(unixSeconds) {
    return new Date(unixSeconds * 1000).toUTCString().replace(' GMT', ' UTC');
  }

  function shortAddress(addr) {
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  async function getReadProvider() {
    if (readProvider) return readProvider;
    var lastErr = null;
    for (var i = 0; i < RPC_URLS.length; i++) {
      try {
        var p = new ethers.JsonRpcProvider(RPC_URLS[i]);
        await p.getBlockNumber(); // prove the endpoint answers
        readProvider = p;
        registryRead = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, p);
        if (ARENA_DEPLOYED) {
          arenaRead = new ethers.Contract(ARENA_ADDRESS, ARENA_ABI, p);
        }
        return p;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('No public BSC RPC answered.');
  }

  // ---------------------------------------------------------------- rounds
  async function loadRounds() {
    var res = await fetch('rounds.json');
    if (!res.ok) throw new Error('Could not load rounds.json (HTTP ' + res.status + ').');
    var data = await res.json();
    rounds = Array.isArray(data) ? data : data.rounds;
    rounds.sort(function (a, b) { return a.roundId - b.roundId; });
    var now = Math.floor(Date.now() / 1000);
    currentRound = null;
    for (var i = 0; i < rounds.length; i++) {
      if (rounds[i].startTime <= now && now < rounds[i].endTime) { currentRound = rounds[i]; break; }
    }
    if (!currentRound) {
      for (var j = 0; j < rounds.length; j++) {
        if (rounds[j].startTime > now) { currentRound = rounds[j]; break; }
      }
      if (!currentRound) currentRound = rounds[rounds.length - 1];
    }
  }

  function roundState(r) {
    var now = Math.floor(Date.now() / 1000);
    if (now < r.startTime) return 'Opens ' + fmtTime(r.startTime);
    if (now >= r.endTime) return 'Sealed ' + fmtTime(r.endTime);
    return 'Open now — seals ' + fmtTime(r.endTime);
  }

  async function renderCurrentRound() {
    var box = $('roundCard');
    box.innerHTML = '';
    if (!currentRound) {
      box.appendChild(el('p', 'muted', 'No rounds scheduled yet.'));
      return;
    }
    var r = currentRound;
    box.appendChild(el('p', 'round-meta', 'Round ' + r.roundId + ' · ' + roundState(r)));
    box.appendChild(el('p', 'question', r.question));
    box.appendChild(el('p', 'hint', 'Hint: ' + r.hint));
    var meta = el('p', 'round-meta', 'Window: ' + fmtTime(r.startTime) + ' → ' + fmtTime(r.endTime) + ' (UTC).');
    box.appendChild(meta);
    if (r.placeholder) {
      box.appendChild(el('p', 'placeholder-note',
        'Placeholder window — the round times will be reset at deploy time.'));
    }
    var solvesLine = el('p', 'round-meta', '');
    box.appendChild(solvesLine);
    if (ARENA_DEPLOYED) {
      try {
        await getReadProvider();
        var onChain = await arenaRead.rounds(r.roundId);
        solvesLine.textContent = 'Solves so far: ' + onChain.solves.toString() + '.';
        if (agentIdVerified) {
          var done = await arenaRead.solved(r.roundId, agentId);
          var streak = await arenaRead.streakOf(agentId);
          var state = el('p', 'round-meta', done
            ? 'You have solved this round. Your current streak: ' + streak.toString() + ' day(s).'
            : 'You have not solved this round yet.');
          box.appendChild(state);
        }
      } catch (e) { solvesLine.textContent = 'Solves so far: unavailable (public RPC error).'; }
    } else {
      solvesLine.textContent = 'Solves so far: — (contract not deployed yet).';
    }
  }

  function renderPastRounds() {
    var box = $('pastRounds');
    box.innerHTML = '';
    var now = Math.floor(Date.now() / 1000);
    var past = rounds.filter(function (r) { return r.endTime <= now; });
    if (!past.length) {
      box.appendChild(el('p', 'muted', 'No sealed rounds yet. Sealed rounds will appear here.'));
      return;
    }
    past.forEach(function (r) {
      var card = el('div', 'card');
      card.appendChild(el('p', 'round-meta', 'Round ' + r.roundId + ' · Sealed ' + fmtTime(r.endTime)));
      card.appendChild(el('p', 'question', r.question));
      card.appendChild(el('p', 'hint', 'Hint: ' + r.hint));
      box.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- leaderboard
  async function loadLeaderboard() {
    var box = $('leaderboardBox');
    if (!ARENA_DEPLOYED) {
      box.innerHTML = '';
      box.appendChild(el('p', 'muted',
        'The leaderboard goes live once the Puzzle Arena contract is deployed. ' +
        'It is built from on-chain Solved events — most solves and longest streaks, ' +
        'with Agent IDs shown truncated.'));
      return;
    }
    box.innerHTML = '';
    box.appendChild(el('p', 'muted', 'Loading leaderboard…'));
    try {
      await getReadProvider();
      var filter = arenaRead.filters.Solved();
      var logs = await arenaRead.queryFilter(filter, DEPLOY_BLOCK, 'latest');
      if (!logs.length) {
        box.innerHTML = '';
        box.appendChild(el('p', 'muted', 'No solves yet. Be the first to solve a round.'));
        return;
      }
      // Aggregate per agentId: total solves, best streak, last solve time.
      var byAgent = {};
      logs.forEach(function (log) {
        var key = log.args.agentId.toString();
        if (!byAgent[key]) byAgent[key] = { agentId: log.args.agentId, solves: 0, bestStreak: 0n, lastBlock: 0 };
        byAgent[key].solves += 1;
        if (log.args.streak > byAgent[key].bestStreak) byAgent[key].bestStreak = log.args.streak;
        if (log.blockNumber > byAgent[key].lastBlock) byAgent[key].lastBlock = log.blockNumber;
      });
      var rows = Object.values(byAgent).sort(function (a, b) {
        return b.solves - a.solves || (b.bestStreak > a.bestStreak ? 1 : b.bestStreak < a.bestStreak ? -1 : 0);
      }).slice(0, 10);
      var table = el('table');
      var thead = el('thead');
      var headRow = el('tr');
      ['#', 'Agent ID', 'Solves', 'Best streak'].forEach(function (h, i) {
        headRow.appendChild(el('th', i >= 2 ? 'num' : '', h));
      });
      thead.appendChild(headRow);
      table.appendChild(thead);
      var tbody = el('tbody');
      rows.forEach(function (row, i) {
        var tr = el('tr');
        tr.appendChild(el('td', '', String(i + 1)));
        tr.appendChild(el('td', '', truncAgentId(row.agentId)));
        tr.appendChild(el('td', 'num', String(row.solves)));
        tr.appendChild(el('td', 'num', row.bestStreak.toString()));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      box.innerHTML = '';
      box.appendChild(table);
    } catch (e) {
      box.innerHTML = '';
      box.appendChild(el('p', 'muted', 'Leaderboard unavailable right now (public RPC error). Please try again later.'));
    }
  }

  // ---------------------------------------------------------------- wallet
  function updateSolveAvailability() {
    var canPlay = Boolean(walletAddress && agentIdVerified && currentRound && ARENA_DEPLOYED);
    $('answerInput').disabled = !canPlay;
    $('previewBtn').disabled = !canPlay;
    $('solveBtn').disabled = !(canPlay && pendingTx);
    if (!ARENA_DEPLOYED) {
      setStatus($('solveStatus'), 'Solving opens once the contract is deployed.', '');
    } else if (!walletAddress) {
      setStatus($('solveStatus'), 'Connect your wallet to play.', '');
    } else if (!agentIdVerified) {
      setStatus($('solveStatus'), 'Verify your Agent ID above to enable solving.', '');
    }
  }

  async function connectWallet() {
    var status = $('walletStatus');
    if (!window.ethereum) {
      setStatus(status, 'No injected wallet found. Install Binance Wallet or MetaMask, then reload this page.', 'error');
      return;
    }
    try {
      walletProvider = new ethers.BrowserProvider(window.ethereum);
      var accounts = await walletProvider.send('eth_requestAccounts', []);
      walletAddress = accounts[0];
      var network = await walletProvider.getNetwork();
      if (Number(network.chainId) !== BSC_CHAIN_ID) {
        setStatus(status, 'Switching to BNB Smart Chain (chain ID 56) — please confirm in your wallet…', '');
        try {
          await walletProvider.send('wallet_switchEthereumChain', [{ chainId: BSC_CHAIN_ID_HEX }]);
        } catch (switchErr) {
          setStatus(status, 'Please switch your wallet to BNB Smart Chain (chain ID 56) and reconnect.', 'error');
          return;
        }
        network = await walletProvider.getNetwork();
        if (Number(network.chainId) !== BSC_CHAIN_ID) {
          setStatus(status, 'Still not on BNB Smart Chain (chain ID 56). Solving is disabled.', 'error');
          return;
        }
      }
      signer = await walletProvider.getSigner();
      $('connectBtn').textContent = 'Connected: ' + shortAddress(walletAddress);
      setStatus(status, 'Connected as ' + shortAddress(walletAddress) + ' on BNB Smart Chain.', 'ok');

      // Gate 1: the connected wallet must hold an Agent ID.
      await getReadProvider();
      var balance = await registryRead.balanceOf(walletAddress);
      if (balance === 0n) {
        setStatus(status, 'You need an Agent ID — claim one in the Binance App (Wallet > homepage banner > Agent ID). Solving is disabled.', 'error');
        $('playBox').hidden = false;
        updateSolveAvailability();
        return;
      }
      // Restore the user's own handle from this browser only.
      var saved = window.localStorage.getItem('puzzleArena.handle');
      if (saved) { $('handleInput').value = saved; await verifyHandle(); }
      $('playBox').hidden = false;
      updateSolveAvailability();
      await renderCurrentRound();
    } catch (e) {
      setStatus(status, 'Could not connect wallet: ' + (e && e.message ? e.message : e), 'error');
    }
  }

  async function verifyHandle() {
    var status = $('handleStatus');
    var handle = $('handleInput').value.trim();
    if (!handle) { setStatus(status, 'Type your own Agent ID handle first.', 'error'); return; }
    if (!walletAddress) { setStatus(status, 'Connect your wallet first.', 'error'); return; }
    try {
      // agentId = keccak256(handle), exactly as the registry defines it.
      var computed = ethers.keccak256(ethers.toUtf8Bytes(handle));
      var candidate = BigInt(computed);
      await getReadProvider();
      var owner = await registryRead.ownerOf(candidate);
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        agentIdVerified = false;
        agentId = null;
        setStatus(status, 'That Agent ID does not belong to the connected wallet. Check the handle and the wallet, then try again.', 'error');
        updateSolveAvailability();
        return;
      }
      agentId = candidate;
      agentIdVerified = true;
      window.localStorage.setItem('puzzleArena.handle', handle);
      setStatus(status, 'Verified — this Agent ID belongs to your connected wallet. You can now solve.', 'ok');
      updateSolveAvailability();
      await renderCurrentRound();
    } catch (e) {
      agentIdVerified = false;
      agentId = null;
      setStatus(status, 'Could not verify that Agent ID on-chain: ' + (e && e.message ? e.message : e), 'error');
      updateSolveAvailability();
    }
  }

  async function previewSolve() {
    var status = $('solveStatus');
    var raw = $('answerInput').value.trim();
    if (raw === '' || !/^\d+$/.test(raw)) {
      setStatus(status, 'Enter a whole-number answer first.', 'error');
      return;
    }
    if (!agentIdVerified || agentId === null) {
      setStatus(status, 'Verify your Agent ID first.', 'error');
      return;
    }
    if (!ARENA_DEPLOYED) {
      setStatus(status, 'The contract is not deployed yet — no transaction can be built.', 'error');
      return;
    }
    try {
      var answer = BigInt(raw);
      var arena = new ethers.Contract(ARENA_ADDRESS, ARENA_ABI, signer);
      var gas = await arena.solve.estimateGas(currentRound.roundId, agentId, answer);
      pendingTx = { roundId: currentRound.roundId, agentId: agentId, answer: answer, gasEstimate: gas };
      $('txContract').textContent = ARENA_ADDRESS;
      $('txFunction').textContent = 'solve(uint256 roundId, uint256 agentId, uint256 answer)';
      $('txRound').textContent = 'Round ' + currentRound.roundId;
      $('txAgentId').textContent = '0x' + agentId.toString(16).padStart(64, '0');
      $('txAnswer').textContent = answer.toString();
      $('txGas').textContent = gas.toString() + ' gas (estimate)';
      $('txPreview').hidden = false;
      setStatus(status, 'Review the transaction above. Nothing is sent until you confirm it in your own wallet.', '');
      updateSolveAvailability();
    } catch (e) {
      pendingTx = null;
      $('txPreview').hidden = true;
      setStatus(status, 'Could not build the transaction: ' + (e && e.reason ? e.reason : e.message || e), 'error');
      updateSolveAvailability();
    }
  }

  async function executeSolve() {
    var status = $('solveStatus');
    if (!pendingTx) { setStatus(status, 'Preview the transaction first.', 'error'); return; }
    var tx = pendingTx;
    try {
      setStatus(status, 'Confirm the transaction in your wallet…', '');
      var arena = new ethers.Contract(ARENA_ADDRESS, ARENA_ABI, signer);
      var sent = await arena.solve(tx.roundId, tx.agentId, tx.answer);
      setStatus(status, 'Transaction sent (' + sent.hash + '). Waiting for it to be mined…', '');
      var receipt = await sent.wait();
      if (receipt.status !== 1) {
        setStatus(status, 'Transaction failed on-chain. Nothing was minted.', 'error');
        return;
      }
      // Read the tokenId from the receipt's Transfer event (standard ERC-721
      // mint event: from the zero address). Parsed with a standalone
      // Transfer interface — the arena ABI itself stays exactly SPEC 4.1.
      var transferIface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
      ]);
      var tokenId = null;
      for (var i = 0; i < receipt.logs.length; i++) {
        try {
          var parsed = transferIface.parseLog(receipt.logs[i]);
          if (parsed && parsed.args.from === ethers.ZeroAddress) {
            tokenId = parsed.args.tokenId;
            break;
          }
        } catch (e) { /* log is not a Transfer event — ignore */ }
      }
      // Fallback: totalMinted is sequential and the new token is the latest.
      if (tokenId === null) {
        var minted = await arenaRead.totalMinted();
        tokenId = minted;
      }
      $('mintTokenId').textContent = '#' + tokenId.toString();
      var text = 'I solved Puzzle Arena round ' + tx.roundId +
        ' and minted Solve NFT #' + tokenId.toString() + '! 🧩';
      $('shareXBtn').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
      $('mintResult').hidden = false;
      setStatus(status, 'Solved! Your Solve NFT is #' + tokenId.toString() + '.', 'ok');
      pendingTx = null;
      $('txPreview').hidden = true;
      updateSolveAvailability();
      await renderCurrentRound();
      await loadLeaderboard();
    } catch (e) {
      setStatus(status, 'Transaction was not completed: ' + (e && e.message ? e.message : e), 'error');
    }
  }

  // ---------------------------------------------------------------- boot
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof ethers === 'undefined') {
      $('walletStatus').textContent = 'Could not load the ethers library from the CDN. Check your connection and reload.';
      return;
    }
    if (!ARENA_DEPLOYED) $('deployBanner').hidden = false;
    $('connectBtn').addEventListener('click', connectWallet);
    $('verifyHandleBtn').addEventListener('click', verifyHandle);
    $('previewBtn').addEventListener('click', previewSolve);
    $('solveBtn').addEventListener('click', executeSolve);
    $('answerInput').addEventListener('input', function () {
      pendingTx = null;
      $('txPreview').hidden = true;
      updateSolveAvailability();
    });
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', function () { window.location.reload(); });
      window.ethereum.on('chainChanged', function () { window.location.reload(); });
    }
    loadRounds()
      .then(function () { return renderCurrentRound(); })
      .then(function () { renderPastRounds(); })
      .catch(function (e) {
        $('roundCard').innerHTML = '';
        $('roundCard').appendChild(el('p', 'muted', 'Could not load rounds: ' + e.message));
      });
    loadLeaderboard();
  });
})();
