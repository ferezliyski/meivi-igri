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

  /* The server through which the phones of one room talk to each other (games for several phones).
     Address and public key of this country's Supabase project. While they are empty, rooms cannot be opened.
     For now this is the project of the photo books (meivi-knigi), until the games get a project of their own. */
  rooms: { url: "https://imdtasxsmrxworlsujtr.supabase.co", key: "sb_publishable_KtfFOmZTCT7IU796dK-FCA_o4LA7Fx3" }
};
