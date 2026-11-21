/* Meivi games: settings of this site.
   This is the only file that differs between countries. The same app, put on another address with
   another copy of this file, is the app of another country. */
window.MEIVI = window.MEIVI || {};
MEIVI.config = {
  country: "bg",

  /* Language of the interface and of the games: the folder lang/<lang>/. */
  lang: "bg",

  /* Address of the shop, shown on the result card and in the text people share. */
  site: "meivi.bg",

  /* Which games this site offers. null = every game of the catalogue that has a text file in this
     language. Or a list of ids, for example ["couple", "girls", "party"]. */
  games: null,

  /* The server of this country's games (its own Supabase project, here "meivi-igri-bg"): address and public key.
     The phones of one room talk to each other through it. While they are empty, rooms cannot be opened. */
  rooms: { url: "https://gjmqkvzfoxgihsrliqrn.supabase.co", key: "sb_publishable_1uAy7cRA_0Gxb7HwUYwDIw_Ph0Juxh8" },

  /* Sign-in and ownership. The player signs in with the account of the Shopify store:
     shop = number of the store, client = the id the Headless channel gives for this site,
     server = the function that keeps credits and opened games, store = address of the shop,
     shopPath = where credits and games are sold, gamePath = page of one game ({id} is its id). */
  account: {
    shop: "111310799180",
    client: "17260a06-03bc-4073-be38-bb5af6b68aaa",
    server: "https://gjmqkvzfoxgihsrliqrn.supabase.co/functions/v1/igri",
    store: "https://h1g3z2-7b.myshopify.com",
    shopPath: "/collections/digitalni-igri",
    gamePath: "/products/igra-{id}"
  },

  /* false = every game is open for everyone (the shop is not selling yet).
     true = a game opens only for a player who owns it. */
  locks: false
};
