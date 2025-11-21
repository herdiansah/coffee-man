const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Assets ---
const assets = {
    player: new Image(),
    ground: new Image(),
    background: new Image(),
    monster: new Image(),
    bean: new Image(),
    milk: new Image()
};
assets.player.src = 'assets/player.png';
assets.ground.src = 'assets/ground.png';
assets.background.src = 'assets/background.png';
assets.monster.src = 'assets/monster.png';
assets.bean.src = 'assets/bean.png';
assets.milk.src = 'assets/milk.png';

let assetsLoaded = 0;
const totalAssets = 6;
const preloader = document.getElementById('preloader');
const loadingProgress = document.getElementById('loading-progress');

function onAssetLoad() {
    assetsLoaded++;
    let percent = Math.floor((assetsLoaded / totalAssets) * 100);
    loadingProgress.innerText = percent + "%";

    if (assetsLoaded === totalAssets) {
        setTimeout(() => {
            preloader.style.display = 'none';
            startScreen.style.display = 'flex';
        }, 500); // Small delay for effect
    }
}
Object.values(assets).forEach(img => img.onload = onAssetLoad);

// --- Game Constants ---
const GRAVITY = 0.8;
const FRICTION = 0.8;
const PLAYER_SPEED = 1; // Acceleration
const MAX_SPEED = 8;
const TILE_SIZE = 64;

// --- Game State ---
let gameState = 'waiting'; // waiting, running, gameover
let score = 0;
let lives = 3;
let camera = { x: 0, y: 0 };
let levelWidth = 0;
let maxJumpPower = 0;

// --- Input Handling ---
const keys = {
    right: false,
    left: false,
    up: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;

    if (e.code === 'Enter') {
        if (gameState === 'waiting' && assetsLoaded === totalAssets) {
            startGame();
        } else if (gameState === 'gameover') {
            gameOverScreen.style.display = 'none';
            startGame();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
});

// --- UI Handling ---
const jumpPowerDisplay = document.getElementById('jump-power-display');
const scoreBoard = document.getElementById('score-board');
const livesDisplay = document.getElementById('lives-display');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

let currentJumpPower = 10;

startBtn.addEventListener('click', () => {
    if (assetsLoaded === totalAssets) {
        startGame();
    } else {
        alert("Assets loading... (" + assetsLoaded + "/" + totalAssets + ")");
    }
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    startGame();
});

// --- Classes ---
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50; // Adjust based on sprite
        this.height = 50;
        this.velX = 0;
        this.velY = 0;
        this.grounded = false;
        this.facingRight = true;
        this.jumpPressed = false; // Track key state to prevent holding jump
    }

    update() {
        // Movement
        if (keys.right) {
            if (this.velX < MAX_SPEED) this.velX += PLAYER_SPEED;
            this.facingRight = true;
        }
        if (keys.left) {
            if (this.velX > -MAX_SPEED) this.velX -= PLAYER_SPEED;
            this.facingRight = false;
        }

        // Friction
        this.velX *= FRICTION;

        // Jump Logic (Multi-Jump)
        if (keys.up) {
            if (!this.jumpPressed) {
                // Jump!
                this.velY = -currentJumpPower;
                this.grounded = false;
                this.jumpPressed = true;

                // Increase power for next jump
                currentJumpPower += 10;

                // Cap at max jump power
                if (currentJumpPower > maxJumpPower) {
                    currentJumpPower = maxJumpPower;
                }

                jumpPowerDisplay.innerText = "Jump Power: " + Math.floor(currentJumpPower);
            }
        } else {
            this.jumpPressed = false;
        }

        // Gravity
        this.velY += GRAVITY;

        // Apply Velocity
        this.x += this.velX;
        this.y += this.velY;

        // Ground Collision (Basic)
        this.grounded = false;

        // Check collisions with platforms
        for (let platform of level.platforms) {
            let dir = this.colCheck(this, platform);
            if (dir === "b") {
                this.grounded = true;
                this.velY = 0;

                // Reset Jump Power on landing
                if (currentJumpPower !== 10) {
                    currentJumpPower = 10;
                    jumpPowerDisplay.innerText = "Jump Power: " + currentJumpPower;
                }
            } else if (dir === "t") {
                this.velY *= -1;
            }
        }

        // Check collisions with monsters
        for (let monster of level.monsters) {
            if (this.colCheck(this, monster)) {
                handleDeath();
            }
        }

        // Check collisions with beans
        for (let i = level.beans.length - 1; i >= 0; i--) {
            if (this.colCheck(this, level.beans[i])) {
                level.beans.splice(i, 1);
                score += 10;
                scoreBoard.innerText = "Score: " + score;
            }
        }

        // Check collisions with milk
        for (let i = level.milks.length - 1; i >= 0; i--) {
            if (this.colCheck(this, level.milks[i])) {
                level.milks.splice(i, 1);
                score += 50;
                scoreBoard.innerText = "Score: " + score;
            }
        }

        // Check Goal
        if (this.colCheck(this, level.goal)) {
            alert("You Win! Final Score: " + score);
            resetGameFull();
        }

        // Level Bounds
        if (this.y > canvas.height + 200) {
            handleDeath();
        }
        // Ceiling collision (prevent going above screen)
        if (this.y < 0) {
            this.y = 0;
            this.velY = 0;
        }
    }

    draw() {
        ctx.save();
        if (!this.facingRight) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(assets.player, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else {
            ctx.drawImage(assets.player, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }

    // Simple AABB Collision
    colCheck(shapeA, shapeB) {
        // get the vectors to check against
        let vX = (shapeA.x + (shapeA.width / 2)) - (shapeB.x + (shapeB.width / 2)),
            vY = (shapeA.y + (shapeA.height / 2)) - (shapeB.y + (shapeB.height / 2)),
            // add the half widths and half heights of the objects
            hWidths = (shapeA.width / 2) + (shapeB.width / 2),
            hHeights = (shapeA.height / 2) + (shapeB.height / 2),
            colDir = null;

        // if the x and y vector are less than the half width or half height, they we must be inside the object, causing a collision
        if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
            // figures out on which side we are colliding (top, bottom, left, or right)
            let oX = hWidths - Math.abs(vX),
                oY = hHeights - Math.abs(vY);

            if (oX >= oY) {
                if (vY > 0) {
                    colDir = "t";
                    shapeA.y += oY;
                } else {
                    colDir = "b";
                    shapeA.y -= oY;
                }
            } else {
                if (vX > 0) {
                    colDir = "l";
                    shapeA.x += oX;
                } else {
                    colDir = "r";
                    shapeA.x -= oX;
                }
            }
        }
        return colDir;
    }
}

class Monster {
    constructor(x, y, range) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.startX = x;
        this.range = range;
        // Random speed between 1.5 and 3
        this.speed = 1.5 + Math.random() * 1.5;
        // Random direction (1 or -1)
        this.dir = Math.random() > 0.5 ? 1 : -1;
        // Random initial offset within range to desync (strictly inside bounds)
        this.x = this.startX + Math.random() * this.range;
    }

    update() {
        this.x += this.speed * this.dir;
        if (this.x > this.startX + this.range || this.x < this.startX) {
            this.dir *= -1;
        }
    }

    draw() {
        ctx.save();
        if (this.dir === -1) { // Moving Left, flip
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(assets.monster, -this.width / 2, -this.height / 2, this.width, this.height);
        } else { // Moving Right, normal
            ctx.drawImage(assets.monster, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

class Bean {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.floatY = 0;
        this.floatDir = 1;
    }

    update() {
        // Floating animation
        this.floatY += 0.5 * this.floatDir;
        if (Math.abs(this.floatY) > 5) this.floatDir *= -1;
    }

    draw() {
        ctx.drawImage(assets.bean, this.x, this.y + this.floatY, this.width, this.height);
    }
}

class Milk {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 35;
        this.height = 35;
        this.floatY = 0;
        this.floatDir = 1;
    }

    update() {
        // Floating animation
        this.floatY += 0.5 * this.floatDir;
        if (Math.abs(this.floatY) > 5) this.floatDir *= -1;
    }

    draw() {
        ctx.drawImage(assets.milk, this.x, this.y + this.floatY, this.width, this.height);
    }
}

// --- Level Generation ---
let level = {
    platforms: [],
    monsters: [],
    beans: [],
    milks: [],
    goal: { x: 0, y: 0, width: 50, height: 100 }
};

function generateLevel() {
    level.platforms = [];
    level.monsters = [];
    level.beans = [];
    level.milks = [];

    // Ground floor
    for (let i = 0; i < 100; i++) {
        if (i % 5 !== 0) { // Gaps
            level.platforms.push({ x: i * TILE_SIZE, y: canvas.height - TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE });
        }
    }

    // Platforms
    let currentX = 500;
    while (currentX < 100 * TILE_SIZE - 500) {
        // Random gap between "clusters" of platforms
        let gap = Math.floor(Math.random() * 200) + 150;
        currentX += gap;

        // Randomly decide how many platforms to stack in this cluster (1 to 4)
        let stackCount = Math.floor(Math.random() * 4) + 1;

        // Base Y offset for the cluster
        let baseYOffset = (Math.random() * 100) - 50;

        for (let j = 0; j < stackCount; j++) {
            // Vertical gap ~140px
            let y = canvas.height - TILE_SIZE - (j * 140) - 80 + baseYOffset;

            // Skip if off screen
            if (y < 50) break;

            // Independent width for each platform (2 to 5 tiles)
            let width = TILE_SIZE * (Math.floor(Math.random() * 4) + 2);

            // Large horizontal scatter: +/- 150px from the cluster center
            // This ensures they are NOT vertically aligned
            let xScatter = (Math.random() * 300) - 150;
            let pX = currentX + xScatter;

            level.platforms.push({ x: pX, y: y, width: width, height: 20 });

            // Add monster on some platforms
            if (Math.random() > 0.6) {
                let patrolRange = width - 40;
                level.monsters.push(new Monster(pX, y - 40, patrolRange));
            }

            // Add items (Milk OR Beans, not both)
            if (Math.random() > 0.8) { // 20% chance for Milk
                let milkX = pX + Math.random() * (width - 35);
                level.milks.push(new Milk(milkX, y - 50));
            } else if (Math.random() > 0.3) { // Beans
                let beanCount = Math.floor(Math.random() * 5) + 1;
                let spacing = 40;
                let maxBeans = Math.floor((width - 20) / spacing);
                if (beanCount > maxBeans) beanCount = maxBeans;

                let startX = pX + Math.random() * (width - (beanCount * spacing));

                for (let b = 0; b < beanCount; b++) {
                    level.beans.push(new Bean(startX + (b * spacing), y - 50));
                }
            }
        }
        // Advance X significantly to separate clusters
        currentX += 300;
    }

    // Goal
    level.goal.x = 100 * TILE_SIZE - 100;
    level.goal.y = canvas.height - TILE_SIZE - 100;

    levelWidth = 100 * TILE_SIZE;
}

// --- Main Game Loop ---
let player;

function startGame() {
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    resizeCanvas();
    generateLevel();
    player = new Player(100, canvas.height - 200);
    gameState = 'running';
    score = 0;
    lives = 3;
    currentJumpPower = 10;
    jumpPowerDisplay.innerText = "Jump Power: " + currentJumpPower;
    scoreBoard.innerText = "Score: " + score;
    livesDisplay.innerText = "Lives: " + lives;
    gameLoop();
}

function handleDeath() {
    lives--;
    livesDisplay.innerText = "Lives: " + lives;
    if (lives > 0) {
        // Respawn
        player.x = 100;
        player.y = canvas.height - 200;
        player.velX = 0;
        player.velY = 0;
    } else {
        // Game Over
        gameState = 'gameover';
        finalScoreDisplay.innerText = "Score: " + score;
        gameOverScreen.style.display = 'flex';
    }
}

function resetGameFull() {
    gameState = 'waiting';
    startScreen.style.display = 'flex';
}

function gameLoop() {
    if (gameState !== 'running') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update
    player.update();
    level.monsters.forEach(m => m.update());
    level.beans.forEach(b => b.update());
    level.milks.forEach(m => m.update());

    // Camera Logic
    // Keep player in center horizontally
    camera.x = player.x - canvas.width / 2;
    // Clamp camera
    if (camera.x < 0) camera.x = 0;
    if (camera.x > levelWidth - canvas.width) camera.x = levelWidth - canvas.width;

    // Vertical camera (optional, maybe just follow if player goes too high)
    camera.y = 0; // Fixed y for now

    // Draw Background (Parallax)
    // Draw multiple times to cover screen
    let bgWidth = assets.background.width;
    if (bgWidth > 0) {
        let parallaxFactor = 0.5;
        // Calculate the offset based on camera position
        // % operator in JS returns negative for negative operands, so this stays in (-bgWidth, 0]
        let xPos = -(camera.x * parallaxFactor) % bgWidth;

        // Start drawing from the calculated offset
        let currentX = xPos;

        // Ensure we fill the screen from left to right
        // Since xPos is <= 0, we start at or off the left edge.
        // We loop until we've covered the entire canvas width.
        while (currentX < canvas.width) {
            ctx.drawImage(assets.background, currentX, 0, bgWidth, canvas.height);
            currentX += bgWidth;
        }
    }

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw Platforms
    ctx.fillStyle = '#333'; // Fallback
    for (let p of level.platforms) {
        ctx.drawImage(assets.ground, p.x, p.y, p.width, p.height);
    }

    // Draw Goal
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(level.goal.x, level.goal.y, level.goal.width, level.goal.height);

    // Draw Monsters
    level.monsters.forEach(m => m.draw());

    // Draw Beans
    level.beans.forEach(b => b.draw());

    // Draw Milk
    level.milks.forEach(m => m.draw());

    // Draw Player
    player.draw();

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// Resize
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Calculate max jump power to reach top of screen
    // v^2 = 2 * g * h  =>  v = sqrt(2 * g * h)
    // We use 0.9 * height to keep it slightly within bounds
    maxJumpPower = Math.sqrt(2 * GRAVITY * (canvas.height * 0.9));
}
window.addEventListener('resize', resizeCanvas);
