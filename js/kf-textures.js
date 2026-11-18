// ============================================================
// kf-textures.js — small procedural effect textures (canvas 2D).
// Characters / backgrounds are generated art in assets/; these are only
// projectiles, sparks and touch-control graphics.
// ============================================================
function makeCanvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  const c = t.getContext();
  try { draw(c, w, h); } catch (e) { console.warn('[tex]', key, e && e.message); }
  t.refresh();
}
function generateFxTextures(scene) {
  generateMkTextures(scene);
  makeCanvasTex(scene, 'pixel', 2, 2, c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 2, 2); });
  makeCanvasTex(scene, 'spark', 48, 48, c => {
    const g = c.createRadialGradient(24, 24, 2, 24, 24, 24);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,240,120,0.95)'); g.addColorStop(1, 'rgba(255,120,0,0)');
    c.fillStyle = g; c.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 9 : 24; c.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); }
    c.closePath(); c.fill();
  });
  makeCanvasTex(scene, 'ring', 64, 64, c => {
    c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2; c.globalAlpha = 0.6; c.beginPath(); c.arc(32, 32, 18, 0, Math.PI * 2); c.stroke();
  });
  makeCanvasTex(scene, 'bullet', 40, 16, c => {
    const g = c.createLinearGradient(0, 0, 40, 0); g.addColorStop(0, 'rgba(255,200,60,0)'); g.addColorStop(0.6, '#ffd84a'); g.addColorStop(1, '#fff');
    c.fillStyle = g; c.fillRect(0, 5, 32, 6); c.fillStyle = '#fff6c0'; c.beginPath(); c.ellipse(33, 8, 7, 4, 0, 0, Math.PI * 2); c.fill();
  });
  makeCanvasTex(scene, 'grenade', 28, 30, c => {
    c.fillStyle = '#3c5a2a'; c.beginPath(); c.ellipse(14, 17, 11, 12, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#26381a'; c.lineWidth = 2; for (let y = 10; y < 28; y += 5) { c.beginPath(); c.moveTo(4, y); c.lineTo(24, y); c.stroke(); }
    c.fillStyle = '#999'; c.fillRect(10, 1, 8, 6); c.strokeStyle = '#ccc'; c.beginPath(); c.arc(21, 5, 4, 0, Math.PI * 2); c.stroke();
  });
  makeCanvasTex(scene, 'floppy', 40, 40, c => {
    c.fillStyle = '#20242c'; c.fillRect(2, 2, 36, 36); c.fillStyle = '#c8ccd4'; c.fillRect(10, 2, 18, 12); c.fillStyle = '#20242c'; c.fillRect(21, 4, 4, 8);
    c.fillStyle = '#f2f2f2'; c.fillRect(7, 20, 26, 16); c.fillStyle = '#3a6ad8'; c.font = 'bold 8px sans-serif'; c.fillText('3.5"', 12, 31);
  });
  makeCanvasTex(scene, 'ball', 24, 24, c => {
    const g = c.createRadialGradient(9, 9, 1, 12, 12, 12); g.addColorStop(0, '#666'); g.addColorStop(1, '#0a0a0a');
    c.fillStyle = g; c.beginPath(); c.arc(12, 12, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(8, 8, 2, 0, Math.PI * 2); c.arc(14, 8, 2, 0, Math.PI * 2); c.fill();
  });
  makeCanvasTex(scene, 'football', 40, 40, c => {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(20, 20, 18, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#111';
    const pent = (x, y, r) => { c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); };
    pent(20, 20, 6); pent(8, 12, 4); pent(32, 12, 4); pent(12, 32, 4); pent(29, 31, 4);
  });
  const dog = (c, body, ear, tail) => {
    c.fillStyle = body; c.beginPath(); c.ellipse(34, 26, 24, 12, 0, 0, Math.PI * 2); c.fill();           // body
    c.beginPath(); c.ellipse(60, 16, 11, 10, 0, 0, Math.PI * 2); c.fill();                            // head
    c.fillStyle = ear; c.beginPath(); c.moveTo(55, 9); c.lineTo(57, -1 + 3); c.lineTo(62, 8); c.fill(); c.beginPath(); c.moveTo(62, 8); c.lineTo(67, 1); c.lineTo(68, 11); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(66, 20, 6, 4, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(36, 32, 14, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(71, 18, 2, 0, Math.PI * 2); c.arc(62, 14, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = body; [16, 26, 42, 52].forEach(x => c.fillRect(x, 32, 6, 10));
    c.strokeStyle = tail; c.lineWidth = 5; c.beginPath(); c.moveTo(11, 22); c.lineTo(3, 12); c.stroke();
  };
  makeCanvasTex(scene, 'dog', 80, 46, c => dog(c, '#f4f0e6', '#d8d0c0', '#f4f0e6'));      // 總一郎 (white)
  makeCanvasTex(scene, 'corgi', 80, 46, c => dog(c, '#e89a3a', '#c8741e', '#e89a3a'));    // Corgi
  makeCanvasTex(scene, 'heart', 48, 44, c => {
    c.fillStyle = '#ff5aa8'; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath();
    c.moveTo(24, 40); c.bezierCurveTo(-6, 18, 8, -4, 24, 12); c.bezierCurveTo(40, -4, 54, 18, 24, 40); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(15, 14, 5, 3, -0.6, 0, Math.PI * 2); c.fill();
  });
  makeCanvasTex(scene, 'arrow', 70, 20, c => {
    c.strokeStyle = '#e8d0ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(2, 10); c.lineTo(58, 10); c.stroke();
    c.fillStyle = '#d0a0ff'; c.beginPath(); c.moveTo(70, 10); c.lineTo(54, 2); c.lineTo(56, 10); c.lineTo(54, 18); c.closePath(); c.fill();
    c.fillStyle = '#ffe14a'; c.font = 'bold 16px sans-serif'; c.fillText('♪', 6, 8);
    c.shadowColor = '#b070ff'; c.shadowBlur = 8; c.stroke();
  });
  makeCanvasTex(scene, 'beam', 140, 120, c => {
    for (let i = 0; i < 9; i++) {
      const y = 10 + i * 12 + (i % 2) * 4, x = (i * 37) % 60;
      const g = c.createLinearGradient(x, 0, x + 80, 0); g.addColorStop(0, 'rgba(255,220,80,0)'); g.addColorStop(1, '#fff8c0');
      c.fillStyle = g; c.fillRect(x, y, 80, 4);
    }
    c.fillStyle = 'rgba(255,240,160,0.9)'; c.beginPath(); c.arc(124, 60, 14, 0, Math.PI * 2); c.fill();
  });
  makeCanvasTex(scene, 'bsod', 180, 540, c => {
    c.fillStyle = '#0000aa'; c.fillRect(0, 0, 180, 540);
    c.fillStyle = '#aaaaaa'; c.fillRect(40, 150, 100, 18); c.fillStyle = '#0000aa'; c.font = 'bold 14px monospace'; c.fillText('Windows', 58, 164);
    c.fillStyle = '#fff'; c.font = '12px monospace';
    ['A fatal exception', '0E has occurred', 'at 0028:C0011E36', '', 'Press any key to', 'terminate the', 'current application.', '', 'Press CTRL+ALT+DEL', 'to restart.'].forEach((t, i) => c.fillText(t, 8, 200 + i * 16));
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, 4, 540); c.fillRect(176, 0, 4, 540);
  });
  makeCanvasTex(scene, 'lightpillar', 160, 540, c => {
    const g = c.createLinearGradient(0, 0, 160, 0);
    g.addColorStop(0, 'rgba(255,250,180,0)'); g.addColorStop(0.3, 'rgba(255,250,200,0.8)'); g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,250,200,0.8)'); g.addColorStop(1, 'rgba(255,250,180,0)');
    c.fillStyle = g; c.fillRect(0, 0, 160, 540);
    c.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(20 + Math.random() * 120, Math.random() * 540, 1 + Math.random() * 2, 0, Math.PI * 2); c.fill(); }
  });
  makeCanvasTex(scene, 'bolt', 30, 60, c => {
    c.strokeStyle = '#bfe8ff'; c.lineWidth = 4; c.shadowColor = '#4ab0ff'; c.shadowBlur = 8; c.beginPath();
    c.moveTo(18, 0); c.lineTo(8, 26); c.lineTo(20, 28); c.lineTo(10, 60); c.stroke();
  });
  // touch controls
  makeCanvasTex(scene, 'tc_base', 180, 180, c => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(90, 90, 86, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 4; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.5)';
    [[90, 14, 0], [166, 90, 1], [90, 166, 2], [14, 90, 3]].forEach(([x, y, r]) => { c.save(); c.translate(x, y); c.rotate(r * Math.PI / 2); c.beginPath(); c.moveTo(0, -2); c.lineTo(12, 14); c.lineTo(-12, 14); c.closePath(); c.fill(); c.restore(); });
  });
  makeCanvasTex(scene, 'tc_knob', 80, 80, c => {
    const g = c.createRadialGradient(32, 30, 4, 40, 40, 38); g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(180,190,210,0.6)');
    c.fillStyle = g; c.beginPath(); c.arc(40, 40, 36, 0, Math.PI * 2); c.fill();
  });
  makeCanvasTex(scene, 'tc_btn', 100, 100, c => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.arc(50, 50, 46, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 4; c.stroke();
  });
}

// ---- 旺角 extras: projectiles + Wong Kar-wai style overlays ----
function generateMkTextures(scene) {
  const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  makeCanvasTex(scene, 'ink', 64, 48, c => {
    c.fillStyle = '#0a0a14';
    for (let i = 0; i < 9; i++) circle(c, 18 + Math.random() * 30, 14 + Math.random() * 20, 6 + Math.random() * 9);
    c.fillRect(2, 22, 30, 5); c.fillStyle = 'rgba(160,170,255,0.5)'; circle(c, 40, 18, 4);
  });
  makeCanvasTex(scene, 'puddle', 160, 32, c => {
    const g = c.createRadialGradient(80, 16, 4, 80, 16, 80); g.addColorStop(0, 'rgba(10,8,30,0.95)'); g.addColorStop(0.7, 'rgba(20,16,50,0.8)'); g.addColorStop(1, 'rgba(20,16,50,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(80, 16, 80, 15, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(140,120,255,0.35)'; c.beginPath(); c.ellipse(60, 12, 22, 4, 0, 0, Math.PI * 2); c.fill();
  });
  makeCanvasTex(scene, 'disc', 44, 44, c => {
    const g = c.createLinearGradient(0, 0, 44, 44); g.addColorStop(0, '#e8f4ff'); g.addColorStop(0.3, '#ff9ad8'); g.addColorStop(0.6, '#9cf0ff'); g.addColorStop(1, '#ffe14a');
    c.fillStyle = g; circle(c, 22, 22, 20); c.fillStyle = '#20242c'; circle(c, 22, 22, 5);
  });
  makeCanvasTex(scene, 'coin', 26, 26, c => {
    c.fillStyle = '#c89a20'; circle(c, 13, 13, 12); c.fillStyle = '#ffe14a'; circle(c, 13, 13, 10);
    c.fillStyle = '#c89a20'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('$', 13, 18);
  });
  makeCanvasTex(scene, 'sim', 28, 20, c => {
    c.fillStyle = '#f4f4f4'; c.beginPath(); c.moveTo(0, 0); c.lineTo(22, 0); c.lineTo(28, 6); c.lineTo(28, 20); c.lineTo(0, 20); c.closePath(); c.fill();
    c.fillStyle = '#e0b040'; c.fillRect(6, 5, 12, 10); c.strokeStyle = '#806010'; c.strokeRect(6, 5, 12, 10);
  });
  makeCanvasTex(scene, 'fire', 70, 50, c => {
    const g = c.createRadialGradient(40, 28, 2, 36, 26, 34); g.addColorStop(0, '#fff8c0'); g.addColorStop(0.35, '#ffb020'); g.addColorStop(0.7, '#ff4010'); g.addColorStop(1, 'rgba(255,40,0,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(70, 26); c.quadraticCurveTo(40, -4, 6, 14); c.quadraticCurveTo(22, 26, 2, 36); c.quadraticCurveTo(40, 56, 70, 26); c.fill();
  });
  makeCanvasTex(scene, 'clock', 50, 50, c => {
    c.fillStyle = '#e8f8ff'; circle(c, 25, 25, 22); c.strokeStyle = '#2a6a8a'; c.lineWidth = 3; c.beginPath(); c.arc(25, 25, 22, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.moveTo(25 + Math.cos(a) * 17, 25 + Math.sin(a) * 17); c.lineTo(25 + Math.cos(a) * 20, 25 + Math.sin(a) * 20); c.stroke(); }
    c.strokeStyle = '#102030'; c.lineWidth = 3; c.beginPath(); c.moveTo(25, 25); c.lineTo(25, 9); c.moveTo(25, 25); c.lineTo(36, 25); c.stroke();
  });
  makeCanvasTex(scene, 'shard', 44, 28, c => {
    const g = c.createLinearGradient(0, 0, 44, 28); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9cf0ff'); g.addColorStop(1, '#ff9ad8');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 14); c.lineTo(30, 0); c.lineTo(44, 12); c.lineTo(26, 28); c.closePath(); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
  });
  makeCanvasTex(scene, 'neonsign', 80, 100, c => {
    c.fillStyle = '#100818'; c.fillRect(4, 4, 72, 92);
    c.strokeStyle = '#ff3aa0'; c.lineWidth = 4; c.shadowColor = '#ff3aa0'; c.shadowBlur = 10; c.strokeRect(8, 8, 64, 84);
    c.fillStyle = '#9cf0ff'; c.shadowColor = '#9cf0ff'; c.font = 'bold 44px ' + FONT_TC; c.textAlign = 'center';
    c.fillText(['押', '茶', '金', '樓'][Math.floor(Math.random() * 4)], 40, 66);
  });
  // stall goods
  makeCanvasTex(scene, 'g_bag', 46, 42, c => { c.fillStyle = '#c0306a'; c.fillRect(4, 14, 38, 26); c.strokeStyle = '#ffe14a'; c.lineWidth = 3; c.beginPath(); c.arc(23, 16, 11, Math.PI, 0); c.stroke(); c.fillStyle = '#ffe14a'; c.fillRect(19, 22, 8, 5); });
  makeCanvasTex(scene, 'g_slipper', 46, 30, c => { c.fillStyle = '#3a8ae8'; c.beginPath(); c.ellipse(23, 18, 21, 10, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f4f4f4'; c.fillRect(14, 8, 18, 6); });
  makeCanvasTex(scene, 'g_hanger', 46, 32, c => { c.strokeStyle = '#e8e8e8'; c.lineWidth = 3; c.beginPath(); c.moveTo(2, 28); c.lineTo(23, 10); c.lineTo(44, 28); c.closePath(); c.stroke(); c.beginPath(); c.arc(23, 6, 4, Math.PI, Math.PI * 2.4); c.stroke(); });
  makeCanvasTex(scene, 'g_tee', 46, 42, c => { c.fillStyle = '#ffd84a'; c.beginPath(); c.moveTo(12, 4); c.lineTo(34, 4); c.lineTo(46, 14); c.lineTo(38, 20); c.lineTo(36, 40); c.lineTo(10, 40); c.lineTo(8, 20); c.lineTo(0, 14); c.closePath(); c.fill(); c.fillStyle = '#c0306a'; c.font = 'bold 12px sans-serif'; c.fillText('$10', 12, 28); });
  // overlays
  makeCanvasTex(scene, 'grain', 256, 256, c => {
    const im = c.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 40; }
    c.putImageData(im, 0, 0);
  });
  makeCanvasTex(scene, 'rainline', 4, 60, c => { const g = c.createLinearGradient(0, 0, 0, 60); g.addColorStop(0, 'rgba(200,240,255,0)'); g.addColorStop(1, 'rgba(200,240,255,0.8)'); c.fillStyle = g; c.fillRect(1, 0, 2, 60); });
  makeCanvasTex(scene, 'vignette', 480, 270, c => {
    const g = c.createRadialGradient(240, 135, 90, 240, 135, 290); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,10,8,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    c.fillStyle = g; c.fillRect(0, 0, 480, 270);
  });
  makeCanvasTex(scene, 'streak', 256, 8, c => { const g = c.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 2, 256, 4); });
}
