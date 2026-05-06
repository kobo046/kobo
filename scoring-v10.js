(function () {
  const tunedBaseK = 0.85;
  const tunedMaxSingleMatchChange = 1.35;
  const scoreDiffWeight = 0.035;

  calculateMatchChange = function (teamAIds, teamBIds, scoreA, scoreB, players) {
    const teamARating = averageRating(teamAIds, players);
    const teamBRating = averageRating(teamBIds, players);
    const expectedA = expectedWinRate(teamARating, teamBRating);
    const actualA = scoreA > scoreB ? 1 : 0;
    const pointDiff = Math.abs(scoreA - scoreB);
    const winnerScore = Math.max(scoreA, scoreB, 1);
    const marginRatio = Math.min(pointDiff / winnerScore, 0.75);
    const marginMultiplier = 1 + marginRatio;
    const scoreDiffA = (scoreA - scoreB) * scoreDiffWeight;
    const rawChangeA = tunedBaseK * marginMultiplier * (actualA - expectedA) + scoreDiffA;
    const changeA = clamp(rawChangeA, -tunedMaxSingleMatchChange, tunedMaxSingleMatchChange);

    return {
      actualA,
      expectedA,
      marginMultiplier,
      scoreDiffA,
      changeA,
      changeB: -changeA
    };
  };

  renderRuleCards = function () {
    byId("ruleCards").innerHTML = `
      <article class="team-card">
        <h3>基本分</h3>
        <p class="meta">每位新選手由 5.00 分開始，最低 0 分，最高 10 分。</p>
        <div class="bar"><span style="width: 50%"></span></div>
        <strong>新手起點：5.00 / 10</strong>
      </article>
      <article class="team-card">
        <h3>得失分修正</h3>
        <p class="meta">每 1 分得失分約影響 0.035 分，所以長期 156:140 會比 153:149 更有優勢。</p>
        <div class="bar"><span style="width: 78%"></span></div>
        <strong>分差會直接影響個人分數</strong>
      </article>
      <article class="team-card">
        <h3>爆冷修正</h3>
        <p class="meta">高分隊輸給低分隊會扣更多；低分隊打贏高分隊會加更多。</p>
        <div class="bar"><span style="width: 86%"></span></div>
        <strong>用類 Elo 預期勝率計算</strong>
      </article>
      <article class="team-card">
        <h3>歷史重算</h3>
        <p class="meta">編輯或刪除舊比賽後，系統會由第一場開始重新計算所有人的分數。</p>
        <div class="bar"><span style="width: 64%"></span></div>
        <strong>修正錯誤更可靠</strong>
      </article>
    `;
  };

  if (typeof renderAll === "function") {
    renderAll();
  }
})();
