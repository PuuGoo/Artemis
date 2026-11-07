/* Admin Campaign Inspector — read-only, hydrated after existing admin authentication. */
(function () {
  "use strict";
  var root = null, helpers = null;
  var chapters = [], current = null, roomNo = 1, filter = "", requestSeq = 0;
  var rendererPromise = null, animationId = 0, lastFrame = 0, visible = false;
  var fakeGame = null, activeEntities = [], previewBroken = false;
  var cache = Object.create(null);

  function esc(s) { return helpers.esc(s); }
  function num(n) { return helpers.num(n); }
  function asset(s) { return /^\/assets\/map-ch\d+[a-z0-9-]*\.svg$/.test(s || "") ? s : ""; }
  function el(id) { return root && root.querySelector("#" + id); }
  function chapterById(id) { return chapters.find(function(c) { return c.id === Number(id); }); }
  function summaryCard(c) {
    return '<button type="button" class="cc-chapter" data-ch="' + c.id + '" aria-selected="' + (current && current.id === c.id) + '">' +
      '<img class="cc-thumb" loading="lazy" src="' + esc(asset(c.mapAsset)) + '" alt="Bản đồ chương ' + c.id + '">' +
      '<span class="cc-chapter-info"><b>' + esc(c.icon) + " " + esc(c.name) + '</b><small>' +
      esc(c.rooms) + ' phòng • ' + esc(c.difficultyLabel) + '</small></span></button>';
  }
  function renderList() {
    var list = el("ccChapters"); if (!list) return;
    var q = filter.toLocaleLowerCase("vi");
    var shown = chapters.filter(function(c) {
      return !q || (c.name + " " + c.mapRegion + " " + c.bossName + " " + c.id).toLocaleLowerCase("vi").includes(q);
    });
    list.innerHTML = shown.length ? shown.map(summaryCard).join("") : '<p class="cc-caption">Không có chương phù hợp.</p>';
  }
  function initMarkup() {
    root.innerHTML = '<div class="cc-app">' +
      '<div class="cc-heading"><div><h2>🗺️ Thư viện Chiến dịch</h2>' +
      '<p class="cc-caption">Xem dữ liệu thực tế đang dùng trong game • Chỉ đọc, không thay đổi quái, tài khoản hay save.</p></div>' +
      '<div id="ccSummary" class="cc-summary"></div></div>' +
      '<div class="cc-layout"><aside class="cc-sidebar"><label class="cc-caption" for="ccSearch"><b>TÌM CHƯƠNG / BOSS</b></label>' +
      '<input id="ccSearch" type="text" placeholder="Tên chương hoặc boss…" autocomplete="off" />' +
      '<div id="ccChapters" class="cc-chapters"><p class="cc-caption">Đang tải danh sách…</p></div></aside>' +
      '<div class="cc-detail" id="ccDetail"><div class="cc-panel cc-loading">Đang tải dữ liệu chiến dịch…</div></div></div></div>';
    el("ccSearch").addEventListener("input", function(e) { filter = e.target.value.trim(); renderList(); });
    root.addEventListener("click", function(e) {
      var ch=e.target.closest("[data-ch]");
      if(ch) { selectChapter(Number(ch.getAttribute("data-ch")), true); return; }
      var rn=e.target.closest("[data-room]");
      if(rn) { selectRoom(Number(rn.getAttribute("data-room"))); return; }
      var b=e.target.closest("[data-viewroom]");
      if(b) { selectRoom(Number(b.getAttribute("data-viewroom"))); return; }
    });
  }
  function loadSummaries() {
    return helpers.api("/api/admin/campaign").then(function(r) {
      if (!r.data || !r.data.ok || !Array.isArray(r.data.chapters))
        throw new Error((r.data && r.data.error) || "Không tải được danh sách chiến dịch.");
      chapters=r.data.chapters;
      el("ccSummary").innerHTML = '<span class="cc-pill">' + chapters.length + ' chương</span>' +
        '<span class="cc-pill">' + chapters.reduce(function(n,c){return n+c.rooms;},0) + ' phòng</span>' +
        '<span class="cc-pill">🔒 Chỉ quản trị viên</span>';
      var preferred = parseChapterHash() || 1;
      renderList();
      return selectChapter(chapterById(preferred)?preferred:chapters[0].id,false);
    }).catch(function(error) {
      el("ccDetail").innerHTML='<div class="cc-panel cc-error">' + esc(error.message || "Lỗi mạng.") + '</div>';
    });
  }
  function parseChapterHash() {
    var match = location.hash.match(/^#campaign(?:-(\d+))?$/);
    return match ? Number(match[1] || 1) : 0;
  }
  function selectChapter(id, updateHash) {
    if (!chapterById(id)) return Promise.resolve();
    var seq = ++requestSeq;
    current = chapterById(id);
    roomNo = 1; activeEntities = []; previewBroken = false;
    el("ccDetail").innerHTML='<div class="cc-panel cc-loading">Đang nạp Chương ' + id + '…</div>';
    renderList();
    if(updateHash) location.hash="campaign-"+id;
    return (cache[id] ? Promise.resolve(cache[id]) : helpers.api("/api/admin/campaign?chapter="+id).then(function(r) {
      if (!r.data || !r.data.ok || !r.data.chapter) throw new Error((r.data && r.data.error)||"Không tải được chương.");
      cache[id]=r.data.chapter;
      return cache[id];
    })).then(function(detail) {
      if (seq !== requestSeq || !visible) return;
      current = detail;
      renderDetail();
      renderList();
      loadRenderer().then(function() {
        if(seq!==requestSeq || !visible) return;
        buildFakeGame();
        drawScene(performance.now());
        startAnimation();
      }).catch(function(error) {
        var status = el("ccCanvasStatus");
        if(status) status.textContent="Không tải được bản xem trước Canvas; ảnh bản đồ và chỉ số vẫn xem được.";
        console.warn("[Artemis admin] campaign preview unavailable:",error);
      });
    }).catch(function(error) {
      if(seq===requestSeq) el("ccDetail").innerHTML='<div class="cc-panel cc-error">' + esc(error.message||"Không thể tải chương.") + '</div>';
    });
  }
  function renderDetail() {
    var c=current;
    var first=c.roomsDetail[0], last=c.roomsDetail[c.roomsDetail.length-1];
    var banner=asset(c.mapAsset);
    el("ccDetail").innerHTML =
      '<div class="cc-panel"><div class="cc-banner"><img src="'+esc(banner)+'" alt="Ảnh bản đồ '+esc(c.name)+'">' +
      '<div class="cc-banner-text"><span class="cc-pill">CHƯƠNG '+c.id+' • '+c.rooms+' PHÒNG</span>' +
      '<h2>'+esc(c.icon)+' '+esc(c.name)+'</h2><p>'+esc(c.mapTagline||c.desc)+'</p></div></div>' +
      '<p class="cc-help">'+esc(c.desc)+'</p>' +
      '<div class="cc-stats">' +
      stat("HP quái gốc",c.base.mobHp)+stat("ATK quái gốc",c.base.mobAtk)+
      stat("HP boss gốc",c.base.bossHp)+stat("ATK boss gốc",c.base.bossAtk)+
      stat("HP boss cuối",last.boss.hp)+stat("ATK boss cuối",last.boss.atk)+
      stat("Số phòng",c.rooms)+stat("Mở khóa sau chương",c.unlockChapter===null?"Tự do":c.unlockChapter)+'</div>' +
      '<p class="cc-help">Boss thực tế có thể khác tên boss quảng bá tại các phòng 5/10. ATK là sát thương đầu vào trước giảm sát thương của nhân vật.</p></div>' +
      '<div class="cc-panel"><div class="cc-section-head"><h3>🎮 Xem phòng và đấu trường thật</h3>' +
      '<span class="cc-caption" id="ccRoomLabel"></span></div>' +
      '<div id="ccRoomNav" class="cc-room-nav" role="group" aria-label="Chọn phòng"></div>' +
      '<div class="cc-stage"><canvas id="ccArena" width="780" height="420" aria-label="Dựng lại arena chiến dịch từ Canvas trong game"></canvas>' +
      '<div class="cc-stage-note"><span id="ccBiomeName">Arena chiến dịch</span><span id="ccCanvasStatus">Xem trước từ game</span></div></div>' +
      '<p class="cc-help">Hình đấu trường và quái/boss được vẽ bằng cùng mã Canvas của game. Đây là mô phỏng hình ảnh, không khởi chạy chiến đấu.</p>' +
      '<div class="cc-stats" id="ccRoomStats"></div></div>' +
      '<div class="cc-panel"><div class="cc-section-head"><h3 id="ccEntitiesTitle">👾 Quái / Boss của phòng</h3><span class="cc-caption">HP, ATK, tốc độ và số lượng</span></div>' +
      '<div id="ccEntities" class="cc-entities"></div></div>' +
      '<div class="cc-panel"><div class="cc-section-head"><h3>📚 Sinh vật trong chương</h3><span class="cc-caption">Sprite từ game • Thông số mẫu phòng 1</span></div>' +
      '<div id="ccRoster" class="cc-entities"></div><h3 style="font-size:14px;margin:18px 0 10px">👑 Danh sách boss và vị trí</h3>' +
      '<div class="cc-boss-list" id="ccBossList">'+c.bosses.map(function(b){
        return '<button class="cc-boss-row" data-viewroom="'+b.room+'"><span>Phòng '+b.room+': <b>'+esc(b.name)+'</b></span>' +
          '<span class="mono">HP '+num(b.hp)+' • ATK '+num(b.atk)+'</span></button>';
      }).join("")+'</div></div>' +
      '<div class="cc-panel"><div class="cc-section-head"><h3>📋 Bảng chỉ số toàn bộ '+c.rooms+' phòng</h3><span class="cc-caption">Nhấn dòng để xem phòng</span></div>' +
      '<div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Phòng</th><th>Loại</th><th>Số quái</th>' +
      '<th>HP quái nền</th><th>ATK quái nền</th><th>HP boss thực</th><th>ATK boss</th><th>Biome</th></tr></thead>' +
      '<tbody id="ccRoomTable">'+c.roomsDetail.map(function(r){
        return '<tr data-room="'+r.room+'" aria-selected="false"><td><b>'+r.room+'</b></td><td>'+(r.isBoss?'👑 Boss':'👾 Quái')+'</td>' +
        '<td>'+r.count+'</td><td class="mono">'+(r.isBoss?'—':num(r.mobHp))+'</td><td class="mono">'+(r.isBoss?'—':num(r.mobs[0] ? r.mobs[0].atk : r.mobAtk))+'</td>' +
        '<td class="mono">'+(r.isBoss?num(r.boss.hp):'—')+'</td><td class="mono">'+(r.isBoss?num(r.boss.atk):'—')+'</td>' +
        '<td>'+esc(r.biome)+'</td></tr>';
      }).join("")+'</tbody></table></div></div>' +
      '<div class="cc-panel"><h3 style="font-size:14px;margin-bottom:10px">🧮 Công thức tính theo phòng</h3>' +
      '<div class="cc-alert">Chế độ <b>Chiến dịch</b> dùng HP/ATK cố định theo chương và độ sâu của phòng, không nhân trực tiếp lực chiến người chơi. ' +
      'HP quái có hệ số riêng từng loại; ATK quái chia theo căn bậc hai mật độ địch. Phòng boss dùng thông số boss thay cho quái thường.</div>' +
      '<div class="cc-formulas">'+Object.keys(c.formulas).map(function(k){
        return '<div><span class="cc-caption">'+esc(k)+'</span><div class="cc-formula">'+esc(c.formulas[k])+'</div></div>';
      }).join("")+'</div></div>';
    renderRoomNav();
    renderRoster();
    selectRoom(1);
  }
  function stat(label,value) { return '<div class="cc-stat"><small>'+esc(label)+'</small><strong>'+esc(typeof value==="number"?num(value):value)+'</strong></div>'; }
  function renderRoomNav() {
    el("ccRoomNav").innerHTML=current.roomsDetail.map(function(r){
      return '<button class="cc-room '+(r.isBoss?'is-boss':'')+'" data-room="'+r.room+'" aria-pressed="'+(r.room===roomNo)+'" title="'+(r.isBoss?'Boss':'Quái')+' phòng '+r.room+'">'+(r.isBoss?'👑':'')+r.room+'</button>';
    }).join("");
  }
  function entityCard(e,isBoss,uid) {
    return '<article class="cc-entity'+(isBoss?' boss':'')+'"><canvas class="cc-sprite" width="200" height="136" data-sprite="'+esc(uid)+'" aria-label="Hình '+esc(e.name)+' trong game"></canvas>' +
      '<div class="cc-entity-title"><b>'+esc(e.name)+'</b><small>'+(isBoss?'BOSS':('x'+(e.quantity||1)))+'</small></div>' +
      '<div class="cc-kvs"><div class="cc-kv">HP<strong>'+num(e.hp)+'</strong></div><div class="cc-kv">ATK<strong>'+num(e.atk)+'</strong></div>' +
      '<div class="cc-kv">Tốc độ<strong>'+num(e.speed)+'</strong></div><div class="cc-kv">Hệ số HP<strong>x'+(e.hpMultiplier||1)+'</strong></div></div></article>';
  }
  function selectRoom(n) {
    if(!current || !current.roomsDetail) return;
    n=Math.max(1,Math.min(current.rooms,Math.floor(Number(n)||1)));
    roomNo=n;
    var r=current.roomsDetail[n-1];
    el("ccRoomLabel").textContent="Phòng "+n+" / "+current.rooms+(r.isBoss?" • BOSS":" • Quái thường");
    el("ccRoomStats").innerHTML=
      stat("Loại phòng",r.isBoss?"BOSS":"Quái thường")+
      stat("Số đối thủ",r.count)+
      stat("HP "+(r.isBoss?"Boss":"quái nền"),r.isBoss?r.boss.hp:r.mobHp)+
      stat("ATK "+(r.isBoss?"Boss":"mỗi quái"),r.isBoss?r.boss.atk:(r.mobs[0]?r.mobs[0].atk:r.mobAtk));
    el("ccEntitiesTitle").textContent=r.isBoss?"👑 Boss phòng "+n:"👾 Đội hình quái phòng "+n;
    var units=r.isBoss?[r.boss]:r.mobs;
    el("ccEntities").innerHTML=units.map(function(e,i){return entityCard(e,r.isBoss,"room-"+i);}).join("");
    renderRoomNav();
    var rows=el("ccRoomTable");if(rows)rows.querySelectorAll("tr[data-room]").forEach(function(row){
      row.setAttribute("aria-selected",Number(row.getAttribute("data-room"))===n);
    });
    if(fakeGame) buildFakeGame();
    drawScene(performance.now());
  }
  function renderRoster() {
    var first=current.roomsDetail[0];
    var count=first.count;
    el("ccRoster").innerHTML=current.enemyRoster.map(function(e,i) {
      var hp=Math.round(first.mobHp*e.hpMultiplier);
      var atk=Math.max(1,Math.round(first.mobAtk/Math.max(1,Math.sqrt(count/3))));
      return entityCard({...e,hp,atk,quantity:0},false,"roster-"+i);
    }).join("");
  }
  function loadRenderer() {
    if(window.AdminCampaignArenaV2) return Promise.resolve(window.AdminCampaignArenaV2);
    if(rendererPromise) return rendererPromise;
    rendererPromise=new Promise(function(resolve,reject) {
      var script=document.createElement("script");
      script.src="/admin-campaign-renderer.js";
      script.onload=function(){window.AdminCampaignArenaV2?resolve(window.AdminCampaignArenaV2):reject(Error("Không có ArenaV2"));};
      script.onerror=function(){reject(Error("Không tải được mã Canvas của game"));};
      document.head.appendChild(script);
    });
    return rendererPromise;
  }
  function buildFakeGame() {
    var c=current, r=c.roomsDetail[roomNo-1];
    var enemies=r.isBoss?[r.boss]:r.mobs;
    var shown=[];
    if(r.isBoss) {
      shown=[{...r.boss,isBoss:true,x:390,y:172,r:55,zodiacIndex:c.id>=8?c.id-8:-1}];
    } else {
      var types=[];
      for(var i=0;i<r.count;i++)types.push(r.mobs[i%r.mobs.length]);
      shown=types.map(function(e,i){
        return {...e,isBoss:false,x:135+(i%4)*168,y:138+Math.floor(i/4)*105,r:e.radius,
          maxHp:e.hp,hitFlashTimer:0,slowTimer:0,attackTimer:1.5,burnTimer:0,vx:0,vy:0};
      });
    }
    shown.forEach(function(e){e.maxHp=e.hp;e.hitFlashTimer=0;e.slowTimer=0;e.burnTimer=0;e.attackTimer=1.5;e.vx=0;e.vy=0;});
    activeEntities=shown;
    fakeGame={
      chapter:{id:c.id,rooms:c.rooms},room:roomNo,maxRooms:c.rooms,wallPad:36,width:780,height:420,
      floorDecals:[],obstacles:[],wallTorches:[],enemies:shown,
      portalRect:{x:370,y:15,w:40,h:46},portalOpen:false,ultraGfx:false,
      shakeTime:0,shakeMag:0
    };
    window.AdminCampaignArenaV2.init(fakeGame);
  }
  function drawScene(now) {
    if(!visible||!current ||!window.AdminCampaignArenaV2 || previewBroken)return;
    var api=window.AdminCampaignArenaV2, canvas=el("ccArena");
    if(!canvas)return;
    try {
      api.init(fakeGame);
      var ctx=canvas.getContext("2d");
      if(!ctx)throw Error("Canvas 2D không khả dụng");
      ctx.clearRect(0,0,canvas.width,canvas.height);
      api.drawArena(ctx,780,420,36,now,current.id);
      var biome=api._debug.pickBiome();
      el("ccBiomeName").textContent=biome.label||"Đấu trường "+biome.id;
      activeEntities.forEach(function(e){api.drawMonster(ctx,e,now);});
      var room=current.roomsDetail[roomNo-1];
      if(room.isBoss){
        ctx.fillStyle="rgba(5,10,22,.76)";ctx.fillRect(220,305,340,40);
        ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fde68a";
        ctx.font="bold 15px system-ui";ctx.fillText(room.boss.name,390,326);
      }
      drawSprites(now);
    } catch(error) {
      previewBroken=true;
      var st=el("ccCanvasStatus");
      if(st)st.textContent="Lỗi xem trước Canvas";
      console.error("[Artemis admin] drawScene failed",error);
    }
  }
  function drawSprites(now) {
    var api=window.AdminCampaignArenaV2;
    if(!current || !api)return;
    var room=current.roomsDetail[roomNo-1];
    var cards=Array.from(root.querySelectorAll("canvas[data-sprite]"));
    cards.forEach(function(canvas) {
      var id=canvas.getAttribute("data-sprite"), roster=id.startsWith("roster-");
      var idx=Number(id.split("-")[1]);
      var e=roster?current.enemyRoster[idx]:(room.isBoss?room.boss:room.mobs[idx]);
      if(!e)return;
      var b=roster?current.roomsDetail[0].biome:room.biome;
      api._debug.setBiome(b);
      var ctx=canvas.getContext("2d");if(!ctx)return;
      ctx.clearRect(0,0,200,136);
      var enemy={type:e.type,isBoss:!!(room.isBoss&&!roster),x:100,y:73,
        r:room.isBoss&&!roster?33:25,
        hp:e.hp||100,maxHp:e.hp||100,attackTimer:1.5,
        hitFlashTimer:0,slowTimer:0,burnTimer:0,vx:0,vy:0};
      api.drawMonster(ctx,enemy,now);
    });
  }
  function tick(now) {
    animationId=0;
    if(!visible||!root||root.closest(".hidden")||document.hidden)return;
    if(now-lastFrame>120) {lastFrame=now;drawScene(now);}
    animationId=requestAnimationFrame(tick);
  }
  function startAnimation() {
    if(animationId || !visible || !root || root.closest(".hidden") || document.hidden)return;
    animationId=requestAnimationFrame(tick);
  }
  function stopAnimation() {if(animationId)cancelAnimationFrame(animationId);animationId=0;}
  document.addEventListener("visibilitychange",function(){if(document.hidden)stopAnimation();else if(visible)startAnimation();});
  window.AdminCampaignUI = {
    mount:function(container,h) {
      if(!container||!h)return;
      root=container;helpers=h;visible=true;
      initMarkup();
      loadSummaries();
    },
    show:function(){visible=true;startAnimation();},
    syncHash:function(){
      var id=parseChapterHash();
      if(id && chapterById(id) && (!current || current.id!==id)) selectChapter(id,false);
    },
    hide:function(){visible=false;stopAnimation();},
    refresh:function(){cache=Object.create(null);if(root)loadSummaries();}
  };
})();
