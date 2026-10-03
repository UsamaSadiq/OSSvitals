(function () {
  var stored = null;
  try {
    stored = window.localStorage.getItem("ossvitals-theme");
  } catch (e) {}
  var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  var theme = stored === "light" || stored === "dark" ? stored : prefersLight ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", theme);
})();
