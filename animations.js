// Presentation only: never rewrite scores, data, storage or sync state.
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const active = new Set();
  const played = new Set();
  // Never animate the clipping hero wrapper across display:none in WebKit.
  // Form headings also animate independently so 44px controls stay put.
  const cards = 'main > section:not(.hero):not(:has(form, input, select, button)), .hero-copy, .hero-visual, main > section > .section-heading, .home-shortcuts > a, .home-leader, .home-result, .mobile-leaderboard-item, .mobile-history-item, .day-card, .player-card, .more-menu > a, .team-card';
  const numbers = '.home-result strong, .home-highlight b, .home-leader b, .mobile-player-rating, .mobile-history-score, .score-pill, .stats-band span';
  let scheduled = 0;
  let routing = false;
  let celebration = null;
  let cleanupTimer = 0;
  const allowed = () => !routing && !reduced.matches && !document.hidden;

  function animate(node, frames, options) {
    if (!allowed() || !node.animate) return;
    const animation = node.animate(frames, options);
    const item = { node, animation };
    active.add(item);
    const clean = () => {
      active.delete(item);
      // Release the effect as well as our reference; never commit transforms.
      animation.cancel();
    };
    animation.onfinish = clean;
    animation.oncancel = () => active.delete(item);
    return animation;
  }

  // IntersectionObserver defers offscreen rows, so long lists stay inexpensive.
  const entrance = new IntersectionObserver((entries) => {
    let order = 0;
    for (const { target: node, isIntersecting } of entries) {
      if (!isIntersecting || !node.getClientRects().length || !allowed()) continue;
      entrance.unobserve(node);
      const number = node.matches(numbers);
      const signature = `${document.body.dataset.page}|${node.id || node.className}|${node.textContent.trim()}`;
      // Identical cloud refreshes should not repeatedly bounce the same content.
      if (played.has(signature)) continue;
      played.add(signature);
      if (played.size > 600) played.delete(played.values().next().value);
      const delay = Math.min(order++ * 38, 228);
      animate(node, number ? [
        { transform: "scale(.88) translateY(5px)" },
        { transform: "scale(1.14) translateY(-3px)", offset: .6 },
        { transform: "scale(1) translateY(0)" }
      ] : [
        { transform: "translateY(14px) scale(.97)", opacity: 0 },
        { transform: "translateY(-2px) scale(1.005)", opacity: 1, offset: .75 },
        { transform: "translateY(0) scale(1)", opacity: 1 }
      ], { duration: number ? 420 : 340, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" });
    }
  }, { threshold: .08 });

  function scan() {
    scheduled = 0;
    for (const item of active) if (!item.node.isConnected) item.animation.cancel();
    if (!allowed()) return;
    document.querySelectorAll(".home-position, .rank").forEach((badge) => {
      const rank = Number(badge.textContent.trim());
      if (rank >= 1 && rank <= 3) badge.dataset.podium = String(rank);
    });
    document.querySelectorAll(`${cards}, ${numbers}`).forEach((node) => {
      if (node.getClientRects().length) entrance.observe(node);
    });
  }

  function schedule() {
    if (!routing && !scheduled) scheduled = requestAnimationFrame(scan);
  }

  function clearCelebration() {
    clearTimeout(cleanupTimer);
    if (!celebration) return;
    for (const item of active) if (celebration.contains(item.node)) item.animation.cancel();
    celebration.remove();
    celebration = null;
  }

  function celebrate() {
    clearCelebration();
    if (!allowed()) return;
    celebration = document.createElement("div");
    celebration.className = "celebration-layer";
    celebration.setAttribute("aria-hidden", "true");
    const colors = ["#b9d99e", "#f2ce70", "#ee9c92", "#9bc9dc"];
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement("span");
      piece.className = `celebration-piece${i % 5 === 0 ? " is-star" : ""}`;
      if (i % 5 === 0) piece.textContent = "✳";
      else piece.style.backgroundColor = colors[i % colors.length];
      celebration.append(piece);
    }
    document.body.append(celebration);
    [...celebration.children].forEach((piece, i) => {
      const x = (i / 23 - .5) * Math.min(innerWidth * .92, 400);
      const rise = 95 + (i % 4) * 24;
      animate(piece, [
        { transform: "translate(0, 20px) rotate(0) scale(.4)", opacity: 0 },
        { transform: `translate(${x * .65}px, ${-rise}px) rotate(${i * 29}deg) scale(1)`, opacity: 1, offset: .4 },
        { transform: `translate(${x}px, 180px) rotate(${i * 57}deg) scale(.7)`, opacity: 0 }
      ], { duration: 1100 + (i % 4) * 90, delay: (i % 6) * 22, easing: "ease-out", fill: "both" });
    });
    cleanupTimer = setTimeout(clearCelebration, 1600);
  }

  document.addEventListener("app:route-start", () => {
    routing = true;
    cancelAnimationFrame(scheduled);
    scheduled = 0;
    for (const item of active) item.animation.cancel();
    active.clear();
    entrance.disconnect();
    played.clear();
  });

  // The shell dispatches only after the shown sections have reflowed and painted.
  document.addEventListener("app:route", () => {
    routing = false;
    schedule();
    const icon = document.querySelector('.mobile-dock a[aria-current="page"] svg');
    if (icon) animate(icon, [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(-7px) scale(1.18) rotate(-9deg)", offset: .45 },
      { transform: "translateY(0) scale(1)" }
    ], { duration: 400, easing: "ease-out" });
  });

  new MutationObserver(schedule).observe(document.querySelector("main"), { childList: true, subtree: true });
  const overlay = document.getElementById("saveConfirmOverlay");
  let wasOpen = false;
  new MutationObserver(() => {
    const open = !overlay.classList.contains("hidden") && !overlay.hidden;
    if (open && !wasOpen) {
      celebrate();
      animate(overlay.querySelector(".save-confirm-icon"), [
        { transform: "rotate(-18deg) scale(.65)" },
        { transform: "rotate(8deg) scale(1.12)", offset: .65 },
        { transform: "rotate(-6deg) scale(1)" }
      ], { duration: 450, easing: "ease-out" });
    }
    if (!open) clearCelebration();
    wasOpen = open;
  }).observe(overlay, { attributes: true, attributeFilter: ["class", "hidden"] });

  function motionChanged() {
    document.body.classList.toggle("motion-paused", document.hidden);
    if (!allowed()) {
      entrance.disconnect();
      for (const item of active) item.animation.cancel();
      clearCelebration();
    } else schedule();
  }
  reduced.addEventListener("change", motionChanged);
  document.addEventListener("visibilitychange", motionChanged);
  schedule();
})();
