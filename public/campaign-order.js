/* Artemis campaign order v2: Leo starts the 12 zodiac chapters.
   Safe, idempotent save migration shared by the game and server. */
(function(root){
  'use strict';
  const oldToNew=Object.freeze({
    12: 1,
    8: 2,
    9: 3,
    10: 4,
    11: 5,
    13: 6,
    14: 7,
    15: 8,
    16: 9,
    17: 10,
    18: 11,
    19: 12
  });
  const legacyIds=Object.freeze([12, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19]);
  const zodiac=Object.freeze(['leo', 'aries', 'taurus', 'gemini', 'cancer', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']);
  function migrateSave(raw){
    if(!raw || typeof raw !== 'object' || Array.isArray(raw))return raw;
    if(Number(raw.campaignOrderVersion) >= 2)return raw;
    const move = record => {
      const out={};
      if(!record || typeof record !== 'object' || Array.isArray(record))return out;
      for(const [oldId,newId] of Object.entries(oldToNew)){
        const value=Number(record[oldId]);
        if(Number.isFinite(value) && value>0)out[newId]=value;
      }
      return out;
    };
    const idx=Number(raw.selectedChapterIdx);
    const selected=Number.isInteger(idx) && idx>=0 && idx<=18 ? idx+1 : 1;
    return {
      ...raw,
      campaignOrderVersion:2,
      selectedChapterIdx:(oldToNew[selected] || 1)-1,
      winsByChapter:move(raw.winsByChapter),
      bestRooms:move(raw.bestRooms),
      // Never resume old rooms against a different chapter/boss definition.
      dungeonCheckpoint:null
    };
  }
  root.ArtemisCampaignOrder=Object.freeze({legacyIds,zodiac,oldToNew,migrateSave});
})(globalThis);
