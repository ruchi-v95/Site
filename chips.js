// 버튼(칩) 줄 공통: 한 줄 가로 스크롤(휴대폰은 밀어서, PC는 휠·끌기) + 오른쪽 '더보기'로 전부 펼치기.
// 오늘 뭐 먹지(app.js)와 오늘 뭐하지(play.js)가 같이 쓴다.
window.OdChips = (() => {
  function row(el) {
    // 줄 오른쪽에 더보기 버튼
    const line = document.createElement("div");
    line.className = "chip-line";
    el.before(line);
    line.append(el);
    const more = document.createElement("button");
    more.type = "button";
    more.className = "chip-more";
    more.setAttribute("aria-expanded", "false");
    more.textContent = "더보기";
    line.append(more);
    const setOpen = (open) => {
      el.classList.toggle("open", open);
      line.classList.toggle("open", open);
      more.setAttribute("aria-expanded", String(open));
      more.textContent = open ? "접기" : "더보기";
      if (!open) el.scrollLeft = 0;
      fade();
    };
    more.onclick = () => setOpen(!el.classList.contains("open"));
    // 펼친 상태에서 하나 고르면 다시 접는다 (결과가 가려지지 않게)
    el.addEventListener("click", (e) => { if (e.target.closest(".chip") && el.classList.contains("open")) setTimeout(() => setOpen(false), 0); });

    function fade() {
      const open = el.classList.contains("open");
      const max = el.scrollWidth - el.clientWidth;
      el.classList.toggle("fade-l", !open && el.scrollLeft > 2);
      el.classList.toggle("fade-r", !open && max - el.scrollLeft > 2);
      more.hidden = !open && max <= 2; // 다 보이면 더보기가 필요 없다
    }
    el.addEventListener("scroll", fade, { passive: true });
    new ResizeObserver(fade).observe(el);
    new MutationObserver(fade).observe(el, { childList: true });

    // PC: 세로 휠을 가로로, 마우스로 끌어서 넘기기
    el.addEventListener("wheel", (e) => {
      if (el.classList.contains("open") || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }, { passive: false });
    let down = null, moved = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || el.classList.contains("open")) return;
      down = { x: e.clientX, left: el.scrollLeft }; moved = false;
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) > 5) { moved = true; el.classList.add("dragging"); }
      if (moved) el.scrollLeft = down.left - dx;
    });
    window.addEventListener("pointerup", () => {
      if (!down) return;
      down = null;
      if (moved) setTimeout(() => el.classList.remove("dragging"), 0);
    });
    // 끌다가 놓은 자리의 칩이 눌리지 않게
    el.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    fade();
    return { setOpen };
  }
  return { row };
})();
