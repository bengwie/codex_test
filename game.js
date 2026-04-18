const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const difficultySelect = document.getElementById("difficulty");
const restartButton = document.getElementById("restartButton");
const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const survivalTimeEl = document.getElementById("survivalTime");
const stageEl = document.getElementById("stage");
const overlay = document.getElementById("overlay");

const GAME_CONFIG = {
  easy: {
    asteroidCap: 6,
    spawnRate: 0.9,
    speedMin: 70,
    speedMax: 120,
    fireRate: 0.18,
    asteroidHealthMin: 1,
    asteroidHealthMax: 2,
    stageTarget: 14,
    bossHealth: 22,
  },
  medium: {
    asteroidCap: 10,
    spawnRate: 1.5,
    speedMin: 110,
    speedMax: 170,
    fireRate: 0.15,
    asteroidHealthMin: 1,
    asteroidHealthMax: 3,
    stageTarget: 18,
    bossHealth: 32,
  },
  hard: {
    asteroidCap: 15,
    spawnRate: 2.25,
    speedMin: 150,
    speedMax: 240,
    fireRate: 0.12,
    asteroidHealthMin: 2,
    asteroidHealthMax: 4,
    stageTarget: 24,
    bossHealth: 42,
  },
};

const state = {
  running: false,
  gameOver: false,
  difficulty: difficultySelect.value,
  score: 0,
  health: 100,
  elapsed: 0,
  stage: 1,
  stageKills: 0,
  stageGoal: 0,
  announcement: "",
  announcementTimer: 0,
  fireCooldown: 0,
  spawnAccumulator: 0,
  shootHeld: false,
  pointer: { x: canvas.width / 2, y: canvas.height / 2 },
  player: {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 24,
    angle: 0,
  },
  bullets: [],
  asteroids: [],
  particles: [],
  enemyBullets: [],
  boss: null,
};

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function resetGame() {
  state.difficulty = difficultySelect.value;
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.health = 100;
  state.elapsed = 0;
  state.stage = 1;
  state.stageKills = 0;
  state.fireCooldown = 0;
  state.spawnAccumulator = 0;
  state.announcement = "";
  state.announcementTimer = 0;
  state.bullets = [];
  state.asteroids = [];
  state.particles = [];
  state.enemyBullets = [];
  state.boss = null;
  state.stageGoal = getStageGoal();
  announce(`Stage ${state.stage} incoming`);
  updateHud();
  setOverlay(false);
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  setOverlay(
    true,
    "Core Destroyed",
    `Final score: ${state.score}. You reached stage ${state.stage} and survived ${state.elapsed.toFixed(1)} seconds on ${capitalize(state.difficulty)}.`,
    "Press Space or Start / Restart to jump back in."
  );
}

function setOverlay(visible, title, body, note) {
  overlay.classList.toggle("visible", visible);

  if (!visible) {
    overlay.innerHTML = "";
    return;
  }

  overlay.innerHTML = `
    <div class="overlay-card">
      <h2>${title}</h2>
      <p>${body}</p>
      <p class="overlay-note">${note}</p>
    </div>
  `;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  healthEl.textContent = String(Math.max(0, Math.round(state.health)));
  survivalTimeEl.textContent = `${state.elapsed.toFixed(1)}s`;
  stageEl.textContent = String(state.stage);
}

function getStageGoal() {
  const config = GAME_CONFIG[state.difficulty];
  return config.stageTarget + (state.stage - 1) * 5;
}

function getStageScale() {
  return 1 + (state.stage - 1) * 0.16;
}

function announce(message) {
  state.announcement = message;
  state.announcementTimer = 2.6;
}

function spawnAsteroid() {
  const config = GAME_CONFIG[state.difficulty];
  const stageScale = getStageScale();
  const currentCap = Math.round(config.asteroidCap + (state.stage - 1) * 1.25);

  if (state.asteroids.length >= currentCap || state.boss) {
    return;
  }

  const angle = Math.random() * Math.PI * 2;
  const spawnRadius = Math.max(canvas.width, canvas.height) * 0.68;
  const size = randomBetween(16, 34 + state.stage * 1.2);
  const startX = state.player.x + Math.cos(angle) * spawnRadius;
  const startY = state.player.y + Math.sin(angle) * spawnRadius;
  const toCenterX = state.player.x - startX;
  const toCenterY = state.player.y - startY;
  const distance = Math.hypot(toCenterX, toCenterY) || 1;
  const speed = randomBetween(config.speedMin, config.speedMax) * stageScale;

  state.asteroids.push({
    x: startX,
    y: startY,
    radius: size,
    vx: (toCenterX / distance) * speed,
    vy: (toCenterY / distance) * speed,
    rotation: Math.random() * Math.PI * 2,
    spin: randomBetween(-1.8, 1.8),
    health: randomInt(config.asteroidHealthMin, config.asteroidHealthMax) + Math.floor((state.stage - 1) / 2),
  });
}

function shootBullet() {
  const angle = state.player.angle;
  const speed = 480;
  const tipOffset = state.player.radius + 12;

  state.bullets.push({
    x: state.player.x + Math.cos(angle) * tipOffset,
    y: state.player.y + Math.sin(angle) * tipOffset,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    life: 1.3,
  });
}

function fireEnemyBullet(x, y, speed, angleOffset = 0) {
  const angle = Math.atan2(state.player.y - y, state.player.x - x) + angleOffset;
  state.enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 6,
    life: 3.2,
  });
}

function spawnBoss() {
  const config = GAME_CONFIG[state.difficulty];
  const stageScale = getStageScale();
  const bossHealth = Math.round((config.bossHealth + (state.stage - 1) * 12) * stageScale);

  state.boss = {
    x: canvas.width * 0.5,
    y: 116,
    width: 146,
    height: 62,
    vx: 170 + (state.stage - 1) * 18,
    health: bossHealth,
    maxHealth: bossHealth,
    fireCooldown: 1.1,
    entryTimer: 1.2,
    phase: 0,
  };

  announce(`Boss incoming: stage ${state.stage}`);
}

function advanceStage() {
  state.stage += 1;
  state.stageKills = 0;
  state.stageGoal = getStageGoal();
  state.spawnAccumulator = 0;
  state.enemyBullets = [];
  state.health = Math.min(100, state.health + 16);
  announce(`Stage ${state.stage} online`);
}

function burstParticles(x, y, color, count, spread) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(spread * 0.3, spread);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.2, 0.7),
      size: randomBetween(2, 5),
      color,
    });
  }
}

function update(delta) {
  if (!state.running) {
    return;
  }

  const config = GAME_CONFIG[state.difficulty];
  state.elapsed += delta;
  state.fireCooldown = Math.max(0, state.fireCooldown - delta);
  state.announcementTimer = Math.max(0, state.announcementTimer - delta);
  state.player.angle = Math.atan2(state.pointer.y - state.player.y, state.pointer.x - state.player.x);

  if (state.shootHeld && state.fireCooldown === 0) {
    shootBullet();
    state.fireCooldown = config.fireRate;
  }

  const stageScale = getStageScale();

  if (!state.boss && state.stageKills < state.stageGoal) {
    state.spawnAccumulator += delta * config.spawnRate * stageScale;
    while (state.spawnAccumulator >= 1) {
      spawnAsteroid();
      state.spawnAccumulator -= 1;
    }
  }

  if (!state.boss && state.stageKills >= state.stageGoal && state.asteroids.length === 0) {
    spawnBoss();
  }

  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.life -= delta;

    return (
      bullet.life > 0 &&
      bullet.x > -40 &&
      bullet.x < canvas.width + 40 &&
      bullet.y > -40 &&
      bullet.y < canvas.height + 40
    );
  });

  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.life -= delta;

    const dx = bullet.x - state.player.x;
    const dy = bullet.y - state.player.y;
    if (Math.hypot(dx, dy) <= bullet.radius + state.player.radius) {
      state.health -= 9;
      burstParticles(bullet.x, bullet.y, "#ff8a70", 10, 90);
      return false;
    }

    return (
      bullet.life > 0 &&
      bullet.x > -60 &&
      bullet.x < canvas.width + 60 &&
      bullet.y > -60 &&
      bullet.y < canvas.height + 60
    );
  });

  state.asteroids = state.asteroids.filter((asteroid) => {
    asteroid.x += asteroid.vx * delta;
    asteroid.y += asteroid.vy * delta;
    asteroid.rotation += asteroid.spin * delta;

    const dx = asteroid.x - state.player.x;
    const dy = asteroid.y - state.player.y;
    const distToCore = Math.hypot(dx, dy);

    if (distToCore <= asteroid.radius + state.player.radius) {
      state.health -= asteroid.radius * 0.95;
      burstParticles(asteroid.x, asteroid.y, "#ff6b6b", 16, 110);
      return false;
    }

    return true;
  });

  for (const asteroid of state.asteroids) {
    for (const bullet of state.bullets) {
      const dx = asteroid.x - bullet.x;
      const dy = asteroid.y - bullet.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= asteroid.radius + bullet.radius) {
        asteroid.health -= 1;
        bullet.life = 0;
        burstParticles(bullet.x, bullet.y, "#67d5ff", 6, 80);

        if (asteroid.health <= 0) {
          asteroid.destroyed = true;
          state.score += 10;
          state.stageKills += 1;
          burstParticles(asteroid.x, asteroid.y, "#ffd166", 18, 140);
        }
      }
    }
  }

  if (state.boss) {
    const boss = state.boss;
    boss.phase += delta;

    if (boss.entryTimer > 0) {
      boss.entryTimer -= delta;
      boss.y += (130 - boss.y) * 0.06;
    } else {
      boss.x += boss.vx * delta;
      if (boss.x < 120 || boss.x > canvas.width - 120) {
        boss.vx *= -1;
      }

      boss.y = 116 + Math.sin(boss.phase * 1.8) * 28;
      boss.fireCooldown -= delta;
      if (boss.fireCooldown <= 0) {
        fireEnemyBullet(boss.x, boss.y + 24, 180 + state.stage * 10, 0);
        fireEnemyBullet(boss.x - 24, boss.y + 24, 170 + state.stage * 10, -0.22);
        fireEnemyBullet(boss.x + 24, boss.y + 24, 170 + state.stage * 10, 0.22);
        boss.fireCooldown = Math.max(0.45, 1.2 - state.stage * 0.06);
      }
    }

    for (const bullet of state.bullets) {
      const hitX = Math.abs(bullet.x - boss.x) <= boss.width * 0.5;
      const hitY = Math.abs(bullet.y - boss.y) <= boss.height * 0.5;
      if (hitX && hitY && bullet.life > 0) {
        boss.health -= 1;
        bullet.life = 0;
        burstParticles(bullet.x, bullet.y, "#67d5ff", 8, 90);
      }
    }

    const dx = Math.abs(state.player.x - boss.x);
    const dy = Math.abs(state.player.y - boss.y);
    if (dx <= boss.width * 0.5 + state.player.radius && dy <= boss.height * 0.5 + state.player.radius) {
      state.health -= 28 * delta;
    }

    if (boss.health <= 0) {
      state.score += 150;
      burstParticles(boss.x, boss.y, "#ffd166", 40, 220);
      state.boss = null;
      advanceStage();
    }
  }

  state.asteroids = state.asteroids.filter((asteroid) => !asteroid.destroyed);

  state.particles = state.particles.filter((particle) => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    return particle.life > 0;
  });

  if (state.health <= 0) {
    state.health = 0;
    updateHud();
    endGame();
    return;
  }

  updateHud();
}

function drawBackgroundGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(125, 171, 230, 0.08)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlayer() {
  const { x, y, radius, angle } = state.player;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(103, 213, 255, 0.12)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#0d2a46";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#8be9ff";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-8, -12);
  ctx.lineTo(radius + 18, 0);
  ctx.lineTo(-8, 12);
  ctx.closePath();
  ctx.fillStyle = "#edf4ff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#67d5ff";
  ctx.fill();

  ctx.restore();
}

function drawAsteroid(asteroid) {
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.rotation);
  ctx.beginPath();

  const points = 9;
  for (let i = 0; i < points; i += 1) {
    const angle = (Math.PI * 2 * i) / points;
    const modifier = i % 2 === 0 ? 1 : 0.76;
    const radius = asteroid.radius * modifier;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fillStyle = asteroid.health > 2 ? "#b98d68" : "#8c745f";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#f5d8b4";
  ctx.stroke();
  ctx.restore();
}

function drawBullet(bullet) {
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#8be9ff";
  ctx.fill();
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, particle.life * 1.8));
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fillStyle = particle.color;
  ctx.fill();
  ctx.restore();
}

function drawEnemyBullet(bullet) {
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#ff8a70";
  ctx.fill();
}

function drawBoss() {
  if (!state.boss) {
    return;
  }

  const boss = state.boss;
  ctx.save();
  ctx.translate(boss.x, boss.y);

  ctx.fillStyle = "rgba(255, 117, 117, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 0, boss.width * 0.62, boss.height * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7c8ff4";
  ctx.beginPath();
  ctx.ellipse(0, 0, boss.width * 0.5, boss.height * 0.35, 0, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#dce4ff";
  ctx.beginPath();
  ctx.moveTo(-boss.width * 0.46, 0);
  ctx.quadraticCurveTo(0, boss.height * 0.75, boss.width * 0.46, 0);
  ctx.quadraticCurveTo(0, -boss.height * 0.2, -boss.width * 0.46, 0);
  ctx.fill();

  ctx.fillStyle = "#67d5ff";
  ctx.beginPath();
  ctx.ellipse(0, -4, boss.width * 0.15, boss.height * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f7f9ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-boss.width * 0.52, 2);
  ctx.lineTo(boss.width * 0.52, 2);
  ctx.stroke();
  ctx.restore();

  const barWidth = 240;
  const barHeight = 12;
  const barX = canvas.width * 0.5 - barWidth * 0.5;
  const barY = 28;
  const ratio = Math.max(0, boss.health / boss.maxHealth);

  ctx.fillStyle = "rgba(4, 12, 26, 0.8)";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = "#edf4ff";
  ctx.font = "700 14px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(`Alien Boss - Stage ${state.stage}`, canvas.width * 0.5, 20);
}

function drawCombatHud() {
  const panelX = 18;
  const panelY = 18;
  const panelWidth = 230;
  const barWidth = 150;
  const healthRatio = Math.max(0, state.health / 100);

  ctx.save();
  ctx.fillStyle = "rgba(5, 14, 30, 0.72)";
  ctx.strokeStyle = "rgba(151, 191, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, 82, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#9eb6d3";
  ctx.font = "700 12px Trebuchet MS";
  ctx.textAlign = "left";
  ctx.fillText("CORE STATUS", panelX + 16, panelY + 22);

  ctx.fillStyle = "#edf4ff";
  ctx.font = "700 18px Trebuchet MS";
  ctx.fillText(`${Math.round(state.health)} HP`, panelX + 16, panelY + 46);

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(panelX + 16, panelY + 56, barWidth, 12);
  ctx.fillStyle = healthRatio > 0.35 ? "#67d5ff" : "#ff6b6b";
  ctx.fillRect(panelX + 16, panelY + 56, barWidth * healthRatio, 12);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.strokeRect(panelX + 16, panelY + 56, barWidth, 12);

  ctx.fillStyle = "#d9e7ff";
  ctx.font = "700 13px Trebuchet MS";
  ctx.fillText(`Stage ${state.stage}`, panelX + 182, panelY + 46);
  ctx.font = "700 12px Trebuchet MS";
  ctx.fillStyle = "#9eb6d3";
  const targetText = state.boss
    ? "Boss fight"
    : `${Math.max(0, state.stageGoal - state.stageKills)} asteroids to boss`;
  ctx.fillText(targetText, panelX + 16, panelY + 78);
  ctx.restore();
}

function drawAnnouncement() {
  if (state.announcementTimer <= 0) {
    return;
  }

  const alpha = Math.min(1, state.announcementTimer / 0.4, state.announcementTimer / 2.2);
  ctx.save();
  ctx.globalAlpha = Math.max(0.15, alpha);
  ctx.fillStyle = "rgba(3, 10, 22, 0.62)";
  ctx.beginPath();
  ctx.roundRect(canvas.width * 0.5 - 160, canvas.height - 86, 320, 42, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(103, 213, 255, 0.3)";
  ctx.stroke();
  ctx.fillStyle = "#edf4ff";
  ctx.font = "700 18px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(state.announcement, canvas.width * 0.5, canvas.height - 58);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createRadialGradient(
    state.player.x,
    state.player.y,
    40,
    state.player.x,
    state.player.y,
    canvas.width * 0.55
  );
  gradient.addColorStop(0, "rgba(24, 82, 146, 0.28)");
  gradient.addColorStop(1, "rgba(2, 7, 16, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBackgroundGrid();

  for (const particle of state.particles) {
    drawParticle(particle);
  }

  for (const bullet of state.bullets) {
    drawBullet(bullet);
  }

  for (const bullet of state.enemyBullets) {
    drawEnemyBullet(bullet);
  }

  for (const asteroid of state.asteroids) {
    drawAsteroid(asteroid);
  }

  drawBoss();
  drawPlayer();
  drawCombatHud();
  drawAnnouncement();

  if (!state.running) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.font = "700 18px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("Select a difficulty and press Start / Restart", canvas.width / 2, canvas.height - 28);
    ctx.restore();
  }
}

let lastFrame = performance.now();

function loop(now) {
  const delta = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  state.pointer.x = (event.clientX - rect.left) * scaleX;
  state.pointer.y = (event.clientY - rect.top) * scaleY;
});

canvas.addEventListener("mousedown", () => {
  state.shootHeld = true;
});

window.addEventListener("mouseup", () => {
  state.shootHeld = false;
});

restartButton.addEventListener("click", resetGame);
difficultySelect.addEventListener("change", () => {
  state.difficulty = difficultySelect.value;
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !state.running) {
    event.preventDefault();
    resetGame();
  }
});

setOverlay(
  true,
  "Defend the Core",
  "Rip through the starfield, stop the asteroid wave, and survive the alien boss at the end of every stage.",
  "Easy has fewer, slower asteroids. Hard floods the arena and sends nastier bosses sooner."
);

updateHud();
requestAnimationFrame(loop);
