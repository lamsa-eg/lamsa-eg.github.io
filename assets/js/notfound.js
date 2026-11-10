// Static hosts (GitHub Pages) have no rewrites: send old /m/<slug> links to memory.html?m=<slug>.
(function () {
  var m = location.pathname.match(/^(.*?)\/m\/(m-[a-f0-9]{16}(?:[a-f0-9]{16})?)\/?$/i);
  if (m) location.replace(m[1] + "/memory.html?m=" + m[2]);
})();
