ARTEMIS — triển khai chiến dịch 50 ải

Trạng thái: triển khai core đã kiểm thử; CHƯA đạt toàn bộ tiêu chí cân bằng/phát hành của master prompt.
HEAD gốc: 75df7385b123dcb5df8acee61de402159c9263ed
origin/main được kiểm tra bằng git ls-remote: cùng HEAD.
Không push, merge hoặc deploy. Không truy cập database thật.

Audit source thực tế

Start: public/index.html startNewRun → clearRunState → DungeonSession.begin → getComputedStats → setupRoom(1) → requestAnimationFrame.
Room: setupRoom → isBossRoom → getCampaignTuning khi hasChapters; các mode khác dùng nhánh thích ứng hiện hữu.
Clear: damageEnemy → loại quái chết → roomCleared → portalOpen → overlay → saveCheckpoint → delayed Devil sau boss.
Portal: updateGame xét va chạm portalRect → setupRoom(room+1), hoặc finishRun(true).
Skill: triggerSkillSelection → populateSkillChoices → applyRogueSkill; picker trước thay đổi dùng sort với score ngẫu nhiên, không phải xác suất phẩm chất có trọng số.
EXP: updateDrops → p.level++ → picker, chưa có trần10.
Checkpoint v1: chỉ lưu sau room clear nhưng Continue dựng lại phòng có quái; có nguy cơ nhận lại thưởng. Lưu scalar ATK/HP nhưng thiếu nhiều side effects kỹ năng.
Save: SaveState.save → cloud.js debounce → PUT api/save.js → sanitizeSave → policy transition → revision CAS repository. Không có localStorage checkpoint dự phòng; mất mạng phải nêu rõ giới hạn durability.
Victory: portal cuối → finishRun → record thắng/mở chương, panel chinh phục hiện hữu.
Admin: GET guarded read-only → lib/campaignCatalog duplicate bảng → admin-campaign.js → renderer chung.

Các vấn đề HEAD xác nhận

19 chương, 10/12/15 phòng. Boss theo mốc5. Không có NPC Valkyrie tương tác. Starter/rune cấp kỹ năng trực tiếp; Seraph delayed picker. applyRogueSkill không bảo vệ stack/budget. EXP không giới hạn. Checkpoint server cho level999 và stack20. Gameplay chiến dịch đã có bảng tuyệt đối, phải giữ bản chất không neo chỉ số người chơi.

Phân quyền file / thứ tự triển khai

1. Shared campaign-config: room plan,50rooms,5bosses,9Valkyries; catalog/Admin đọc cùng công thức.
2. campaign-valkyrie: BFS tìm vị trí đi tới được + vector Canvas, không timer riêng.
3. campaign-skills: budget/cap, weighted offers,pity,reroll,normalize; tích hợp tại grant boundary.
4. campaign-exp và simulator: lượng EXP thật từ constructor/drop; mô phỏng giải tích không phải tỷ lệ thắng.
5. Checkpointv2: lưu phòng sạch,event/offer/progression; restore không hồi sinh quái hay apply lại MaxHP.
6. Runtime/UI, hồi quy, syntax và browser fixture khi an toàn tài nguyên.

Bằng chứng sớm

campaign-valkyrie.test.mjs: RED 0pass/3fail (thiếu module), GREEN 3pass/0fail. Kiểm tra hình học/BFS và Canvas spy trong Node VM, chưa phải browser.
campaign-runtime.test.mjs: RED3fail đúng thiếu boss10,grant guard và cleared-room restore; GREEN sau tích hợp.

Kết quả xác minh cuối

Full npm test: 569 tests, 562 PASS, 0 FAIL, 7 SKIP, 66.83 giây. Chạy tuần tự, heap giới hạn, ARTEMIS_ISOLATED_TESTS=0 và TEST_MONGODB_URI rỗng; không kết nối MongoDB thật.
npm run check: 220 files, 6 inline scripts, 0 errors ở lần kiểm gần nhất.
tools/combat-sim.mjs: 37 PASS / 0 FAIL; 6.650 mẫu (7 profile ×19 chương ×50 phòng).
Test boss: 15 PASS; kiểm 95 encounter, 3 mốc HP và chu kỳ bắn, hình học hữu hạn, giữ nhánh mode khác.
Chrome thật với auth/save mock localhost: bắt đầu bằng UI, chọn 1 kỹ năng đầu; clear bằng handler fixture ở các mốc; tương tác vật lý NPC 9 lần, bộ đếm tới10; spawn95boss; portal50 gọi victory, wins1 và mở chương2; errors[]. Không phải thắng chiến đấu tự nhiên hay persistence Mongo.
Evidence: docs/campaign-50-evidence/browser.json, desktop.png, mobile.png, balance-summary.json.

Kỹ năng

Ngân sách10; stack10 hoặc trần riêng; starter chỉ ưu tiên lần đầu; rune mũi tên được đọc như nội tại riêng, rune vòng tròn giữ nội tại đang có; Seraph tăng trọng số Epic/Legend10% và thêm1reroll, không cấp miễn phí. Mỗi encounter1reroll miễn phí, Seraph tối đa2. PityCounter0..4; sau4miss liên tiếp bảo đảm Epic+ nếu pool còn; đầu trận không tính pity. Checkpoint giữ seed/offers/reroll/pity.
500.000 lượt rút có seed: Common/Rare/Epic/Legend theo segment:
0: 65186/26862/6940/1012
1: 55306/29859/11871/2964
2: 48298/29935/16786/4981
3: 43343/29811/19878/6968
4: 38419/29746/23883/7952
1.000 run mô phỏng sau sửa pity: 1.409 Legend, tối đa5/run, 0 vượt ngân sách. Không hard cap Legend ngoài10 lựa chọn; đây chưa chứng minh tổ hợp mạnh đã cân bằng.

Độ khó và phần thưởng hiện hành

Giữ nguyên CAMPAIGN_TUNING gốc. depth=(room-1)/49; HP quái1+1.2depth, ATK quái1+.5depth; HPboss1+.35depth, ATKboss1+.3depth. Không dùng ATK/MaxHP người chơi làm đầu vào campaign. Số quái3/4/5/6/7 theo5segment. Boss phụ10/20/30/40 dùng golem/queen/demon_king/elder_dragon; boss cuối50 theo19chương. Boss cuối đánh dấu riêng, phaseHP>=70%,>=35%,<35%, dùng hình học theo chủ đề và telegraph chung.
EXP thực tế từ 225quái thường+5boss:11.300; greed0 đạtLV10 tại45. Vàng rơi nền6.520 chưa gồm buff và thưởng finish. Không tăng giá nâng cấp/stamina hay can thiệp giao dịch trả tiền.
Simulator1596 dòng/7profile/19chương/12mốc; dữ liệu và tên19boss trong balance-summary.json. Profile là fixture đo sẵn, không đo lại tài khoản hiện tại. Ví dụ profileA DPS350.02: C1room1 tổngHP1005, TTK2.87s; boss10 HP5534/ATK200, TTK15.81s; boss50 HP7020/ATK247, TTK20.06s. Đây là DPS đứng yên giải tích, KHÔNG thời gian combat thực.

Hệ thống giữ nguyên

Auth/quyềnAdmin, tài sản trang bị/tướng/ngọc/thánh vật, transaction shop, chi phí nâng cấp và mode thích ứng. Savev1 vẫn chấp nhận; campaign v2 clamp10/50, không apply lạiMaxHP, restorephòng sạch khôngquái/drop. Migration có cờ campaign50Version để không khóa lại chương cũ và không coi 15ải mới là hoàn thành50ải. Không commit/push/merge/deploy.

Vấn đề còn lại / giới hạn

Critical: chưa phát hiện qua test đã chạy; không có nghĩa đã loại mọi lỗi production.
High: cân bằng mục tiêu chưa đạt/chưa chứng minh. BossC1 giải tích20s dưới mục tiêu60–90s; chưa đo nhiều buildCommon/Rare/Legend và lượngHPcòn. Không tự tăngHP3lần khi chưa playtest. Kinh tế/phút chỉ trần giải tích, chưa là số đo thao tác né/nhặt/menu. Chưa có server-authoritative encounter/reward ledger: cloudflush giảm cửa sổ mất mạng nhưng chưa chứng minh chống rollback/adversarial client. Không bảo đảm durability nếu đóngtrang khi đang offline.
High: chế độ Devil/Angel campaign chưa có thiết kế event phụ hoàn chỉnh; autoDevil cũ sauboss bị thay bằngValkyrie để không phángân sách. Một số quyền lợi DevilPact vì thế cần cân bằng lại trước phát hành.
Medium: boss phụ bốn loại có AIkhác nhưng chưa biến thể riêng theo từngchương; các phòng thường chưa hoàn tất archetype/elite/CC theo5segment. Hệ sốdemon1.15 khiếnHPboss30 cóthểcaohơn40; áp lựcpatternkhác nhưng đườngHPkhôngđơnđiệu.
Medium: màn hình thấtbại giữgợiý cũ, chưa đủtelemetryDPS/run vàtoptưvấn3nguồn theo yêu cầu. UIprogress50pips chưa được xác minh hìnhhọc/touch đầyđủ ởmọi kíchthước mobile; screenshot fixture cóthểchồngbanner do nhảy nhiềuải.
Not tested: Mongo durability thực, serverrevisions quaE2E thật, chơi tựnhiên50ải, RAM/fps dài hạn mobile, thắng/thua nhiềuprofile, offline reload, Admin browser auth thật. 7testskip khôngtínhPASS.
