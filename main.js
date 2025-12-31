// 中国象棋人机对战 - 优化版
const ROWS = 10;
const COLS = 9;

let board = [];
let currentPlayer = "red";
let selected = null;
let legalMoves = [];
let gameOver = false;
let history = [];
let lastMove = null;
let pieceIdCounter = 0;
let isReplaying = false;
let replayIndex = -1;

const boardEl = document.getElementById("board");
const statusTextEl = document.getElementById("status-text");
const difficultyEl = document.getElementById("difficulty");
const restartBtn = document.getElementById("restart-btn");
const undoBtn = document.getElementById("undo-btn");
const replayBtn = document.getElementById("replay-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const firstBtn = document.getElementById("first-btn");
const lastBtn = document.getElementById("last-btn");
const jumpStepEl = document.getElementById("jump-step");
const jumpBackBtn = document.getElementById("jump-back-btn");
const jumpForwardBtn = document.getElementById("jump-forward-btn");
const resumeBtn = document.getElementById("resume-btn");
const saveBtn = document.getElementById("save-btn");
const loadBtn = document.getElementById("load-btn");
const fileInput = document.getElementById("file-input");

function createPiece(code) {
  return { id: pieceIdCounter++, code };
}

function initBoard() {
  pieceIdCounter = 0;
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  const redBackCodes = ["rR", "rN", "rB", "rA", "rK", "rA", "rB", "rN", "rR"];
  const blackBackCodes = ["bR", "bN", "bB", "bA", "bK", "bA", "bB", "bN", "bR"];

  board[9] = redBackCodes.map(createPiece);
  board[0] = blackBackCodes.map(createPiece);
  board[7][1] = createPiece("rC");
  board[7][7] = createPiece("rC");
  board[2][1] = createPiece("bC");
  board[2][7] = createPiece("bC");

  for (let c = 0; c < COLS; c += 2) {
    board[6][c] = createPiece("rP");
    board[3][c] = createPiece("bP");
  }

  currentPlayer = "red";
  selected = null;
  legalMoves = [];
  gameOver = false;
  lastMove = null;
  isReplaying = false;
  replayIndex = -1;
  history = [];
  // 记录初始状态
  saveHistory();

  createStaticBoardUI();
  updateStatus();
  renderBoard();
  updateReplayButtons();
}

function saveHistory() {
  history.push({
    board: cloneBoard(board),
    currentPlayer,
    gameOver,
    lastMove: lastMove ? { ...lastMove } : null
  });
}

function createStaticBoardUI() {
  boardEl.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "board-grid";
  const lines = document.createElement("div");
  lines.className = "board-lines";
  const hLines = document.createElement("div");
  hLines.className = "board-lines-horizontal";
  const vLines = document.createElement("div");
  vLines.className = "board-lines-vertical";

  for (let r = 0; r < ROWS; r++) {
    const hl = document.createElement("div");
    hl.style.top = `${(r / (ROWS - 1)) * 100}%`;
    hLines.appendChild(hl);
  }
  for (let c = 0; c < COLS; c++) {
    if (c === 0 || c === COLS - 1) {
      const vl = document.createElement("div");
      vl.style.left = `${(c / (COLS - 1)) * 100}%`;
      vl.style.height = "100%";
      vLines.appendChild(vl);
    } else {
      // 内部竖线不穿过楚河
      const topVl = document.createElement("div");
      topVl.style.left = `${(c / (COLS - 1)) * 100}%`;
      topVl.style.top = "0";
      topVl.style.height = `${(4 / (ROWS - 1)) * 100}%`;
      vLines.appendChild(topVl);

      const bottomVl = document.createElement("div");
      bottomVl.style.left = `${(c / (COLS - 1)) * 100}%`;
      bottomVl.style.top = `${(5 / (ROWS - 1)) * 100}%`;
      bottomVl.style.height = `${(4 / (ROWS - 1)) * 100}%`;
      vLines.appendChild(bottomVl);
    }
  }
  lines.appendChild(hLines);
  lines.appendChild(vLines);
  grid.appendChild(lines);

  const river = document.createElement("div");
  river.className = "river-text";
  river.innerHTML = '<span>楚河</span><span class="black-side">汉界</span>';
  grid.appendChild(river);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "board-svg");
  svg.setAttribute("viewBox", "0 0 8 9"); // 8列间隔，9行间隔
  svg.setAttribute("preserveAspectRatio", "none");
  const addLine = (r1, c1, r2, c2) => {
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", `${c1}`);
    line.setAttribute("y1", `${r1}`);
    line.setAttribute("x2", `${c2}`);
    line.setAttribute("y2", `${r2}`);
    line.setAttribute("stroke", "#b58b4c");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(line);
  };
  // 九宫格：行[0-2, 7-9], 列[3-5]
  addLine(0, 3, 2, 5); addLine(0, 5, 2, 3);
  addLine(7, 3, 9, 5); addLine(7, 5, 9, 3);
  grid.appendChild(svg);
  boardEl.appendChild(grid);

  const cellsLayer = document.createElement("div");
  cellsLayer.id = "cells-layer";
  cellsLayer.className = "board-cells";
  boardEl.appendChild(cellsLayer);

  const pieceLayer = document.createElement("div");
  pieceLayer.id = "piece-layer";
  pieceLayer.className = "piece-layer";
  boardEl.appendChild(pieceLayer);
}

function renderBoard() {
  const cellsLayer = document.getElementById("cells-layer");
  const pieceLayer = document.getElementById("piece-layer");
  if (!cellsLayer || !pieceLayer) return;

  cellsLayer.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (selected && selected.r === r && selected.c === c) cell.classList.add("selected");
      const move = legalMoves.find(m => m.to.r === r && m.to.c === c);
      if (move) {
        cell.classList.add("highlight-move");
        const targetPiece = board[r][c];
        if (targetPiece && pieceOwner(targetPiece) !== pieceOwner(board[selected.r][selected.c])) {
          cell.classList.add("has-enemy");
        }
      }
      if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
        cell.classList.add("last-move");
      }
      // 精确对齐逻辑：使用与棋子相同的百分比定位
      cell.style.top = `${(r / (ROWS - 1)) * 100}%`;
      cell.style.left = `${(c / (COLS - 1)) * 100}%`;
      
      cell.addEventListener("click", () => onCellClick(r, c));
      cellsLayer.appendChild(cell);
    }
  }

  const currentPieceIds = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      currentPieceIds.add(`piece-${p.id}`);
      let pieceEl = document.getElementById(`piece-${p.id}`);
      if (!pieceEl) {
        pieceEl = document.createElement("div");
        pieceEl.id = `piece-${p.id}`;
        pieceEl.className = `piece ${p.code[0] === "r" ? "red" : "black"}`;
        pieceEl.textContent = pieceToChar(p.code[0] === "r" ? "red" : "black", p.code[1]);
        pieceLayer.appendChild(pieceEl);
      }
      pieceEl.style.top = `${(r / (ROWS - 1)) * 100}%`;
      pieceEl.style.left = `${(c / (COLS - 1)) * 100}%`;
    }
  }
  Array.from(pieceLayer.children).forEach(el => {
    if (!currentPieceIds.has(el.id)) pieceLayer.removeChild(el);
  });
}

function updateStatus(text) {
  if (text) { statusTextEl.textContent = text; return; }
  if (gameOver) return;
  statusTextEl.textContent = currentPlayer === "red" ? "轮到你走（红方）" : "机器人思考中（黑方）...";
}

function pieceToChar(side, type) {
  const map = side === "red" ? { R: "车", N: "马", B: "相", A: "仕", K: "帅", C: "炮", P: "兵" } : { R: "车", N: "马", B: "象", A: "士", K: "将", C: "炮", P: "卒" };
  return map[type];
}

function pieceOwner(p) {
  if (!p) return null;
  return p.code[0] === "r" ? "red" : "black";
}

function onCellClick(r, c) {
  if (gameOver || currentPlayer !== "red" || isReplaying) return;
  const p = board[r][c];
  if (selected) {
    if (p && pieceOwner(p) === "red") {
      selected = { r, c };
      legalMoves = generateLegalMovesForSquare(r, c, "red");
      renderBoard();
      return;
    }
    const move = legalMoves.find(m => m.to.r === r && m.to.c === c);
    if (move) {
      makeMove(move);
      renderBoard();
      checkGameOverAndMaybeAITurn();
    } else {
      selected = null; legalMoves = []; renderBoard();
    }
  } else if (p && pieceOwner(p) === "red") {
    selected = { r, c };
    legalMoves = generateLegalMovesForSquare(r, c, "red");
    renderBoard();
  }
}

function findKing(side, b = board) {
  const code = side === "red" ? "rK" : "bK";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (b[r][c] && b[r][c].code === code) return { r, c };
  return null;
}

function cloneBoard(b) { return b.map(row => row.slice()); }

function simulateMove(b, move) {
  const nb = cloneBoard(b);
  nb[move.to.r][move.to.c] = nb[move.from.r][move.from.c];
  nb[move.from.r][move.from.c] = null;
  return nb;
}

function generateAllLegalMoves(side, b = board) {
  const moves = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[r][c] && pieceOwner(b[r][c]) === side) {
        const ps = generatePseudoMovesForPiece(r, c, b);
        for (const mv of ps) if (!isKingInCheck(side, simulateMove(b, mv))) moves.push(mv);
      }
    }
  }
  return moves;
}

function generateLegalMovesForSquare(r, c, side) {
  const p = board[r][c];
  if (!p || pieceOwner(p) !== side) return [];
  return generatePseudoMovesForPiece(r, c, board).filter(mv => !isKingInCheck(side, simulateMove(board, mv)));
}

function isKingInCheck(side, b = board) {
  const enemy = side === "red" ? "black" : "red";
  const kingPos = findKing(side, b);
  if (!kingPos) return false;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[r][c] && pieceOwner(b[r][c]) === enemy) {
        if (generatePseudoMovesForPiece(r, c, b, true).some(m => m.to.r === kingPos.r && m.to.c === kingPos.c)) return true;
      }
    }
  }
  return false;
}

function generatePseudoMovesForPiece(r, c, b = board, forCheck = false) {
  const p = b[r][c]; if (!p) return [];
  const side = pieceOwner(p), type = p.code[1], moves = [];
  const addMove = (nr, nc) => {
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && (!b[nr][nc] || pieceOwner(b[nr][nc]) !== side))
      moves.push({ from: { r, c }, to: { r: nr, c: nc } });
  };

  if (type === "R") {
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr, dc]) => {
      for (let i=1; ; i++) {
        let nr = r + dr*i, nc = c + dc*i;
        if (nr<0 || nr>=ROWS || nc<0 || nc>=COLS) break;
        if (!b[nr][nc]) moves.push({ from: { r, c }, to: { r: nr, c: nc } });
        else { if (pieceOwner(b[nr][nc]) !== side) moves.push({ from: { r, c }, to: { r: nr, c: nc } }); break; }
      }
    });
  } else if (type === "C") {
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr, dc]) => {
      let jumped = false;
      for (let i=1; ; i++) {
        let nr = r + dr*i, nc = c + dc*i;
        if (nr<0 || nr>=ROWS || nc<0 || nc>=COLS) break;
        if (!jumped) { if (!b[nr][nc]) moves.push({ from: { r, c }, to: { r: nr, c: nc } }); else jumped = true; }
        else if (b[nr][nc]) { if (pieceOwner(b[nr][nc]) !== side) moves.push({ from: { r, c }, to: { r: nr, c: nc } }); break; }
      }
    });
  } else if (type === "N") {
    [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]].forEach(([dr, dc]) => {
      let nr = r + dr, nc = c + dc;
      if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && !b[r + (Math.abs(dr)===2 ? dr/2 : 0)][c + (Math.abs(dc)===2 ? dc/2 : 0)])
        if (!b[nr][nc] || pieceOwner(b[nr][nc]) !== side) moves.push({ from: { r, c }, to: { r: nr, c: nc } });
    });
  } else if (type === "B") {
    [[-2,-2],[-2,2],[2,-2],[2,2]].forEach(([dr, dc]) => {
      let nr = r + dr, nc = c + dc;
      if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && ((side==="red" && nr>=5)||(side==="black" && nr<=4)) && !b[r+dr/2][c+dc/2])
        if (!b[nr][nc] || pieceOwner(b[nr][nc]) !== side) moves.push({ from: { r, c }, to: { r: nr, c: nc } });
    });
  } else if (type === "A" || type === "K") {
    const dirs = type === "A" ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[1,0],[-1,0],[0,1],[0,-1]];
    const pCols = [3,4,5], pRows = side === "red" ? [7,8,9] : [0,1,2];
    dirs.forEach(([dr, dc]) => {
      let nr = r + dr, nc = c + dc;
      if (pCols.includes(nc) && pRows.includes(nr) && (!b[nr][nc] || pieceOwner(b[nr][nc]) !== side))
        moves.push({ from: { r, c }, to: { r: nr, c: nc } });
    });
    if (type === "K") {
      const ekPos = findKing(side === "red" ? "black" : "red", b);
      if (ekPos && ekPos.c === c) {
        let blocked = false;
        for (let nr = Math.min(r, ekPos.r)+1; nr < Math.max(r, ekPos.r); nr++) if (b[nr][c]) { blocked = true; break; }
        if (!blocked) moves.push({ from: { r, c }, to: { r: ekPos.r, c: ekPos.c } });
      }
    }
  } else if (type === "P") {
    if (side === "red") { addMove(r-1, c); if (r<=4) { addMove(r, c-1); addMove(r, c+1); } }
    else { addMove(r+1, c); if (r>=5) { addMove(r, c-1); addMove(r, c+1); } }
  }
  return forCheck ? moves : moves.filter(mv => !violatesFlyingKingRule(mv, b, side));
}

function violatesFlyingKingRule(move, b, side) {
  const nb = simulateMove(b, move);
  const rK = findKing("red", nb), bK = findKing("black", nb);
  if (!rK || !bK || rK.c !== bK.c) return false;
  for (let r = Math.min(rK.r, bK.r)+1; r < Math.max(rK.r, bK.r); r++) if (nb[r][rK.c]) return false;
  return true;
}

function makeMove(move) {
  board[move.to.r][move.to.c] = board[move.from.r][move.from.c];
  board[move.from.r][move.from.c] = null;
  lastMove = move; selected = null; legalMoves = [];
  currentPlayer = currentPlayer === "red" ? "black" : "red";
  saveHistory();
  updateStatus();
  updateReplayButtons();
}

function undoMove() {
  if (history.length <= 1 || gameOver || isReplaying) return;
  // 移除当前状态
  history.pop();
  // 撤销通常是撤销一个回合（自己和AI），所以pop两次
  if (currentPlayer === "red" && history.length >= 2) {
    history.pop();
  }
  const s = history[history.length - 1];
  board = cloneBoard(s.board);
  currentPlayer = s.currentPlayer;
  gameOver = s.gameOver;
  lastMove = s.lastMove;
  
  selected = null; legalMoves = [];
  updateStatus();
  renderBoard();
  updateReplayButtons();
}

function saveHistoryToFile() {
  if (history.length === 0) return;
  const data = JSON.stringify(history);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chess_replay_${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadHistoryFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const loadedHistory = JSON.parse(e.target.result);
      if (Array.isArray(loadedHistory) && loadedHistory.length > 0) {
        history = loadedHistory;
        // 进入回放模式查看加载的记录
        isReplaying = true;
        showHistoryAt(history.length - 1);
        updateReplayButtons();
        alert("对局记录加载成功，已进入回放模式。");
      }
    } catch (err) {
      alert("加载失败：文件格式不正确。");
    }
  };
  reader.readAsText(file);
  // 重置 input 以允许再次加载同一文件
  event.target.value = "";
}

function updateReplayButtons() {
  if (isReplaying) {
    replayBtn.textContent = "退出回放";
    firstBtn.disabled = replayIndex <= 0;
    prevBtn.disabled = replayIndex <= 0;
    nextBtn.disabled = replayIndex >= history.length - 1;
    lastBtn.disabled = replayIndex >= history.length - 1;
    jumpBackBtn.disabled = replayIndex <= 0;
    jumpForwardBtn.disabled = replayIndex >= history.length - 1;
    resumeBtn.style.display = "inline-block";
    undoBtn.disabled = true;
    saveBtn.disabled = false;
  } else {
    replayBtn.textContent = "回放";
    firstBtn.disabled = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    lastBtn.disabled = true;
    jumpBackBtn.disabled = true;
    jumpForwardBtn.disabled = true;
    resumeBtn.style.display = "none";
    undoBtn.disabled = history.length <= 1 || gameOver;
    saveBtn.disabled = history.length <= 1;
  }
}

function clampReplayIndex(i) {
  if (i < 0) return 0;
  if (i >= history.length) return history.length - 1;
  return i;
}

function getJumpStep() {
  const n = Number(jumpStepEl?.value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.floor(n));
}

function toggleReplay() {
  if (isReplaying) {
    // 退出回放，恢复到最后的状态
    isReplaying = false;
    const s = history[history.length - 1];
    board = cloneBoard(s.board);
    currentPlayer = s.currentPlayer;
    gameOver = s.gameOver;
    lastMove = s.lastMove;
  } else {
    // 进入回放
    isReplaying = true;
    // 优化：进入回放默认从开局开始
    replayIndex = 0;
    showHistoryAt(replayIndex);
  }
  selected = null;
  legalMoves = [];
  renderBoard();
  updateStatus();
  updateReplayButtons();
}

function showHistoryAt(index) {
  if (index < 0 || index >= history.length) return;
  replayIndex = index;
  const s = history[replayIndex];
  board = cloneBoard(s.board);
  currentPlayer = s.currentPlayer;
  gameOver = s.gameOver;
  lastMove = s.lastMove;
  
  selected = null;
  legalMoves = [];
  renderBoard();
  updateStatus();
  updateReplayButtons();
  
  if (isReplaying) {
    statusTextEl.textContent = `回放中 (${replayIndex + 1}/${history.length})`;
  }
}

function jumpToFirst() {
  if (!isReplaying) return;
  showHistoryAt(0);
}

function jumpToLast() {
  if (!isReplaying) return;
  showHistoryAt(history.length - 1);
}

function jumpBy(delta) {
  if (!isReplaying) return;
  const target = clampReplayIndex(replayIndex + delta);
  showHistoryAt(target);
}

function resumeFromHere() {
  if (!isReplaying) return;
  // 截断历史到当前回放点
  history.length = replayIndex + 1;
  isReplaying = false;
  // 当前 board, currentPlayer 等已经由 showHistoryAt 设置好了
  updateStatus();
  renderBoard();
  updateReplayButtons();
  
  // 如果当前是黑方走，触发AI
  if (currentPlayer === "black" && !gameOver) {
    setTimeout(aiMove, 300);
  }
}

function checkThreefoldRepetition() {
  if (history.length < 8) return false;
  const s = JSON.stringify(board.map(row => row.map(p => p ? p.code : null)));
  let count = 1;
  for (let i = history.length - 2; i >= 0; i -= 2) {
    if (JSON.stringify(history[i].board.map(row => row.map(p => p ? p.code : null))) === s) count++;
    if (count >= 3) return true;
  }
  return false;
}

function checkGameOverAndMaybeAITurn() {
  if (!findKing("red")) { gameOver = true; updateStatus("你输了，黑方胜。"); return; }
  if (!findKing("black")) { gameOver = true; updateStatus("你赢了，红方胜！"); return; }
  if (checkThreefoldRepetition()) { gameOver = true; updateStatus("局面重复三次，和棋（或禁止长将规则违规）。"); return; }
  if (currentPlayer === "black" && !gameOver) setTimeout(aiMove, 300);
}

const PIECE_VALUES = { K: 10000, R: 1000, C: 450, N: 400, B: 200, A: 200, P: 100 };
const PST = {
  P: [[0,0,0,0,0,0,0,0,0],[90,90,110,120,120,120,110,90,90],[90,90,110,120,120,120,110,90,90],[70,90,100,110,110,110,100,90,70],[70,70,70,70,70,70,70,70,70],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]],
  N: [[40,60,60,60,40,60,60,60,40],[60,80,100,100,80,100,100,80,60],[60,100,110,120,100,120,110,100,60],[60,100,110,120,100,120,110,100,60],[60,80,110,110,100,110,110,80,60],[60,80,110,110,100,110,110,80,60],[60,100,110,110,100,110,110,100,60],[40,60,80,80,80,80,80,60,40],[20,40,60,60,60,60,60,40,20],[0,20,40,40,40,40,40,20,0]],
  R: [[140,140,120,140,140,140,120,140,140],[140,160,160,160,160,160,160,160,140],[110,130,130,130,130,130,130,130,110],[140,160,160,160,160,160,160,160,140],[110,130,130,130,130,130,130,130,110],[110,130,130,130,130,130,130,130,110],[110,120,120,120,120,120,120,120,110],[100,110,110,110,110,110,110,110,100],[120,140,140,160,140,160,140,140,120],[100,120,120,120,120,120,120,120,100]]
};

function evaluate(b, side) {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c]; if (!p) continue;
      const owner = pieceOwner(p), type = p.code[1];
      let val = PIECE_VALUES[type] || 0;
      if (PST[type]) val += PST[type][owner === "red" ? r : ROWS - 1 - r][c];
      score += owner === side ? val : -val;
    }
  }
  return score;
}

function aiMove() {
  const side = "black", depth = difficultyEl.value === "low" ? 1 : (difficultyEl.value === "medium" ? 2 : 3);
  let moves = generateAllLegalMoves(side);
  if (moves.length === 0) { gameOver = true; updateStatus("黑方无子可走，你赢了！"); return; }
  moves.sort((a, bM) => {
    const tA = board[a.to.r][a.to.c], tB = board[bM.to.r][bM.to.c];
    if (tA && !tB) return -1; if (!tA && tB) return 1;
    return (tA && tB) ? PIECE_VALUES[tB.code[1]] - PIECE_VALUES[tA.code[1]] : 0;
  });
  let bestScore = -Infinity, bestMoves = [];
  for (const mv of moves) {
    const score = -negamax(simulateMove(board, mv), depth - 1, -Infinity, Infinity, "red");
    if (score > bestScore + 1e-6) { bestScore = score; bestMoves = [mv]; }
    else if (Math.abs(score - bestScore) <= 1e-6) bestMoves.push(mv);
  }
  makeMove(bestMoves[Math.floor(Math.random() * bestMoves.length)]);
  renderBoard();
  checkGameOverAndMaybeAITurn();
}

function negamax(b, depth, alpha, beta, side) {
  if (depth === 0) return evaluate(b, side);
  if (!findKing(side, b)) return -20000 - depth;
  if (!findKing(side === "red" ? "black" : "red", b)) return 20000 + depth;
  let moves = generateAllLegalMoves(side, b);
  if (moves.length === 0) return -10000 - depth;
  moves.sort((a, bM) => {
    const tA = b[a.to.r][a.to.c], tB = b[bM.to.r][bM.to.c];
    if (tA && !tB) return -1; if (!tA && tB) return 1;
    return (tA && tB) ? PIECE_VALUES[tB.code[1]] - PIECE_VALUES[tA.code[1]] : 0;
  });
  let best = -Infinity;
  for (const mv of moves) {
    const score = -negamax(simulateMove(b, mv), depth - 1, -beta, -alpha, side === "red" ? "black" : "red");
    if (score > best) best = score; if (best > alpha) alpha = best; if (alpha >= beta) break;
  }
  return best;
}

restartBtn.addEventListener("click", initBoard);
undoBtn.addEventListener("click", undoMove);
replayBtn.addEventListener("click", toggleReplay);
firstBtn.addEventListener("click", jumpToFirst);
prevBtn.addEventListener("click", () => showHistoryAt(replayIndex - 1));
nextBtn.addEventListener("click", () => showHistoryAt(replayIndex + 1));
lastBtn.addEventListener("click", jumpToLast);
jumpBackBtn.addEventListener("click", () => jumpBy(-getJumpStep()));
jumpForwardBtn.addEventListener("click", () => jumpBy(getJumpStep()));
resumeBtn.addEventListener("click", resumeFromHere);
saveBtn.addEventListener("click", saveHistoryToFile);
loadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", loadHistoryFromFile);

// 注册 PWA Service Worker（需要通过 http(s) 访问页面，file:// 不生效）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() => {
        // 忽略注册失败（例如 file:// 或旧浏览器）
      });
  });
}
initBoard();
