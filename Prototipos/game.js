// Starfight v2 - minimal & robust
(function(){
  const WIDTH = 480, HEIGHT = 720;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // HiDPI safe
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr; canvas.style.width = WIDTH + "px"; canvas.style.height = HEIGHT + "px";
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const ui = {
    score: document.getElementById('score'),
    lives: document.getElementById('lives'),
    level: document.getElementById('level'),
    overlay: document.getElementById('overlay'),
    startBtn: document.getElementById('startBtn'),
  };

  const input = { left:false, right:false, fire:false, paused:false };
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowLeft' || e.key.toLowerCase()==='a') input.left = true;
    if (e.key === 'ArrowRight' || e.key.toLowerCase()==='d') input.right = true;
    if (e.key === ' ') input.fire = true;
    if (e.key.toLowerCase()==='p') input.paused = !input.paused;
    if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e)=>{
    if (e.key === 'ArrowLeft' || e.key.toLowerCase()==='a') input.left = false;
    if (e.key === 'ArrowRight' || e.key.toLowerCase()==='d') input.right = false;
    if (e.key === ' ') input.fire = false;
  });

  class Player {
    constructor(){ this.w=36; this.h=24; this.x=WIDTH/2-this.w/2; this.y=HEIGHT-70; this.cool=0; this.speed=260; this.inv=0; }
    update(dt){
      const move = (input.right?1:0) - (input.left?1:0);
      this.x += move * this.speed * dt;
      if (this.x < 8) this.x = 8;
      if (this.x + this.w > WIDTH-8) this.x = WIDTH-8 - this.w;
      this.cool -= dt; this.inv = Math.max(0, this.inv - dt);
      if (input.fire && this.cool <= 0){
        bullets.push(new Bullet(this.x + this.w/2 - 2, this.y - 10, -460, true));
        this.cool = 0.18;
      }
    }
    draw(){
      ctx.fillStyle = "#48c8ff";
      ctx.beginPath();
      ctx.moveTo(this.x, this.y+this.h);
      ctx.lineTo(this.x+this.w/2, this.y);
      ctx.lineTo(this.x+this.w, this.y+this.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  class Bullet {
    constructor(x,y,vy,good){ this.x=x; this.y=y; this.vy=vy; this.good=good; this.w=4; this.h=10; this.dead=false; }
    update(dt){ this.y += this.vy*dt; if (this.y<-12 || this.y>HEIGHT+12) this.dead=true; }
    draw(){ ctx.fillStyle = this.good ? "#9effa2" : "#ff7b7b"; ctx.fillRect(this.x, this.y, this.w, this.h); }
  }

  class Enemy {
    constructor(x,y,speed,pattern){ this.x=x; this.y=y; this.w=30; this.h=22; this.baseX=x; this.speed=speed; this.pattern=pattern; this.dead=false; this.cool=Math.random()*1.4+1.2; this.t=0; }
    update(dt){
      this.t += dt;
      if (this.pattern===1){ this.x = this.baseX + Math.sin(this.t*2.2) * 60; this.y += this.speed*dt; }
      else { this.y += this.speed*dt; }
      this.cool -= dt;
      if (this.cool<=0){ bullets.push(new Bullet(this.x+this.w/2-2, this.y+this.h, 280, false)); this.cool=Math.random()*1.4+1.4; }
      if (this.y>HEIGHT+30) this.dead=true;
    }
    draw(){
      ctx.fillStyle="#ff6b6b";
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle="#ffe4e4";
      ctx.fillRect(this.x+6, this.y+6, 6, 6);
      ctx.fillRect(this.x+this.w-12, this.y+6, 6, 6);
    }
  }

  function coll(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  // Background stars
  const stars = Array.from({length:120}, () => ({x:Math.random()*WIDTH, y:Math.random()*HEIGHT, s:Math.random()*1.3+0.5}));
  function drawBackground(dt){
    ctx.fillStyle="#0a0f1f"; ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle="#b6d6ff";
    for (const st of stars){
      st.y += 24*st.s*dt;
      if (st.y > HEIGHT){ st.y = -2; st.x = Math.random()*WIDTH; }
      ctx.fillRect(st.x, st.y, 2, 2);
    }
  }

  let player = null, bullets=[], enemies=[], score=0, lives=3, level=1, gameOver=true;

  function reset(){
    player = new Player();
    bullets = []; enemies = []; score=0; lives=3; level=1; gameOver=false;
    ui.score.textContent=score; ui.lives.textContent=lives; ui.level.textContent=level;
  }

  function spawn(dt){
    spawn.t -= dt;
    if (spawn.t<=0){
      const c = 1 + Math.floor(level/3);
      for (let i=0;i<c;i++){
        const x = Math.random()*(WIDTH-50)+20, y = -(Math.random()*100+20);
        const speed = (Math.random()*40+50) + level*6;
        const pat = Math.random()<0.55 ? 1 : 0;
        enemies.push(new Enemy(x,y,speed,pat));
      }
      spawn.t = Math.max(0.5, 1.6 - level*0.07);
    }
  }
  spawn.t = 0;

  function update(dt){
    if (player) player.update(dt);
    spawn(dt);
    bullets.forEach(b=>b.update(dt));
    enemies.forEach(e=>e.update(dt));
    // collisions
    for (const b of bullets){
      if (!b.good) continue;
      for (const e of enemies){
        if (!e.dead && coll(b,e)){
          e.dead = true; b.dead = true; score += 10;
          ui.score.textContent = score;
          if (score >= 20*level){ level++; ui.level.textContent=level; if (lives<5) { lives++; ui.lives.textContent=lives; } }
          break;
        }
      }
    }
    if (player){
      for (const e of enemies){ if (!e.dead && coll(player,e)){ e.dead=true; lives--; ui.lives.textContent=lives; if (lives<=0) { gameOver=true; ui.overlay.classList.remove('hidden'); } }}
      for (const b of bullets){ if (!b.good && coll(player,b)){ b.dead=true; lives--; ui.lives.textContent=lives; if (lives<=0) { gameOver=true; ui.overlay.classList.remove('hidden'); } }}
    }
    bullets = bullets.filter(b=>!b.dead);
    enemies = enemies.filter(e=>!e.dead);
  }

  function draw(){
    if (player) player.draw();
    bullets.forEach(b=>b.draw());
    enemies.forEach(e=>e.draw());

    if (input.paused && !gameOver){
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle = '#e6f1ff';
      ctx.textAlign='center'; ctx.font='bold 26px system-ui';
      ctx.fillText('⏸ Pausa', WIDTH/2, HEIGHT/2);
    }
  }

  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.033, (now-last)/1000); last = now;
    drawBackground(dt);
    if (!gameOver && !input.paused){ update(dt); }
    draw();
    requestAnimationFrame(loop);
  }

  ui.startBtn.addEventListener('click', () => {
    ui.overlay.classList.add('hidden');
    reset();
  });

  requestAnimationFrame(loop);
})();
