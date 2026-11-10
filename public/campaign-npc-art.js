/* Campaign portrait miniatures. Pure Canvas vectors; no assets or game state. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const INK = '#242039';
  const GOLD = '#e8bd70';
  const PALE = '#fff1c8';
  const THEMES = Object.freeze({
    valkyrie: { light: '#a7ddff', mid: '#497fba', deep: '#203d70', label: 'Valkyrie', prompt: 'Chạm để chọn kỹ năng' },
    angel: { light: '#ffd1dc', mid: '#d57c9c', deep: '#784365', label: 'Thiên thần', prompt: 'Chạm để nhận phước lành' },
    devil: { light: '#ff9b91', mid: '#c84b65', deep: '#522d52', label: 'Ác quỷ', prompt: 'Chạm để lập khế ước' },
    wheel: { light: '#8de8c8', mid: '#2f9c88', deep: '#3c285f', label: 'Thương nhân vận mệnh', prompt: 'Chạm để quay may mắn' }
  });
  function paint(c, fill, stroke, trace, width) {
    c.beginPath(); trace(c);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width || 1; c.stroke(); }
  }
  function oval(c, x, y, rx, ry, fill, stroke, width, angle) {
    paint(c, fill, stroke, function () { c.ellipse(x, y, rx, ry, angle || 0, 0, TAU); }, width);
  }
  function line(c, x, y, x2, y2, color, width) {
    paint(c, null, color, function () { c.moveTo(x, y); c.lineTo(x2, y2); }, width);
  }
  function gem(c, x, y, r, color) {
    paint(c, color, GOLD, function () {
      c.moveTo(x, y-r); c.lineTo(x+r*.67, y); c.lineTo(x, y+r);
      c.lineTo(x-r*.67, y); c.closePath();
    }, .8);
    line(c, x, y-r*.65, x-r*.3, y, '#ffffff', .7);
  }
  function metal(c, low, top, bottom, y1, y2) {
    if (low) return top;
    const g = c.createLinearGradient(-16, y1, 19, y2);
    g.addColorStop(0, top); g.addColorStop(.46, '#fff3d4');
    g.addColorStop(.58, top); g.addColorStop(1, bottom); return g;
  }
  function cloth(c, low, top, bottom, y1, y2) {
    if (low) return top;
    const g = c.createLinearGradient(-16, y1, 21, y2);
    g.addColorStop(0, top); g.addColorStop(1, bottom); return g;
  }
  function sparkle(c, x, y, r, color) {
    paint(c, color, null, function () {
      c.moveTo(x, y-r); c.quadraticCurveTo(x+.5, y-.5, x+r, y);
      c.quadraticCurveTo(x+.5, y+.5, x, y+r);
      c.quadraticCurveTo(x-.5, y+.5, x-r, y);
      c.quadraticCurveTo(x-.5, y-.5, x, y-r); c.closePath();
    });
  }
  function featherWing(c, side, angel, flutter, low) {
    c.save();
    try {
      c.scale(side, 1); c.rotate(flutter);
      paint(c, cloth(c, low, '#fffae9', angel ? '#dab8cb' : '#8da6c4', -40, 16), '#8c8191', function () {
        c.moveTo(10, -13); c.bezierCurveTo(16, -31, 30, -35, 43, -46);
        c.bezierCurveTo(44, -32, 40, -12, 29, 0);
        c.bezierCurveTo(20, 10, 12, 12, 9, 8); c.closePath();
      }, 1.1);
      // Individually articulated overlapping flight feathers, not a flat fan.
      for (let i=0; i<6; i++) {
        const x = 39-i*3.7, y = -39+i*5.5;
        paint(c, i%2 ? '#f8f2e7' : '#fffbed', '#b5a5b1', function () {
          c.moveTo(15, -9+i*2); c.quadraticCurveTo(x-8, y+4, x, y);
          c.quadraticCurveTo(x+2, y+10, x-9, y+18);
          c.quadraticCurveTo(19, 13, 15, -9+i*2); c.closePath();
        }, .65);
      }
      paint(c, angel ? '#fff4e7' : '#dce9f5', '#b5a5b1', function () {
        c.moveTo(11, 4); c.bezierCurveTo(11, -9, 21, -22, 33, -25);
        c.bezierCurveTo(27, -13, 21, -7, 19, 3); c.closePath();
      }, .8);
    } finally { c.restore(); }
  }
  function batWing(c, side, flutter, low) {
    c.save();
    try {
      c.scale(side, 1); c.rotate(flutter);
      paint(c, cloth(c, low, '#933451', '#352238', -31, 12), '#e88b85', function () {
        c.moveTo(10, 2); c.bezierCurveTo(14, -19, 23, -35, 41, -39);
        c.lineTo(39, -17); c.quadraticCurveTo(31, -23, 29, -7);
        c.quadraticCurveTo(23, -14, 21, 5); c.quadraticCurveTo(15, 0, 10, 12); c.closePath();
      }, 1.2);
      line(c, 13, 2, 39, -37, '#e68d8a', .8);
      line(c, 17, -5, 29, -8, '#b55b73', .8);
      line(c, 23, -14, 39, -18, '#b55b73', .8);
      gem(c, 40, -38, 2.5, '#f3c583');
    } finally { c.restore(); }
  }
  function boots(c, dark) {
    for (let s=-1; s<=1; s+=2) {
      paint(c, dark, INK, function () {
        c.moveTo(s*3, 14); c.lineTo(s*11, 14); c.lineTo(s*12, 24);
        c.quadraticCurveTo(s*18, 25, s*15, 28); c.lineTo(s*3, 28); c.closePath();
      }, 1.1);
      line(c, s*5, 24, s*12, 24, GOLD, 1);
    }
  }
  function face(c, kind, low, t) {
    const devil = kind === 'devil', merchant = kind === 'wheel';
    const hair = devil ? '#242232' : merchant ? '#352835' : kind === 'angel' ? '#e9b6ae' : '#e3d3ab';
    oval(c, 0, -27, 14.8, 17, hair, INK, 1.1);
    paint(c, cloth(c, low, devil ? '#f8c9bc' : '#ffe7ce', '#e2a18f', -39, -14), '#a76c6b', function () {
      c.moveTo(-11, -33); c.quadraticCurveTo(-13, -18, -6, -14);
      c.quadraticCurveTo(0, -10, 7, -15); c.quadraticCurveTo(14, -21, 11, -34);
      c.quadraticCurveTo(0, -42, -11, -33); c.closePath();
    }, .8);
    oval(c, -11.7, -24, 2, 3, '#f3b9a7'); oval(c, 11.7, -24, 2, 3, '#f3b9a7');
    // Swept fringe frames the face while leaving the brows and eyes readable.
    paint(c, hair, devil ? '#65516c' : '#ac8383', function () {
      c.moveTo(-13, -25); c.bezierCurveTo(-15, -39, -6, -44, 4, -41);
      c.bezierCurveTo(12, -41, 16, -33, 12, -25);
      c.lineTo(8, -33); c.quadraticCurveTo(0, -31, -1, -37);
      c.quadraticCurveTo(-4, -29, -10, -30); c.closePath();
    }, .8);
    const blink = !low && Math.sin(t*.73) > .995;
    for (let s=-1; s<=1; s+=2) {
      const x = s*5.1;
      if (blink) line(c, x-2, -24, x+2, -24, '#533847', 1.2);
      else {
        oval(c, x, -24.1, 2.1, 3, '#fff9ee');
        oval(c, x+s*.3, -24, 1.35, 2.4, devil ? '#b84357' : merchant ? '#48968c' : '#4e7194');
        oval(c, x+s*.4, -24.2, .72, 1.6, '#302a43');
        oval(c, x-.5, -25.3, .6, .75, '#fffdf4');
        paint(c, null, '#533847', function () { c.moveTo(x-2.4, -25.7); c.quadraticCurveTo(x, -27.3, x+2.4, -25.5); }, .8);
      }
      line(c, x-1.8, -29, x+1.4, -29.4, hair, .8);
      oval(c, s*8.1, -19.8, 2.5, 1.05, '#edaaab');
    }
    paint(c, null, '#a65a6a', function () { c.moveTo(-2.1, -17); c.quadraticCurveTo(.1, -15.2, 2.4, -17.4); }, .8);
    line(c, .2, -22, -.4, -20.2, '#c78c81', .6);
    if (merchant) {
      paint(c, '#45303c', null, function () {
        c.moveTo(-5, -17.6); c.quadraticCurveTo(-1, -20, 0, -17.9);
        c.quadraticCurveTo(2, -20, 5, -17.6); c.quadraticCurveTo(2, -16, 0, -17);
        c.quadraticCurveTo(-3, -16, -5, -17.6); c.closePath();
      });
    }
  }
  function warrior(c, low, t) {
    const silver = metal(c, low, '#dce9f7', '#6b7f9f', -23, 21);
    featherWing(c, -1, false, Math.sin(t)*.025, low); featherWing(c, 1, false, -Math.sin(t)*.025, low);
    paint(c, cloth(c, low, '#4e8bc6', '#1d345e', -20, 25), GOLD, function () {
      c.moveTo(-12, -18); c.quadraticCurveTo(-22, -2, -23, 25);
      c.quadraticCurveTo(-10, 18, -1, 27); c.quadraticCurveTo(12, 19, 23, 24);
      c.quadraticCurveTo(20, 0, 12, -18); c.closePath();
    }, 1.1);
    boots(c, '#344460');
    paint(c, silver, '#5e6b86', function () {
      c.moveTo(-11, -15); c.quadraticCurveTo(0, -22, 11, -15); c.lineTo(9, 3);
      c.lineTo(17, 17); c.quadraticCurveTo(0, 23, -17, 17); c.lineTo(-9, 3); c.closePath();
    }, 1.2);
    for (let s=-1; s<=1; s+=2) {
      line(c, s*4, 6, s*7, 18, '#8295ad', 1);
      oval(c, s*13, -11, 6.5, 4.5, silver, GOLD, 1);
      oval(c, s*16, 0, 4, 7, silver, '#5e6b86', .8, s*-.2);
      oval(c, s*17, 7, 3, 3.5, '#ffe1c1', '#ba8580', .8);
    }
    line(c, -9, 3, 9, 3, GOLD, 3); gem(c, 0, 3, 3, '#409ee3');
    paint(c, null, GOLD, function () { c.moveTo(-8, -11); c.quadraticCurveTo(0, -4, 8, -11); }, 1.2);
    face(c, 'valkyrie', low, t);
    paint(c, silver, '#7c879b', function () {
      c.moveTo(-13, -34); c.lineTo(-12, -42); c.quadraticCurveTo(0, -51, 12, -42);
      c.lineTo(13, -34); c.lineTo(5, -37); c.lineTo(0, -32); c.lineTo(-5, -37); c.closePath();
    }, 1);
    line(c, -11, -39, 11, -39, GOLD, 1.2); gem(c, 0, -40, 3.6, '#4badeb');
    for (let s=-1; s<=1; s+=2) {
      paint(c, '#edf5fc', GOLD, function () {
        c.moveTo(s*11, -39); c.quadraticCurveTo(s*17, -41, s*20, -50);
        c.lineTo(s*21, -41); c.lineTo(s*18, -37); c.lineTo(s*13, -34); c.closePath();
      }, .8);
    }
    line(c, 29, -44, 25, 27, '#48374a', 3.6); line(c, 29, -44, 25, 27, GOLD, 1.6);
    paint(c, silver, GOLD, function () { c.moveTo(29, -58); c.lineTo(34, -44); c.lineTo(28.5, -39); c.lineTo(24, -45); c.closePath(); }, 1);
    line(c, 29, -54, 28.5, -41, '#ffffff', .8);
    paint(c, '#6eb7e9', GOLD, function () { c.moveTo(28, -37); c.quadraticCurveTo(36, -32, 37, -23); c.lineTo(29, -28); c.closePath(); }, .6);
    oval(c, 26.8, 4, 3, 3.4, '#ffe1c1', '#ba8580', .7);
  }
  function healer(c, low, t) {
    featherWing(c, -1, true, Math.sin(t*.8)*.035, low); featherWing(c, 1, true, -Math.sin(t*.8)*.035, low);
    boots(c, '#b88499');
    paint(c, cloth(c, low, '#fff7e8', '#d9b9c8', -18, 26), '#b48b9d', function () {
      c.moveTo(-9, -18); c.quadraticCurveTo(0, -22, 9, -18);
      c.bezierCurveTo(9, 2, 15, 13, 19, 24); c.quadraticCurveTo(0, 31, -19, 24);
      c.bezierCurveTo(-15, 10, -9, 1, -9, -18); c.closePath();
    }, 1);
    for (let s=-1; s<=1; s+=2) {
      paint(c, '#f4bfcd', GOLD, function () {
        c.moveTo(s*6, -14); c.quadraticCurveTo(s*9, 5, s*13, 22);
        c.lineTo(s*5, 25); c.lineTo(s*2, -11); c.closePath();
      }, .7);
      paint(c, '#fff4e4', '#b48b9d', function () {
        c.moveTo(s*9, -14); c.quadraticCurveTo(s*18, -9, s*18, 3);
        c.lineTo(s*11, 5); c.lineTo(s*7, -7); c.closePath();
      }, .9);
      oval(c, s*15, 4, 3, 3, '#ffe1ca', '#bb8b88', .7);
      line(c, s*5, 4, s*9, 21, '#e8d4c4', .7);
    }
    paint(c, null, GOLD, function () { c.moveTo(-15, 23); c.quadraticCurveTo(0, 28, 15, 23); }, 1.2);
    gem(c, 0, -7, 4, '#e590af');
    face(c, 'angel', low, t);
    paint(c, '#fff0dd', GOLD, function () {
      c.moveTo(-14, -34); c.quadraticCurveTo(-15, -43, -5, -44); c.lineTo(0, -47);
      c.lineTo(5, -44); c.quadraticCurveTo(15, -43, 14, -34);
      c.quadraticCurveTo(0, -39, -14, -34); c.closePath();
    }, .9);
    gem(c, 0, -40, 3, '#eaa4bd');
    oval(c, 0, -55, 15, 4, null, '#b18c69', 3);
    oval(c, 0, -55.7, 15, 4, null, '#ffe8ab', 1.4);
    sparkle(c, -10, -56, 2, '#fffbea');
    line(c, 28, -34, 25, 27, '#8c665e', 3); line(c, 28, -34, 25, 27, GOLD, 1.4);
    oval(c, 28, -41, 7, 9, null, GOLD, 2);
    oval(c, 28, -41, 4.5, 6, '#f9cedd', '#fff7e2', .8);
    gem(c, 28, -41, 4, '#e69bb7'); sparkle(c, 28, -50, 3.5, PALE);
    paint(c, null, GOLD, function () { c.moveTo(20, -38); c.quadraticCurveTo(15, -32, 25, -31); c.moveTo(35, -38); c.quadraticCurveTo(39, -32, 30, -31); }, 1);
    oval(c, 26, 4, 3, 3.4, '#ffe1ca', '#bb8b88', .7);
  }
  function noble(c, low, t) {
    batWing(c, -1, Math.sin(t*.9)*.025, low); batWing(c, 1, -Math.sin(t*.9)*.025, low);
    // A curled tail, its spade and garnet lining distinguish the dark silhouette.
    paint(c, null, '#b85b70', function () { c.moveTo(-10, 18); c.bezierCurveTo(-39, 32, -39, 6, -29, 5); }, 3);
    paint(c, '#d16b79', GOLD, function () { c.moveTo(-29, 0); c.lineTo(-24, 7); c.lineTo(-33, 11); c.lineTo(-34, 3); c.closePath(); }, .7);
    boots(c, '#272633');
    paint(c, cloth(c, low, '#76354e', '#281f35', -21, 24), '#d68b7d', function () {
      c.moveTo(-12, -20); c.lineTo(-23, 24); c.lineTo(-7, 20); c.lineTo(0, 26);
      c.lineTo(7, 20); c.lineTo(23, 24); c.lineTo(12, -20); c.closePath();
    }, 1);
    paint(c, cloth(c, low, '#42354c', '#211e30', -15, 20), '#927077', function () {
      c.moveTo(-10, -15); c.lineTo(10, -15); c.lineTo(13, 19); c.lineTo(0, 23); c.lineTo(-13, 19); c.closePath();
    }, 1);
    for (let s=-1; s<=1; s+=2) {
      paint(c, '#c85a6b', GOLD, function () { c.moveTo(s*2, -10); c.lineTo(s*15, -19); c.lineTo(s*10, -2); c.closePath(); }, .8);
      oval(c, s*14, -6, 4.5, 8, '#342839', '#a9767b', .8, s*-.2);
      oval(c, s*17, 3, 3.2, 3.8, '#edb5a8', '#a76671', .7);
      line(c, s*6, 7, s*9, 18, '#ac6a73', .7);
    }
    line(c, -10, 4, 10, 4, GOLD, 1.8); gem(c, 0, 4, 3, '#e66473');
    for (let i=0;i<3;i++) oval(c, 0, 9+i*4, .9, .9, GOLD);
    face(c, 'devil', low, t);
    for (let s=-1;s<=1;s+=2) {
      paint(c, metal(c, low, '#a36175', '#302637', -53, -34), '#e1b18c', function () {
        c.moveTo(s*8, -36); c.bezierCurveTo(s*18, -37, s*21, -49, s*15, -55);
        c.quadraticCurveTo(s*18, -43, s*7, -42); c.closePath();
      }, .9);
    }
    paint(c, '#332737', GOLD, function () { c.moveTo(-9, -38); c.lineTo(-6, -44); c.lineTo(0, -40); c.lineTo(6, -44); c.lineTo(9, -38); c.closePath(); }, .8);
    gem(c, 0, -39, 3, '#e65c75');
    line(c, 29, -40, 27, 27, '#492c3a', 3.5); line(c, 29, -40, 27, 27, GOLD, 1.4);
    paint(c, null, GOLD, function () {
      c.moveTo(29, -54); c.lineTo(29, -33);
      c.moveTo(21, -48); c.quadraticCurveTo(18, -34, 29, -35);
      c.quadraticCurveTo(39, -34, 37, -48);
    }, 2);
    for (let i=0;i<3;i++) {
      const x=21+i*8, y=i===1?-57:-51;
      paint(c, '#e68a87', GOLD, function () { c.moveTo(x, y); c.lineTo(x+2.4, y+6); c.lineTo(x-2.4, y+6); c.closePath(); }, .6);
    }
    gem(c, 29, -34, 3, '#dc526d'); oval(c, 28, 5, 3, 3.4, '#edb5a8', '#a76671', .7);
  }
  function fortuneWheel(c, t, low) {
    c.save();
    try {
      c.translate(24, 6);
      paint(c, '#413050', GOLD, function () { c.moveTo(-8, 10); c.lineTo(-13, 23); c.lineTo(13, 23); c.lineTo(8, 10); c.closePath(); }, 1);
      oval(c, 0, 0, 19.5, 19.5, '#312341', GOLD, 2);
      c.save();
      try {
        c.rotate(low ? 0 : Math.sin(t*.4)*.055);
        for (let i=0;i<8;i++) {
          const a=i*TAU/8;
          paint(c, i%2 ? '#735293' : '#378f80', '#d8b777', function () {
            c.moveTo(0, 0); c.arc(0, 0, 16.5, a, a+TAU/8); c.closePath();
          }, .65);
          const x=Math.cos(a+TAU/16)*12, y=Math.sin(a+TAU/16)*12;
          gem(c, x, y, 2.1, i%2 ? '#edd4fb' : '#b4f3d8');
          oval(c, Math.cos(a)*18.2, Math.sin(a)*18.2, .85, .85, PALE);
        }
      } finally { c.restore(); }
      oval(c, 0, 0, 5.2, 5.2, '#d8a958', '#fff0bd', 1); gem(c, 0, 0, 3.7, '#6cd5b5');
      paint(c, '#ffe3a4', '#8d5e62', function () { c.moveTo(-3, -22); c.lineTo(3, -22); c.lineTo(0, -15); c.closePath(); }, .7);
    } finally { c.restore(); }
  }
  function merchant(c, low, t) {
    boots(c, '#342740');
    paint(c, cloth(c, low, '#65457f', '#30233e', -18, 26), GOLD, function () {
      c.moveTo(-11, -17); c.quadraticCurveTo(-21, 3, -19, 25);
      c.quadraticCurveTo(0, 30, 18, 24); c.quadraticCurveTo(17, 2, 10, -17); c.closePath();
    }, 1);
    paint(c, cloth(c, low, '#48aa92', '#225b60', -15, 24), GOLD, function () {
      c.moveTo(-8, -16); c.lineTo(8, -16); c.lineTo(11, 24); c.quadraticCurveTo(0, 29, -12, 24); c.closePath();
    }, 1);
    for (let s=-1;s<=1;s+=2) {
      paint(c, '#795388', GOLD, function () { c.moveTo(s*8, -15); c.quadraticCurveTo(s*20, -13, s*21, 0); c.lineTo(s*12, 4); c.lineTo(s*5, -7); c.closePath(); }, .9);
      oval(c, s*17, 4, 3.6, 4, '#e9b794', '#a47171', .8);
      line(c, s*8, -10, s*9, 20, GOLD, 1);
      for (let i=0;i<3;i++) gem(c, s*14, 11+i*4.3, 1.6, '#bda2dc');
    }
    line(c, -10, 6, 10, 6, '#d5a365', 3); gem(c, 0, 6, 3.3, '#906fc1');
    paint(c, null, '#eac58a', function () { c.moveTo(-8, -13); c.quadraticCurveTo(0, 3, 8, -13); }, 1.2);
    gem(c, 0, -4, 3.2, '#c2f4d5');
    face(c, 'wheel', low, t);
    // Wrapped turban: nested silk folds, a gold brooch and peacock plume.
    paint(c, cloth(c, low, '#6cc5a7', '#2d6f70', -51, -31), '#e2c07d', function () {
      c.moveTo(-15, -33); c.bezierCurveTo(-22, -53, 4, -57, 15, -44);
      c.quadraticCurveTo(19, -38, 14, -32); c.quadraticCurveTo(0, -37, -15, -33); c.closePath();
    }, 1);
    paint(c, null, '#b3e7c7', function () { c.moveTo(-13, -43); c.quadraticCurveTo(-1, -45, 12, -35); c.moveTo(-9, -49); c.quadraticCurveTo(1, -45, 14, -42); }, 1.5);
    paint(c, '#9270ad', GOLD, function () { c.moveTo(8, -46); c.quadraticCurveTo(7, -60, 18, -60); c.quadraticCurveTo(21, -50, 8, -46); c.closePath(); }, .8);
    line(c, 10, -47, 17, -58, '#e3c78d', .6); gem(c, 1, -39, 5.3, '#ba8dda');
    oval(c, -13, -23, 2.3, 3.4, null, GOLD, 1.3);
    fortuneWheel(c, t, low);
    // The free hand presents a small coin above a velvet purse.
    oval(c, -24, 5, 4.2, 5.2, '#d6a35a', '#ffe5a7', 1); line(c, -24, 2, -24, 8, '#fff1bd', .8);
    paint(c, '#65417c', GOLD, function () { c.moveTo(-23, 14); c.quadraticCurveTo(-33, 28, -19, 27); c.quadraticCurveTo(-10, 27, -18, 14); c.closePath(); }, .9);
    line(c, -24, 16, -17, 16, GOLD, 1.6); gem(c, -21, 22, 2, '#70c9ac');
  }
  function plaque(c, npc, near, theme) {
    const override = near ? npc.prompt : npc.label;
    const text = typeof override === 'string' ? override : near ? theme.prompt : theme.label;
    if (!text) return;
    c.font = (near ? '600 ' : '700 ') + '10px system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const width = Math.max(62, Math.min(210, c.measureText(text).width + 22));
    const x=-width/2, y=37, h=22, r=7;
    paint(c, '#171b2d', near ? GOLD : '#62647e', function () {
      c.moveTo(x+r, y); c.lineTo(x+width-r, y); c.quadraticCurveTo(x+width, y, x+width, y+r);
      c.lineTo(x+width, y+h-r); c.quadraticCurveTo(x+width, y+h, x+width-r, y+h);
      c.lineTo(x+r, y+h); c.quadraticCurveTo(x, y+h, x, y+h-r);
      c.lineTo(x, y+r); c.quadraticCurveTo(x, y, x+r, y); c.closePath();
    }, near ? 1.2 : .8);
    line(c, x+9, y+1.7, x+width-9, y+1.7, '#383b51', .7);
    c.fillStyle = near ? '#fff0bf' : '#ede7e1'; c.fillText(text, 0, 48, width-14);
  }
  /** World-space NPC center; feet stay at y+28. `now` uses the game's millisecond clock. */
  function draw(ctx, npc, now, low, near, kind) {
    if (!Object.prototype.hasOwnProperty.call(THEMES, kind) || !npc ||
        !Number.isFinite(npc.x) || !Number.isFinite(npc.y) || !ctx ||
        typeof ctx.save !== 'function' || typeof ctx.restore !== 'function') return false;
    const theme = THEMES[kind];
    const clock = Number.isFinite(now) ? now % 120000 : 0;
    const t = low ? 0 : clock*.0018;
    ctx.save();
    try {
      ctx.translate(npc.x, npc.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // Floor effects never bob. No blur, additive compositing or offscreen buffers.
      oval(ctx, 0, 28, 29, 6, '#111522');
      oval(ctx, 0, 28, near ? 35 : 29, near ? 8 : 6, near ? '#293641' : '#252a39', near ? theme.light : '#77718a', near ? 1.6 : .8);
      oval(ctx, 0, 28, near ? 30 : 25, near ? 5.5 : 3.8, null, near ? GOLD : theme.mid, .7);
      if (near) {
        for (let i=0;i<4;i++) {
          const a=i*Math.PI/2;
          gem(ctx, Math.cos(a)*34, 28+Math.sin(a)*7, 1.8, theme.light);
        }
      }
      ctx.save();
      try {
        // A breathing upper-body shift is pivoted at the sole, preserving the floor anchor.
        const breath = low ? 1 : 1+Math.sin(t)*.012;
        ctx.translate(0, 28); ctx.scale(1, breath); ctx.translate(0, -28);
        if (kind === 'valkyrie') warrior(ctx, low, t);
        else if (kind === 'angel') healer(ctx, low, t);
        else if (kind === 'devil') noble(ctx, low, t);
        else merchant(ctx, low, t);
        if (!low) {
          for (let i=0; i<4; i++) {
            const phase=t*.55+i*1.77;
            const x=Math.sin(phase)*35, y=-12+Math.cos(phase*.8)*28;
            sparkle(ctx, x, y, 1.2+.8*Math.sin(phase+1), i%2 ? GOLD : theme.light);
          }
        }
      } finally { ctx.restore(); }
      plaque(ctx, npc, near, theme);
      return true;
    } finally { ctx.restore(); }
  }
  root.ArtemisCampaignNPCArt = Object.freeze({ draw: draw });
})(typeof window !== 'undefined' ? window : globalThis);
