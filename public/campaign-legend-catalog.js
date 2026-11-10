/* Shared metadata from ROGUE_SKILLS. Never accept a client-supplied devil pool. */
(function(root){
  'use strict';
  root.ArtemisCampaignLegendCatalog=Object.freeze([
    {id:'warriors_soul',name:"Warrior's Soul (Linh Hồn Chiến Binh)",rarity:'legend',providers:['valkyrie','devil']},
    {id:'power_trio',name:'Power Trio (Tam Tuyệt Thần Lực)',rarity:'legend',providers:['valkyrie']},
    {id:'multishot',name:'Multishot (Liên Xạ +1 Loạt Đạn)',rarity:'legend',providers:['valkyrie','devil']},
    {id:'corrosive_field',name:'Corrosive Field (Trường Ăn Mòn +35% DMG)',rarity:'legend',providers:['valkyrie','devil']},
    {id:'energy_beam',name:'Energy Beam (Đại Pháo Tia Laser Xuyên Thấu)',rarity:'legend',providers:['valkyrie','devil']},
    {id:'soul_of_strength',name:'Soul of Strength (Linh Hồn Cường Tráng)',rarity:'legend',providers:['valkyrie']},
    {id:'sacred_protection',name:'Sacred Protection (Khiên Thánh Chặn Đòn)',rarity:'legend',providers:['valkyrie','devil']},
    {id:'sprite_king',name:'Sprite King (Vua Tinh Linh Bắn Laser)',rarity:'legend',providers:['valkyrie','devil']},
    {id:'super_meteor',name:'Super Meteor (Mưa Siêu Thiên Thạch)',rarity:'legend',providers:['valkyrie','devil']},
    {id:'beam_strike',name:'Beam Strike (Phi Kiếm Phóng Tia Laser)',rarity:'legend',providers:['valkyrie','devil']},
    {id:'circle_web',name:'Circle Web (Mạng Lưới Điện Quang Cầu Xoay)',rarity:'legend',providers:['valkyrie','devil']}
  ].map(s=>Object.freeze({...s,providers:Object.freeze(s.providers)})));
})(typeof window!=='undefined'?window:globalThis);
