/* Original floating chapter dioramas. Lock treatment belongs to the map UI. */
(function (root) {
  'use strict';
  const assets = Object.freeze({
    1: '/assets/world-map/chapter-01.svg',
    2: '/assets/world-map/chapter-02.svg',
    3: '/assets/world-map/chapter-03.svg',
    4: '/assets/world-map/chapter-04.svg',
    5: '/assets/world-map/chapter-05.svg',
    6: '/assets/world-map/chapter-06.svg',
    7: '/assets/world-map/chapter-07.svg',
    8: '/assets/world-map/chapter-08.svg',
    9: '/assets/world-map/chapter-09.svg',
    10: '/assets/world-map/chapter-10.svg',
    11: '/assets/world-map/chapter-11.svg',
    12: '/assets/world-map/chapter-12.svg',
    13: '/assets/world-map/chapter-13.svg',
    14: '/assets/world-map/chapter-14.svg',
    15: '/assets/world-map/chapter-15.svg',
    16: '/assets/world-map/chapter-16.svg',
    17: '/assets/world-map/chapter-17.svg',
    18: '/assets/world-map/chapter-18.svg',
    19: '/assets/world-map/chapter-19.svg'
  });

  root.ArtemisWorldMapArt = Object.freeze({
    get(chapter) {
      const id = chapter && typeof chapter === 'object' ? chapter.id : chapter;
      return assets[id] || assets[1];
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
