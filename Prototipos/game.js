// Starfight - simple canvas shooter
(() => {
  const WIDTH = 480, HEIGHT = 720;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Retina scaling
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr; ctx.scale(dpr, dpr);

  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');

  // Mobile buttons
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnFire = document.getElementById('btnFire');

  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const keys = new Set();
  const input = { left:false, right:false, fire:false, paused:false };

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft' || e.key.toLowerCase()==='a') input.left = true;
    if (e.key === 'ArrowRight' || e.key.toLowerCase()==='d') input.right = true;
    if (e.key === ' ') input.fire = true;
    if (e.key.toLowerCase() === 'p') input.paused = !input.paused;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase()==='a') input.left = false;
    if (e.key === 'ArrowRight' || e.key.toLowerCase()==='d') input.right = false;
    if (e.key === ' ') input.fire = false;
  });

  // Mobile buttons -> emulate key holds
  const holdBtn = (btn, prop) => {
    const on = () => input[prop] = true;
    const off = () => input[prop] = false;
    ['mousedown','touchstart'].forEach(ev=>btn.addEventListener(ev, e=>{e.preventDefault(); on();}));
    ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev=>btn.addEventListener(ev, e=>{e.preventDefault(); off();}));
  };
  holdBtn(btnLeft,'left');
  holdBtn(btnRight,'right');
  holdBtn(btnFire,'fire');

  // Sound (very tiny WebAudio beeps)
  const audio = new (window.AudioContext || window.webkitAudioContext)();
  const beep = (freq=440, dur=0.08, type='square', gain=0.02) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  };

  // Entities
  class Entity {
    constructor(x,y,w,h){ this.x=x; this.y=y; this.w=w; this.h=h; this.vx=0; this.vy=0; this.dead=false; }
    get rect(){ return {x:this.x, y:this.y, w:this.w, h:this.h}; }
    update(dt){ this.x += this.vx*dt; this.y += this.vy*dt; }
    draw(){ /* override */ }
  }

  class Player extends Entity {
    constructor(){ super(WIDTH/2-18, HEIGHT-70, 36, 24); this.cooldown=0; this.speed=260; this.inv=0; }
    update(dt){
      this.vx = (input.right - input.left) * this.speed;
      super.update(dt);
      this.x = clamp(this.x, 8, WIDTH - this.w - 8);
      this.cooldown -= dt;
      this.inv = Math.max(0, this.inv - dt);
      if (input.fire && this.cooldown <= 0){
        bullets.push(new Bullet(this.x + this.w/2 - 2, this.y - 10, -460, true));
        this.cooldown = 0.18;
        beep(740, .05, 'square', .015);
      }
    }
    draw(){
      const g = ctx.createLinearGradient(this.x, this.y, this.x, this.y+this.h);
      g.addColorStop(0, '#7ef3ff');
      g.addColorStop(1, '#38b2ff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y+this.h);
      ctx.lineTo(this.x+this.w/2, this.y);
      ctx.lineTo(this.x+this.w, this.y+this.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e7f9ff';
      ctx.fillRect(this.x+this.w/2-4, this.y+7, 8, 6);
      if (this.inv>0){
        ctx.globalAlpha = 0.5 + Math.sin(Date.now()/60)*0.3;
        ctx.strokeStyle = '#6fff92';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x-2, this.y-2, this.w+4, this.h+4);
        ctx.globalAlpha = 1;
      }
    }
  }

  class Bullet extends Entity {
    constructor(x, y, vy, friendly=true){ super(x, y, 4, 10); this.vy = vy; this.friendly=friendly; }
    update(dt){ super.update(dt); if (this.y < -12 || this.y > HEIGHT+12) this.dead=true; }
    draw(){
      ctx.fillStyle = this.friendly ? '#9effa2' : '#ff7b7b';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }

  class Enemy extends Entity {
    constructor(x, y, speed, pattern=0){
      super(x, y, 30, 22);
      this.baseX = x;
      this.speed = speed;
      this.pattern = pattern; // 0 straight, 1 sine
      this.hp = 1;
      this.shootCD = Math.random()*1.4 + 1.2;
      this.t = 0;
    }
    update(dt){
      this.t += dt;
      if (this.pattern === 1){
        this.x = this.baseX + Math.sin(this.t*2.2) * 60;
        this.y += this.speed*dt;
      } else {
        this.y += this.speed*dt;
      }
      this.shootCD -= dt;
      if (this.shootCD <= 0){
        bullets.push(new Bullet(this.x + this.w/2 - 2, this.y+this.h, 280, false));
        this.shootCD = Math.random()*1.4 + 1.4;
      }
      if (this.y > HEIGHT + 30) this.dead = true;
    }
    draw(){
      const g = ctx.createLinearGradient(this.x, this.y, this.x, this.y+this.h);
      g.addColorStop(0, '#ffb19b');
      g.addColorStop(1, '#ff6b6b');
      ctx.fillStyle = g;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = '#ffe4e4';
      ctx.fillRect(this.x+6, this.y+6, 6, 6);
      ctx.fillRect(this.x+this.w-12, this.y+6, 6, 6);
    }
  }

  class Particle extends Entity {
    constructor(x, y){
      super(x, y, 2, 2);
      const ang = Math.random()*Math.PI*2;
      const sp = Math.random()*180 + 60;
      this.vx = Math.cos(ang)*sp; this.vy = Math.sin(ang)*sp;
      this.life = Math.random()*.3 + .3;
    }
    update(dt){ this.life -= dt; if (this.life<=0) this.dead=true; this.x += this.vx*dt; this.y += this.vy*dt; }
    draw(){ ctx.fillStyle = '#ffd36b'; ctx.fillRect(this.x, this.y, this.w, this.h); }
  }

  // Game state
  let player, bullets=[], enemies=[], particles=[];
  let spawnCD=0, score=0, lives=3, level=1, gameOver=true;
  const reset = () => {
    player = new Player();
    bullets = []; enemies = []; particles = [];
    spawnCD = 0; score = 0; lives = 3; level = 1; gameOver = false;
    scoreEl.textContent = score; livesEl.textContent = lives; levelEl.textContent = level;
  };

  const hit = (a,b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // Background starfield
  const stars = Array.from({length: 120}, () => ({ x: Math.random()*WIDTH, y: Math.random()*HEIGHT, s: Math.random()*1.3 + 0.5 }));
  function drawStars(dt){
    ctx.save();
    ctx.fillStyle = '#0a0f1f';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = '#b6d6ff';
    stars.forEach(st => {
      st.y += 24*st.s*dt;
      if (st.y > HEIGHT) { st.y = -2; st.x = Math.random()*WIDTH; st.s = Math.random()*1.3 + 0.5; }
      ctx.fillRect(st.x, st.y, 2, 2);
    });
    ctx.restore();
  }

  function spawnEnemies(dt){
    spawnCD -= dt;
    if (spawnCD <= 0){
      const count = 1 + Math.floor(level/3);
      for (let i=0;i<count;i++){
        const x = Math.random()*(WIDTH-50) + 20, y = - (Math.random()*100 + 20);
        const speed = (Math.random()*40 + 50) + level*6;
        const pattern = Math.random()<0.55 ? 1 : 0;
        enemies.push(new Enemy(x, y, speed, pattern));
      }
      spawnCD = Math.max(0.5, 1.6 - level*0.07);
    }
  }

  function tryLevelUp(){
    const target = 20*level;
    if (score >= target){
      level++;
      levelEl.textContent = level;
      if (level % 3 === 0 && lives < 5){ lives++; livesEl.textContent = lives; }
      beep(880, .12, 'triangle', .02);
      for (let i=0;i<40;i++) particles.push(new Particle(player.x+player.w/2, player.y));
    }
  }

  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.033, (now - last)/1000); last = now;
    if (!gameOver && !input.paused){
      update(dt); draw(dt);
    } else {
      draw(dt);
    }
    requestAnimationFrame(loop);
  }

  function update(dt){
    drawStars(dt);
    player.update(dt);
    spawnEnemies(dt);

    bullets.forEach(b => b.update(dt));
    enemies.forEach(e => e.update(dt));
    particles.forEach(p => p.update(dt));

    for (const b of bullets){
      if (!b.friendly) continue;
      for (const e of enemies){
        if (!e.dead && hit(b, e)){
          e.hp--; b.dead = true;
          score += 10; scoreEl.textContent = score;
          beep(520, .07, 'sawtooth', .02);
          for (let i=0;i<18;i++) particles.push(new Particle(b.x, b.y));
          if (e.hp<=0){ e.dead=true; for (let i=0;i<24;i++) particles.push(new Particle(e.x+e.w/2, e.y+e.h/2)); }
          break;
        }
      }
    }
    if (player.inv <= 0){
      for (const e of enemies){
        if (!e.dead && hit(player, e)){
          e.dead = true; damagePlayer();
          break;
        }
      }
      for (const b of bullets){
        if (!b.friendly && hit(player, b)){
          b.dead = true; damagePlayer();
          break;
        }
      }
    }

    bullets = bullets.filter(b=>!b.dead);
    enemies = enemies.filter(e=>!e.dead);
    particles = particles.filter(p=>!p.dead);

    tryLevelUp();
  }

  function damagePlayer(){
    lives--; livesEl.textContent = lives;
    player.inv = 1.2;
    beep(220, .16, 'square', .03);
    for (let i=0;i<45;i++) particles.push(new Particle(player.x+player.w/2, player.y+player.h/2));
    if (lives <= 0){
      gameOver = true;
      showGameOver();
    }
  }

  function draw(){
    player.draw();
    bullets.forEach(b => b.draw());
    enemies.forEach(e => e.draw());
    particles.forEach(p => p.draw());

    if (input.paused && !gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle = '#e6f1ff';
      ctx.font = 'bold 26px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⏸ Pausa', WIDTH/2, HEIGHT/2);
      ctx.font = '16px ui-sans-serif, system-ui';
      ctx.fillText('Presiona P para continuar', WIDTH/2, HEIGHT/2 + 26);
    }
  }

  function showGameOver(){
    overlay.classList.remove('hidden');
    overlay.querySelector('.card').innerHTML = `
      <h1>Game Over</h1>
      <p class="subtitle">Puntuación: <b>${score}</b> · Nivel: <b>${level}</b></p>
      <button class="btn" id="restartBtn">Reintentar</button>
    `;
    document.getElementById('restartBtn').addEventListener('click', () => {
      overlay.classList.add('hidden');
      reset();
    });
  }

  startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    audio.resume().catch(()=>{});
    reset();
  });

  // Kickoff
  (function drawInit(){
    ctx.fillStyle = '#0a0f1f';
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = '#e6f1ff';
    ctx.textAlign='center';
    ctx.font = 'bold 24px ui-sans-serif, system-ui';
    ctx.fillText('Starfight', WIDTH/2, HEIGHT/2 - 10);
    ctx.font = '16px ui-sans-serif, system-ui';
    ctx.fillText('Pulsa "Jugar" para iniciar', WIDTH/2, HEIGHT/2 + 18);
  })();
  requestAnimationFrame(loop);
})();
