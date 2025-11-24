
// Game configuration constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 200;
const GROUND_Y = 175; // Slightly lower ground

// Cat (Player) parameters
const CAT_X = 50;
const CAT_WIDTH = 44;
const CAT_HEIGHT = 40;
const CAT_CROUCH_HEIGHT = 25;
const JUMP_FORCE = 11;
const GRAVITY = 0.6;

// Obstacle types
type ObstacleType = 'CACTUS' | 'TRASH_CAN' | 'BIRD';

// Game State
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let score = 0;
let highScore = Number(localStorage.getItem('dinoHighScore')) || 0;
let frame = 0;
let gameSpeed = 5;
let isGameOver = false;
let isPlaying = false;
let obstacles: Obstacle[] = [];
let requestID: number;

// Input State
const keys: { [key: string]: boolean } = {
    Space: false,
    ArrowUp: false,
    ArrowDown: false
};

class Cat {
    x: number;
    y: number;
    w: number;
    h: number;
    dy: number;
    isGrounded: boolean;
    isCrouching: boolean;

    constructor() {
        this.x = CAT_X;
        this.y = GROUND_Y - CAT_HEIGHT;
        this.w = CAT_WIDTH;
        this.h = CAT_HEIGHT;
        
        this.dy = 0;
        this.isGrounded = true;
        this.isCrouching = false;
    }

    update() {
        // Crouch logic
        if (keys['ArrowDown']) {
            this.isCrouching = true;
            this.h = CAT_CROUCH_HEIGHT;
            if (this.isGrounded) {
                this.y = GROUND_Y - CAT_CROUCH_HEIGHT;
            }
        } else {
            this.isCrouching = false;
            this.h = CAT_HEIGHT;
            if (this.isGrounded) {
                this.y = GROUND_Y - CAT_HEIGHT;
            }
        }

        // Jump logic
        if ((keys['Space'] || keys['ArrowUp']) && this.isGrounded) {
            this.dy = -JUMP_FORCE;
            this.isGrounded = false;
        }

        // Physics
        this.y += this.dy;

        if (this.y + this.h < GROUND_Y) {
            this.dy += GRAVITY;
            this.isGrounded = false;
        } else {
            this.dy = 0;
            this.isGrounded = true;
            this.y = GROUND_Y - this.h;
        }
    }

    draw() {
        if (!ctx) return;
        ctx.fillStyle = '#333'; // Black Cat

        const runAnim = Math.floor(frame / 6) % 2; // 0 or 1 for animation toggle

        // Draw Body
        ctx.fillRect(this.x, this.y, this.w, this.h);

        // Draw Ears
        if (!this.isCrouching) {
            ctx.beginPath();
            ctx.moveTo(this.x + 5, this.y);
            ctx.lineTo(this.x + 10, this.y - 8); // Left Ear
            ctx.lineTo(this.x + 15, this.y);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(this.x + this.w - 15, this.y);
            ctx.lineTo(this.x + this.w - 10, this.y - 8); // Right Ear
            ctx.lineTo(this.x + this.w - 5, this.y);
            ctx.fill();
        } else {
            // Flattened ears for crouch
            ctx.fillRect(this.x + 5, this.y - 3, 8, 3);
            ctx.fillRect(this.x + this.w - 13, this.y - 3, 8, 3);
        }

        // Draw Tail
        ctx.fillRect(this.x - 5, this.y + 10, 5, 5);
        ctx.fillRect(this.x - 8, this.y + 5, 5, 5);

        // Draw Eyes
        ctx.fillStyle = '#FFD700'; // Gold eyes
        if (!this.isCrouching) {
            ctx.fillRect(this.x + this.w - 12, this.y + 10, 3, 3);
            ctx.fillRect(this.x + this.w - 22, this.y + 10, 3, 3);
        } else {
             // Lower eyes for crouch
            ctx.fillRect(this.x + this.w - 12, this.y + 5, 3, 3);
            ctx.fillRect(this.x + this.w - 22, this.y + 5, 3, 3);
        }

        // Draw Legs (Animation)
        ctx.fillStyle = '#333';
        if (this.isGrounded) {
             if (runAnim === 0) {
                 // Legs together
                 ctx.fillRect(this.x + 5, this.y + this.h, 6, 4);
                 ctx.fillRect(this.x + this.w - 11, this.y + this.h, 6, 4);
             } else {
                 // Legs apart
                 ctx.fillRect(this.x, this.y + this.h, 6, 4);
                 ctx.fillRect(this.x + this.w - 6, this.y + this.h, 6, 4);
             }
        } else {
            // Jumping legs tucked
            ctx.fillRect(this.x + 10, this.y + this.h - 5, 5, 5);
            ctx.fillRect(this.x + this.w - 15, this.y + this.h - 5, 5, 5);
        }
    }
}

class Obstacle {
    x: number;
    y: number;
    w: number;
    h: number;
    type: ObstacleType;
    markedForDeletion: boolean;
    groupSize: number; // How many items in this cluster

    constructor(x: number, type: ObstacleType) {
        this.x = x;
        this.type = type;
        this.markedForDeletion = false;
        this.groupSize = 1;

        switch (type) {
            case 'CACTUS':
                // Random group size: 1, 2, or 3 cacti
                this.groupSize = Math.floor(Math.random() * 3) + 1;
                // Width grows with group size
                this.w = 20 * this.groupSize; 
                // Random height between 35 and 55
                this.h = 35 + Math.random() * 20;
                this.y = GROUND_Y - this.h;
                break;

            case 'TRASH_CAN':
                // Random group size: 1 or 2 cans
                this.groupSize = Math.floor(Math.random() * 2) + 1;
                this.w = 30 * this.groupSize;
                // Random height small variance
                this.h = 30 + Math.random() * 10;
                this.y = GROUND_Y - this.h;
                break;

            case 'BIRD':
                this.w = 40;
                this.h = 25;
                this.groupSize = 1;
                // Bird height: High enough to duck under, low enough to hit head if standing
                // Randomly choose between "Duckable" (Head level) and "Jumpable" (Ground level)
                // But user asked for ducking specifically, so primary is head level.
                // 175 (Ground) - 55 = 120 (Air).
                this.y = GROUND_Y - 50 - (Math.random() * 20); 
                break;
                
            default:
                this.w = 20;
                this.h = 20;
                this.y = GROUND_Y - 20;
        }
    }

    update() {
        // Birds move slightly faster
        const speedMultiplier = this.type === 'BIRD' ? 1.2 : 1.0;
        this.x -= gameSpeed * speedMultiplier;
        
        if (this.x + this.w < 0) {
            this.markedForDeletion = true;
        }
    }

    draw() {
        if (!ctx) return;
        
        if (this.type === 'BIRD') {
            this.drawBird();
        } else if (this.type === 'TRASH_CAN') {
            this.drawTrashCan();
        } else {
            this.drawCactus();
        }
    }

    drawCactus() {
        ctx.fillStyle = '#2E8B57'; // SeaGreen
        const singleW = this.w / this.groupSize;

        for (let i = 0; i < this.groupSize; i++) {
            const offsetX = this.x + (i * singleW);
            
            // Draw individual cactus in the group
            // Varies slightly in height visually if we wanted, but let's keep hitbox consistent for the group
            const currentH = this.h; 
            
            // Main stem
            ctx.fillRect(offsetX + singleW/3, this.y, singleW/3, currentH);
            // Left arm
            ctx.fillRect(offsetX, this.y + 10, singleW/3, 5);
            ctx.fillRect(offsetX, this.y + 5, 5, 10);
            // Right arm
            ctx.fillRect(offsetX + (singleW/3)*2, this.y + 15, singleW/3, 5);
            ctx.fillRect(offsetX + singleW - 5, this.y + 8, 5, 12);
        }
    }

    drawTrashCan() {
        ctx.fillStyle = '#778899'; // LightSlateGray
        const singleW = this.w / this.groupSize;

        for (let i = 0; i < this.groupSize; i++) {
            const offsetX = this.x + (i * singleW);
            
            // Gap between cans slightly
            const drawW = singleW - 2;

            // Can body
            ctx.fillRect(offsetX, this.y + 5, drawW, this.h - 5);
            // Lid
            ctx.fillStyle = '#666';
            ctx.fillRect(offsetX - 2, this.y, drawW + 4, 5);
            // Stripes
            ctx.fillStyle = '#555';
            ctx.fillRect(offsetX + 5, this.y + 10, drawW - 10, 2);
            ctx.fillRect(offsetX + 5, this.y + 18, drawW - 10, 2);
            // Reset color for next iteration
            ctx.fillStyle = '#778899';
        }
    }

    drawBird() {
        ctx.fillStyle = '#444';
        
        const flap = Math.floor(frame / 10) % 2; // Slow flap
        
        // Body
        ctx.fillRect(this.x, this.y + 10, this.w, 10);
        // Head
        ctx.fillRect(this.x, this.y + 5, 10, 10);
        // Beak
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(this.x - 5, this.y + 8, 5, 4);

        ctx.fillStyle = '#444';
        // Wings
        if (flap === 0) {
            // Wings Up
            ctx.beginPath();
            ctx.moveTo(this.x + 15, this.y + 10);
            ctx.lineTo(this.x + 25, this.y - 5);
            ctx.lineTo(this.x + 35, this.y + 10);
            ctx.fill();
        } else {
            // Wings Down
            ctx.beginPath();
            ctx.moveTo(this.x + 15, this.y + 15);
            ctx.lineTo(this.x + 25, this.y + 25);
            ctx.lineTo(this.x + 35, this.y + 15);
            ctx.fill();
        }
    }
}

let cat: Cat;

function spawnObstacle() {
    // Logic: 
    // - Always check minimum gap to ensure jumpability
    // - Randomly choose type
    
    // Gap depends on speed. Faster = larger gap needed.
    let minGap = 250 + Math.random() * 200 + gameSpeed * 15;
    let lastObs = obstacles[obstacles.length - 1];

    if (!lastObs || (GAME_WIDTH - lastObs.x > minGap)) {
        const rand = Math.random();
        let type: ObstacleType = 'CACTUS';

        // Bird Spawn Logic:
        // - Appears earlier now (gameSpeed > 5.5 is almost immediate after start)
        // - 30% chance if conditions met
        if (gameSpeed > 5.2 && rand > 0.7) {
            type = 'BIRD';
        } 
        // Trash can logic (20% chance)
        else if (rand > 0.5) {
            type = 'TRASH_CAN';
        } 
        // Default Cactus (50% chance)
        else {
            type = 'CACTUS';
        }

        obstacles.push(new Obstacle(GAME_WIDTH, type));
    }
}

function handleInput() {
    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space') keys['Space'] = true;
        if (e.code === 'ArrowUp') keys['ArrowUp'] = true;
        if (e.code === 'ArrowDown') keys['ArrowDown'] = true;

        if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
            e.preventDefault();
        }

        if ((!isPlaying || isGameOver) && (e.code === 'Space' || e.code === 'ArrowUp')) {
            if (isGameOver) {
                resetGame();
            } else if (!isPlaying) {
                isPlaying = true;
                requestID = requestAnimationFrame(gameLoop);
            }
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'Space') keys['Space'] = false;
        if (e.code === 'ArrowUp') keys['ArrowUp'] = false;
        if (e.code === 'ArrowDown') keys['ArrowDown'] = false;
    });
}

function checkCollision(cat: Cat, obstacle: Obstacle) {
    // Simple AABB Collision
    // Hitbox adjustments: Make hitboxes slightly smaller than visuals for fairness
    const catMargin = 5;
    const obsMargin = 4;

    return (
        cat.x + catMargin < obstacle.x + obstacle.w - obsMargin &&
        cat.x + cat.w - catMargin > obstacle.x + obsMargin &&
        cat.y + catMargin < obstacle.y + obstacle.h - obsMargin &&
        cat.y + cat.h - catMargin > obstacle.y + obsMargin
    );
}

function drawText(text: string, x: number, y: number, size = '20px', align: CanvasTextAlign = 'center', color = '#535353') {
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.font = `${size} "Courier New"`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}

function resetGame() {
    isGameOver = false;
    score = 0;
    gameSpeed = 5;
    obstacles = [];
    frame = 0;
    cat = new Cat();
    isPlaying = true;
    requestID = requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw Ground Line
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(GAME_WIDTH, GROUND_Y);
    ctx.strokeStyle = '#535353';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!isPlaying) {
        cat.draw();
        drawText("Press Space to Start", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
        return;
    }

    cat.update();
    spawnObstacle();

    obstacles.forEach(obs => {
        obs.update();
        obs.draw();
        if (checkCollision(cat, obs)) {
            isGameOver = true;
        }
    });

    obstacles = obstacles.filter(obs => !obs.markedForDeletion);

    frame++;
    if (frame % 5 === 0) {
        score++;
    }
    if (frame % 500 === 0) {
        gameSpeed += 0.5;
    }

    cat.draw();
    drawText(`HI ${String(highScore).padStart(5, '0')}  ${String(score).padStart(5, '0')}`, GAME_WIDTH - 20, 30, '20px', 'right');

    if (isGameOver) {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('dinoHighScore', String(highScore));
        }
        drawText("GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2);
        drawText("Press Space to Restart", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, '16px', 'center', '#888');
        cancelAnimationFrame(requestID);
    } else {
        requestID = requestAnimationFrame(gameLoop);
    }
}

function init() {
  canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (canvas) {
    ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    cat = new Cat();
    handleInput();
    
    // Initial draw
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Draw Ground Line
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(GAME_WIDTH, GROUND_Y);
    ctx.strokeStyle = '#535353';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    cat.draw();
    drawText("Press Space to Start", GAME_WIDTH / 2, GAME_HEIGHT / 2);
  } else {
      requestAnimationFrame(init);
  }
}

init();
