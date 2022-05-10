const readline = require("readline");
const fetch = require("node-fetch");
const app = require("express")();

var isHost, IP, log, rl;

async function main() {
  title();

  // Join / host
  while (true) {
    if (!(IP = await askIP())) {
      isHost = true;
      log = [];
      await Promise.all([setLocalIP(), createHost()]);
      break;
    }

    isHost = false;
    console.log("Checking IP...");
    if (await isValidIP()) {
      break;
    }
  }

  title(true);
}
main();

// Log title
function title(withIP) {
  clear();
  console.log("=== IRC" + (isHost ? " [HOST]" : "") + " ===");
  if (withIP) {
    console.log(`< ${IP} >`);
  }
}

// Clear console (scroll)
function clear() {
  console.log("\n".repeat(Math.max(0, process.stdout.rows - 1)));
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
}

// Ask for join IP
function askIP() {
  return new Promise(resolve => {
    rl = readline.createInterface(process.stdin, process.stdout);
    rl.question("IP of Host: (Leave blank to host new) http://", answer => {
      resolve(answer);
      rl.close();
    });
  });
}

// Is IP valid and listening
function isValidIP() {
  return new Promise(resolve => {
    Promise.race([
      fetch(`http://${IP}`),
      new Promise(timeout => setTimeout(timeout, 7000, { timeout: true })),
    ])
      .then(res => {
        if (res.timeout) {
          console.error("Timeout. Try again.");
          resolve(false);
        }

        if (res.status === 200) {
          resolve(true);
        } else {
          throw "Invalid status";
        }
      })
      .catch(err => {
        console.log(err);
        console.error("IP invalid. Try again.");
        resolve(false);
      });
  });
}

// Get and set local IP (if host)
function setLocalIP() {
  return new Promise(resolve => {
    require("dns").lookup(require("os").hostname(), function (err, ip) {
      if (err) {
        throw err;
      }
      resolve((IP = ip));
    });
  });
}

// Create host server
function createHost() {
  return new Promise(resolve => {
    // Check if connected
    app.get("/", (req, res) => {
      res.status(200).send("its-a working !");
    });

    // Get messages
    app.get("/get", (req, res) => {
      res.status(200).json(getFromHost());
    });

    // Post message
    app.post("/post", (req, res) => {
      postFromHost(req.query.msg);
      res.sendStatus(200);
    });

    // Listen on default http port on LAN
    app.listen(80, "0.0.0.0", resolve);
  });
}
