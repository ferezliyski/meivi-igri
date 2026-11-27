/* Meivi games · several phones · text of the game "quiz" · Bulgarian
   The questions are those of the one-phone quiz (lang/bg/games/quiz.js); this file has only the words of the room. */
MEIVI.mtext("quiz", {
  time: "15–50 мин",
  about: "Един и същ въпрос излиза едновременно на телефона на всеки. Верният отговор носи точка, а най-бързият верен отговор – още една.",
  rules: [
    "Преди играта домакинът избира колко въпроса да има: 30, 50 или 100.",
    "Всеки въпрос излиза едновременно на всички телефони. Всеки избира един от четирите отговора.",
    "Грешен отговор носи 0 точки, верен отговор носи 1 точка.",
    "Който отговори вярно най-бързо, взима още 1 бонус точка. Ако само един е отговорил вярно, бонус няма.",
    "След всеки въпрос виждате кой е познал, кой не е и за колко секунди. Накрая виждате класирането."
  ],
  /* the questions: the one-phone quiz, read when the game starts */
  source: () => MEIVI.texts && MEIVI.texts.quiz,
  t: {
    roundsAsk: "Колко въпроса?",
    round: (n, all) => `Въпрос ${n} от ${all}`,
    nextRound: "Следващ въпрос",
    roundsAre: n => `Въпроси: ${n}`,
    hint: "Най-бързият верен отговор взима бонус точка.",
    youRight: "Позна!",
    youWrong: "Не позна",
    youNone: "Без отговор",
    answerIs: answer => `Верният отговор е „${answer}“.`,
    who: "Кой как отговори",
    rowRight: (secs, pts) => `✓ ${secs} с · +${pts}`,
    rowWrong: "✗ · 0",
    noAnswer: "без отговор · 0",
    secs: ms => (ms / 1000).toFixed(1).replace(".", ","),
    fastest: name => `${name} отговори вярно най-бързо и взима бонус точка.`,
    onlyOne: name => `Само ${name} отговори вярно, затова няма бонус за бързина.`,
    nobody: "Никой не отговори вярно.",
    colRight: "Верни"
  }
});
