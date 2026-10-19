// 화면 모드: 기본은 기기 설정을 따르고, 버튼으로 라이트·다크를 직접 고를 수 있다.
// <head>에서 바로 불러서 그리기 전에 적용한다(깜빡임 방지).
(function () {
  var KEY = "wmm.theme", root = document.documentElement;
  var MODES = ["auto", "light", "dark"];
  var LABEL = { auto: "🌗 자동", light: "☀️ 라이트", dark: "🌙 다크" };
  var NAME = { auto: "기기 설정에 맞춤", light: "라이트 모드", dark: "다크 모드" };
  function read() { try { var v = localStorage.getItem(KEY); return MODES.indexOf(v) > 0 ? v : "auto"; } catch (e) { return "auto"; } }
  function write(v) { try { v === "auto" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v); } catch (e) {} }
  var sys = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function apply(mode) {
    if (mode === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", mode);
    var dark = mode === "dark" || (mode === "auto" && sys && sys.matches);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      if (m.dataset.media == null) { m.dataset.media = m.getAttribute("media") || ""; m.dataset.content = m.content; }
      if (mode === "auto") { m.content = m.dataset.content; if (m.dataset.media) m.setAttribute("media", m.dataset.media); }
      else { m.content = dark ? "#111111" : "#ffffff"; m.removeAttribute("media"); }
    }
  }
  var mode = read();
  apply(mode);
  function mount() {
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "theme-btn";
    function paint() { btn.textContent = LABEL[mode]; btn.setAttribute("aria-label", "화면 모드: " + NAME[mode] + " (누르면 바뀜)"); btn.title = NAME[mode]; }
    btn.onclick = function () {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      write(mode); apply(mode); paint();
      try { navigator.sendBeacon && navigator.sendBeacon("/api/stat?e=theme_" + mode); } catch (e) {}
    };
    paint(); apply(mode); // 메타 태그가 이 스크립트보다 뒤에 있을 수 있어 한 번 더
    document.body.appendChild(btn);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
