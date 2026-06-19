// ===== Star Catcher — Full Game =====

(function () {
  'use strict';

  // ----- Screens -----
  var charScreen  = document.getElementById('char-screen');
  var levelScreen = document.getElementById('level-screen');
  var gameScreen  = document.getElementById('game-screen');
  var winScreen   = document.getElementById('win-screen');
  var loseScreen  = document.getElementById('lose-screen');

  var startBtn = document.getElementById('start-btn');
  var backBtn  = document.getElementById('back-btn');
  var leaveBtn = document.getElementById('leave-btn');

  // ----- HUD elements -----
  var scoreDisplay = document.getElementById('score-display');
  var scoreNumEl    = document.getElementById('score-num');
  var timerDisplay  = document.getElementById('timer-display');

  // ----- End-screen elements -----
  var winScoreEl     = document.getElementById('win-score');
  var winPlayAgain   = document.getElementById('win-play-again');
  var winNextLevel   = document.getElementById('win-next-level');
  var loseScoreEl    = document.getElementById('lose-score');
  var losePlayAgain  = document.getElementById('lose-play-again');

  // ----- Game area -----
  var gameArea = document.getElementById('game-area');

  // ----- State -----
  var selectedCharacter = null;
  var selectedLevel     = null;
  var score             = 0;
  var timeLeft          = 30;
  var gameRunning       = false;
  var spawnTimer        = null;
  var clockTimer        = null;
  var activeTargets     = {};   // id -> {element, timeout}
  var nextTargetId      = 0;
  var TARGET_SCORE      = 100;

  // =========================================================================
  // HELPERS
  // =========================================================================
  function swapScreen(fromEl, toEl) {
    fromEl.classList.remove('active');
    fromEl.classList.add('hidden');
    toEl.classList.remove('hidden');
    void toEl.offsetWidth;          // force reflow for fade-in
    toEl.classList.add('active');
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function spawnBurst(x, y) {
    // Create a wrapper div at the click point
    var burst = document.createElement('div');
    burst.className = 'burst';
    burst.style.left = x + 'px';
    burst.style.top  = y + 'px';
    gameArea.appendChild(burst);

    // Expanding ring
    var ring = document.createElement('div');
    ring.className = 'burst-ring';
    burst.appendChild(ring);

    // Coloured particles (6–10)
    var particleCount = rand(6, 10);
    var colors = ['#ff6fd8', '#00e5ff', '#ffb347', '#44dd88', '#fff'];
    for (var i = 0; i < particleCount; i++) {
      var p = document.createElement('div');
      p.className = 'burst-particle';
      p.style.background = colors[rand(0, colors.length - 1)];
      p.style.setProperty('--dx', rand(-40, 40) + 'px');
      p.style.setProperty('--dy', rand(-40, 40) + 'px');
      burst.appendChild(p);
    }

    // Clean up after animation finishes
    setTimeout(function () {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 550);
  }

  // ----- Score animation (brief scale pulse on the number) -----
  function bumpScoreDisplay() {
    scoreDisplay.style.transform = 'scale(1.3)';
    scoreDisplay.style.transition = 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)';
    setTimeout(function () {
      scoreDisplay.style.transform = 'scale(1)';
    }, 150);
  }

  // =========================================================================
  // GAMEPLAY ENGINE
  // =========================================================================

  function startGame() {
    // Reset state
    score    = 0;
    timeLeft = 30;
    gameRunning = true;
    activeTargets = {};
    nextTargetId = 0;

    scoreNumEl.textContent   = '0';
    scoreDisplay.classList.remove('win-pulse');
    timerDisplay.style.color = '';
    timerDisplay.textContent = '30';
    timerDisplay.className   = 'hud-value';

    // Adjust spawn rate per level
    var spawnInterval;
    var targetLifetime;
    if (selectedLevel === '1') {
      spawnInterval  = 1200;   // slower
      targetLifetime = 2200;   // longer
    } else if (selectedLevel === '2') {
      spawnInterval  = 900;
      targetLifetime = 2000;
    } else {
      spawnInterval  = 650;    // faster
      targetLifetime = 1800;   // shorter
    }

    // Start spawning targets
    scheduleSpawn(spawnInterval, targetLifetime);

    // Start countdown clock
    clockTimer = setInterval(function () {
      timeLeft--;
      timerDisplay.textContent = timeLeft;

      // Colour warnings
      timerDisplay.classList.remove('warning', 'danger');
      if (timeLeft <= 5) {
        timerDisplay.classList.add('danger');
      } else if (timeLeft <= 10) {
        timerDisplay.classList.add('warning');
      }

      if (timeLeft <= 0) {
        // Timer ran out — check score to decide win or lose
        if (score >= TARGET_SCORE) {
          gameWon();
        } else {
          gameLost();
        }
      }
    }, 1000);
  }

  function scheduleSpawn(interval, lifetime) {
    spawnTimer = setTimeout(function () {
      if (!gameRunning) return;
      spawnTarget(lifetime);
      scheduleSpawn(interval, lifetime);   // schedule next
    }, interval);
  }

  function spawnTarget(lifetimeMs) {
    if (!gameRunning) return;

    var areaRect = gameArea.getBoundingClientRect();

    // Margins so targets don't clip into HUD / leave button
    var margin = 52;
    var usableW = areaRect.width  - margin * 2;
    var usableH = areaRect.height - margin * 2;

    // Target size depends on level
    var size;
    if (selectedLevel === '1')      size = 64;
    else if (selectedLevel === '2') size = 52;
    else                            size = 44;

    // Random position
    var left = rand(0, Math.max(0, usableW - size));
    var top  = rand(0, Math.max(0, usableH - size));

    // Colour cycles through 4 variants
    var colorIdx = nextTargetId % 4;

    // Create the target element
    var el = document.createElement('div');
    el.className = 'target level-' + selectedLevel + '-target target-color-' + colorIdx;
    el.style.left = (margin + left) + 'px';
    el.style.top  = (margin + top)  + 'px';

    var id = nextTargetId++;

    // Click handler — hit the target!
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!gameRunning) return;
      hitTarget(id, el);
    });

    // ---- MISSING a target (click on empty area) ----
    // Handled below via gameArea listener that checks no target was hit

    gameArea.appendChild(el);

    // Auto-remove after lifetime
    var timeoutId = setTimeout(function () {
      removeTarget(id, false);
    }, lifetimeMs);

    activeTargets[id] = { element: el, timeout: timeoutId };
  }

  function hitTarget(id, el) {
    if (!activeTargets[id]) return;   // already removed

    // Increase score
    score += 10;
    scoreNumEl.textContent = score;
    bumpScoreDisplay();

    // Check win condition
    if (score >= TARGET_SCORE) {
      gameWon();
      return;
    }

    // Burst effect at target center
    var rect = el.getBoundingClientRect();
    var areaRect = gameArea.getBoundingClientRect();
    var cx = rect.left - areaRect.left + rect.width  / 2;
    var cy = rect.top  - areaRect.top  + rect.height / 2;
    spawnBurst(cx, cy);

    // Remove the target
    removeTarget(id, true);
  }

  function removeTarget(id, wasHit) {
    var entry = activeTargets[id];
    if (!entry) return;

    clearTimeout(entry.timeout);

    if (wasHit) {
      // Just remove immediately — burst handles the visual
      if (entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
    } else {
      // Natural timeout — fade out
      entry.element.classList.add('fading');
      setTimeout(function () {
        if (entry.element.parentNode) {
          entry.element.parentNode.removeChild(entry.element);
        }
      }, 260);
    }

    delete activeTargets[id];
  }

  function gameWon() {
    gameRunning = false;

    clearTimeout(spawnTimer);
    clearInterval(clockTimer);
    cleanupTargets();

    // Show win screen with final score
    winScoreEl.textContent = score;
    // Show/hide Next Level button
    var levelNum = parseInt(selectedLevel, 10);
    if (levelNum < 3) {
      winNextLevel.classList.remove('hidden-btn');
    } else {
      winNextLevel.classList.add('hidden-btn');
    }

    swapScreen(gameScreen, winScreen);
  }

  function gameLost() {
    gameRunning = false;

    clearTimeout(spawnTimer);
    clearInterval(clockTimer);
    cleanupTargets();

    // Show lose screen with final score
    loseScoreEl.textContent = score;

    swapScreen(gameScreen, loseScreen);
  }

  function cleanupTargets() {
    var keys = Object.keys(activeTargets);
    for (var i = 0; i < keys.length; i++) {
      var entry = activeTargets[keys[i]];
      clearTimeout(entry.timeout);
      if (entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
    }
    activeTargets = {};
  }

  function cleanupGame() {
    gameRunning = false;
    clearTimeout(spawnTimer);
    clearInterval(clockTimer);
    cleanupTargets();
  }

  // =========================================================================
  // CHARACTER SELECT
  // =========================================================================
  (function () {
    var characters = document.querySelectorAll('#char-screen .character');

    characters.forEach(function (char) {
      char.addEventListener('click', function () {
        characters.forEach(function (c) { c.classList.remove('selected'); });
        char.classList.add('selected');
        selectedCharacter = char.dataset.character;
        startBtn.disabled = false;
      });
    });

    startBtn.addEventListener('click', function () {
      if (!selectedCharacter) return;
      swapScreen(charScreen, levelScreen);
    });
  })();

  // =========================================================================
  // LEVEL SELECT
  // =========================================================================
  (function () {
    var levels = document.querySelectorAll('#level-screen .level');

    levels.forEach(function (lvl) {
      lvl.addEventListener('click', function () {
        levels.forEach(function (l) { l.classList.remove('selected'); });
        lvl.classList.add('selected');
        selectedLevel = lvl.dataset.level;

        // Brief delay so the selection highlight is seen, then launch
        setTimeout(function () {
          swapScreen(levelScreen, gameScreen);
          startGame();
        }, 350);
      });
    });

    backBtn.addEventListener('click', function () {
      levels.forEach(function (l) { l.classList.remove('selected'); });
      selectedLevel = null;
      swapScreen(levelScreen, charScreen);
    });
  })();

  // =========================================================================
  // LEAVE BUTTON
  // =========================================================================
  leaveBtn.addEventListener('click', function () {
    cleanupGame();
    swapScreen(gameScreen, levelScreen);
  });

  // =========================================================================
  // ENDING SCREENS
  // =========================================================================

  function restartSameLevel() {
    swapScreen(winScreen.classList.contains('active') ? winScreen : loseScreen, gameScreen);
    startGame();
  }

  // Win screen: Play Again → same level
  winPlayAgain.addEventListener('click', function () {
    swapScreen(winScreen, gameScreen);
    startGame();
  });

  // Win screen: Next Level → advance
  winNextLevel.addEventListener('click', function () {
    var nextNum = parseInt(selectedLevel, 10) + 1;
    if (nextNum > 3) return;
    selectedLevel = String(nextNum);
    swapScreen(winScreen, gameScreen);
    startGame();
  });

  // Lose screen: Try Again → same level
  losePlayAgain.addEventListener('click', function () {
    swapScreen(loseScreen, gameScreen);
    startGame();
  });

})();
