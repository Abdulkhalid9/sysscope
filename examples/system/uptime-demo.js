const os = require("os");
console.log("Hostname:", os.hostname());
console.log("Uptime (s):", Math.round(os.uptime()));