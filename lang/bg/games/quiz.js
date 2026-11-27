/* Meivi games · text of the game "quiz" · Bulgarian
   One quiz with topics: the players choose which topics take part. The first answer is the right one. */
/* The questions are in quiz-data.js, a file loaded when the quiz is opened; until then a topic has none. */
MEIVI.text("quiz", (function () {
  const Q = id => (MEIVI.data["games/quiz-data"] || {})[id] || [];
  return {
  name: "Голямата викторина",
  label: "Викторина",
  desc: "Десет категории и над 500 въпроса. Изберете кои да участват и вижте кой знае най-много.",
  rules: [
    "Преди играта изберете категориите и колко въпроса да има.",
    "Редувате се. Който е на ход, вижда въпрос с четири отговора и избира един.",
    "Верният отговор носи точка. Играта веднага показва кой е верният.",
    "Накрая виждате класирането. Може да играе и само един човек."
  ],
  topics: [
    { id: "geo", name: "География", icon: "🌍", get questions() { return Q("geo"); } },
    { id: "science", name: "Наука", icon: "🔬", get questions() { return Q("science"); } },
    { id: "history", name: "История", icon: "🏛️", get questions() { return Q("history"); } },
    { id: "art", name: "Изкуство", icon: "🎨", get questions() { return Q("art"); } },
    { id: "bg", name: "България", icon: "🇧🇬", get questions() { return Q("bg"); } },
    { id: "cinema", name: "Кино и сериали", icon: "🎬", get questions() { return Q("cinema"); } },
    { id: "music", name: "Българска музика", icon: "🎶", get questions() { return Q("music"); } },
    { id: "football", name: "Футбол", icon: "⚽", get questions() { return Q("football"); } },
    { id: "auto", name: "Автомобили", icon: "🏎️", get questions() { return Q("auto"); } },
    { id: "zodiac", name: "Зодии", icon: "🔮", get questions() { return Q("zodiac"); } }
  ]
};
})());
