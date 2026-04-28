/**
 * 工作台背景图库（SVG data URI），供设置页与旧逻辑共用。
 */
(function () {
  'use strict';

  function svgDataUri(svg) {
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  var w = 1920;
  var h = 1080;
  function svg(body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>';
  }
  function grad(id, stops) {
    var s = stops.map(function (x) {
      return '<stop offset="' + x[0] + '" stop-color="' + x[1] + '"/>';
    }).join('');
    return '<defs><linearGradient id="' + id + '" x1="0%" y1="0%" x2="100%" y2="100%">' + s + '</linearGradient></defs><rect width="100%" height="100%" fill="url(#' + id + ')"/>';
  }

  window.WorkbenchBgLibrary = [
    { name: '深蓝夜', url: svgDataUri(svg(grad('g1', [['0%', '#0f0c29'], ['50%', '#302b63'], ['100%', '#24243e']]))) },
    { name: '湖蓝', url: svgDataUri(svg(grad('g2', [['0%', '#2193b0'], ['100%', '#6dd5ed']]))) },
    { name: '灰蓝', url: svgDataUri(svg(grad('g8', [['0%', '#1a1b26'], ['100%', '#414868']]))) }
  ];
})();
