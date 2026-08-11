const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
context.scale(20, 20);

const previewCanvas = document.getElementById("preview");
const previewCtx = previewCanvas.getContext("2d");
previewCtx.scale(20, 20);

const arena = createMatrix(10, 20);
const player = { pos: { x: 0, y: 0 }, matrix: null };
let nextPiece = createPiece("T");
let isPaused = false;
let score = 0, level = 0;
let dropInterval = 1000;
const minDropInterval = 100;
let particles = []; //🔥 儲存特效粒子的陣列
let flashAlpha = 0; //🔥 新增：消除時的全螢幕閃爍值

//🔥 新增：觸發畫面震動
function triggerShake() {
  canvas.classList.remove("shake");
  void canvas.offsetWidth; // 觸發瀏覽器重繪，以便能重複播放動畫
  canvas.classList.add("shake");
}
const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const highscoreElement = document.getElementById("highscore");
const pauseBtn = document.getElementById("pauseBtn");
let highscore = parseInt(localStorage.getItem("tetrisHighScore") || "0");
highscoreElement.textContent = highscore;

const colors = {
  T: "#A0F", O: "#FF0", L: "#FA0", J: "#00F",
  I: "#0FF", S: "#0F0", Z: "#F00"
};

function createMatrix(w, h) {
  const matrix = [];
  while (h--) matrix.push(new Array(w).fill(0));
  return matrix;
}

function createPiece(type) {
  switch (type) {
    case "T": return [[0, "T", 0], ["T", "T", "T"], [0, 0, 0]];
    case "O": return [["O", "O"], ["O", "O"]];
    case "L": return [[0, 0, "L"], ["L", "L", "L"], [0, 0, 0]];
    case "J": return [["J", 0, 0], ["J", "J", "J"], [0, 0, 0]];
    case "I": return [[0, 0, 0, 0], ["I", "I", "I", "I"], [0, 0, 0, 0], [0, 0, 0, 0]];
    case "S": return [[0, "S", "S"], ["S", "S", 0], [0, 0, 0]];
    case "Z": return [["Z", "Z", 0], [0, "Z", "Z"], [0, 0, 0]];
  }
}

function updateScore() {
  scoreElement.textContent = score;
  levelElement.textContent = level;
  if (score > highscore) {
    highscore = score;
    highscoreElement.textContent = highscore;
    localStorage.setItem("tetrisHighScore", highscore);
  }
}

function drawMatrix(matrix, offset, ctx = context, isGhost = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = colors[value] || "#FFF";
        
        //🔥 新增特效：讓殘影有「呼吸燈」般的透明度閃爍效果
        if (isGhost) {
          const pulse = 0.15 + Math.abs(Math.sin(performance.now() / 250)) * 0.15;
          ctx.globalAlpha = pulse;
        }
        
        // 繪製基本底色
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
        
        // 加入 3D 立體邊框效果 (僅在非殘影時顯示)
        if (!isGhost) {
          // 頂部與左側高光
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.fillRect(x + offset.x, y + offset.y, 1, 0.12);
          ctx.fillRect(x + offset.x, y + offset.y, 0.12, 1);
          
          // 底部與右側陰影
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          ctx.fillRect(x + offset.x, y + offset.y + 0.88, 1, 0.12);
          ctx.fillRect(x + offset.x + 0.88, y + offset.y, 0.12, 1);
          
          // 黑色細邊框加強輪廓
          ctx.lineWidth = 0.05;
          ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
          ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
        }
        
        if (isGhost) ctx.globalAlpha = 1.0;
      }
    });
  });
}

function getGhostY(player) {
  const ghost = { pos: { x: player.pos.x, y: player.pos.y }, matrix: player.matrix };
  while (!collide(arena, ghost)) ghost.pos.y++;
  return ghost.pos.y - 1;
}

function drawPreview() {
  previewCtx.fillStyle = "#000";
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  const offset = {
    x: Math.floor((previewCanvas.width / 20 - nextPiece[0].length) / 2),
    y: Math.floor((previewCanvas.height / 20 - nextPiece.length) / 2)
  };
  drawMatrix(nextPiece, offset, previewCtx);
}

function draw() {
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawMatrix(arena, { x: 0, y: 0 });
  const ghostY = getGhostY(player);
  drawMatrix(player.matrix, { x: player.pos.x, y: ghostY }, context, true);
  drawMatrix(player.matrix, player.pos);

  //🔥 改良特效：加入重力與縮放的粒子系統
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    context.fillStyle = p.color;
    context.globalAlpha = Math.max(0, p.life);
    
    // 繪製縮放粒子
    context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    context.globalAlpha = 1.0;

    // 更新粒子位置與物理特性
    p.vy += 0.04; // 加上重力往下掉
    p.x += p.vx;
    p.y += p.vy;
    p.size *= 0.95; // 逐漸縮小
    p.life -= 0.03; // 消失速度
    
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  //🔥 新增特效：消除時的白光閃爍覆蓋
  if (flashAlpha > 0) {
    context.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    context.fillRect(0, 0, 10, 20); // 10,20 是方塊座標系的總寬高
    flashAlpha -= 0.05;
  }
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
    });
  });
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0) {
        const ay = y + o.y;
        const ax = x + o.x;
        if (ay < 0 || ay >= arena.length || ax < 0 || ax >= arena[0].length || arena[ay][ax] !== 0)
          return true;
      }
    }
  }
  return false;
}

function rotateMatrix(matrix) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  matrix.forEach(row => row.reverse());
}

function rotate() {
  if (isPaused) return;
  const original = JSON.parse(JSON.stringify(player.matrix));
  const pos = player.pos.x;
  rotateMatrix(player.matrix);
  let offset = 0;
  while (collide(arena, player)) {
    offset++;
    player.pos.x = pos + offset;
    if (!collide(arena, player)) return;
    player.pos.x = pos - offset;
    if (!collide(arena, player)) return;
    if (offset > player.matrix[0].length) {
      player.matrix = original;
      player.pos.x = pos;
      return;
    }
  }
}

function playerReset() {
  player.matrix = nextPiece;
  const pieces = "TJLOSZI";
  nextPiece = createPiece(pieces[Math.floor(Math.random() * pieces.length)]);
  drawPreview();
  player.pos.y = 0;
  player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
  if (collide(arena, player)) {
    alert("Game Over！");
    arena.forEach(row => row.fill(0));
    score = 0;
    level = 0;
    dropInterval = 1000;
    updateScore();
  }
}

function hardDrop() {
  if (isPaused) return;
  while (!collide(arena, player)) player.pos.y++;
  player.pos.y--;
  
  triggerShake(); //🔥 新增：落地瞬間產生打擊感的微震動
  
  merge(arena, player);
  arenaSweep();
  playerReset();
  dropCounter = 0;
}

function hardDrop() {
  if (isPaused) return;
  while (!collide(arena, player)) player.pos.y++;
  player.pos.y--;
  merge(arena, player);
  arenaSweep();
  playerReset();
  dropCounter = 0;
}

function move(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) player.pos.x -= dir;
}

function togglePause() {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "▶ 繼續" : "⏸ 暫停";
  document.getElementById("rotateBtn").disabled = isPaused;
  document.getElementById("dropBtn").disabled = isPaused;
  if (!isPaused) {
    lastTime = performance.now();
    update();
  }
}

let dropCounter = 0;
let lastTime = 0;
function update(time = 0) {
  if (isPaused) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) playerDrop();
  draw();
  requestAnimationFrame(update);
}

function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = arena.length - 1; y >= 0; y--) {
    for (let x = 0; x < arena[y].length; x++) {
      if (arena[y][x] === 0) continue outer;
    }

    //🔥 新增特效：在消除的該排產生粒子
    for (let x = 0; x < arena[y].length; x++) {
      const color = colors[arena[y][x]];
      for (let i = 0; i < 5; i++) { // 每個方格產生 5 個粒子
        particles.push({
          x: x + 0.5,
          y: y + 0.5,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          life: 1.0,
          color: color
        });
      }
    }

    arena.splice(y, 1);
    arena.unshift(new Array(arena[0].length).fill(0));
    y++;
    rowCount++;
  }

  if (rowCount > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[rowCount];
    const newLevel = Math.floor(score / 500);
    if (newLevel > level) {
      level = newLevel;
      dropInterval = Math.max(minDropInterval, 1000 - level * 100);
    }
    updateScore();
  }
}

document.addEventListener("keydown", (event) => {
  if (isPaused) return;
  if (event.key === "a") move(-1);
  else if (event.key === "d") move(1);
  else if (event.key === " " || event.key === "ArrowDown") hardDrop();
  else if (event.key === "w") rotate();
});

document.getElementById("rotateBtn").onclick = rotate;
document.getElementById("dropBtn").onclick = hardDrop;
document.getElementById("pauseBtn").onclick = togglePause;

nextPiece = createPiece("TJLOSZI"[Math.floor(Math.random() * 7)]);
drawPreview();
playerReset();
update();


let dragStartX = null;
let dragStartBlockX = null;

function getMatrixEdgeOffsets(matrix) {
  let left = matrix[0].length, right = 0;
  matrix.forEach(row => {
    row.forEach((val, x) => {
      if (val !== 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    });
  });
  return { left, right };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

document.body.addEventListener("mousedown", (e) => {
  if (isPaused) return;
  dragStartX = e.clientX;
  dragStartBlockX = player.pos.x;
});

document.body.addEventListener("mousemove", (e) => {
  if (isPaused || dragStartX === null || e.buttons === 0) return;
  const dx = e.clientX - dragStartX;
  const moved = Math.round(dx / 20);
  const { left, right } = getMatrixEdgeOffsets(player.matrix);
  const maxX = arena[0].length - (right - left + 1);
  player.pos.x = clamp(dragStartBlockX + moved, -left, maxX - left);
});

document.body.addEventListener("mouseup", () => {
  dragStartX = null;
  dragStartBlockX = null;
});

document.body.addEventListener("touchstart", (e) => {
  if (isPaused) return;
  dragStartX = e.touches[0].clientX;
  dragStartBlockX = player.pos.x;
});

document.body.addEventListener("touchmove", (e) => {
  if (isPaused || dragStartX === null) return;
  const dx = e.touches[0].clientX - dragStartX;
  const moved = Math.round(dx / 20);
  const { left, right } = getMatrixEdgeOffsets(player.matrix);
  const maxX = arena[0].length - (right - left + 1);
  player.pos.x = clamp(dragStartBlockX + moved, -left, maxX - left);
});

document.body.addEventListener("touchend", () => {
  dragStartX = null;
  dragStartBlockX = null;
});
