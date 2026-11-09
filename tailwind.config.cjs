/** Gera styles.css estático (sem depender de CDN, funciona sem internet na obra). */
module.exports = {
  content: ["./index.html", "./app.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
        display: ['"Sora"', "sans-serif"]
      },
      colors: {
        cr: {
          navy: "#23396B",
          blue: "#4395D8",
          orange: "#FF8C00",
          green: "#16A34A",
          dark: "#0F172A",
          light: "#F8FAFC"
        }
      }
    }
  }
};
