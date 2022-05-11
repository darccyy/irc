const readline = require("readline");
const fetch = require("node-fetch");
const app = require("express")();
const net = require("net");
const F = require("fortissimo");

var isHost, IP, log, rl, myName;

async function main() {
  title(true);

  while (true) {
    await askName();
    if (myName) {
      break;
    }
    console.error("You must have a name.");
  }

  while (true) {
    // Host
    if (!(IP = await askIP())) {
      IP = await setLocalIP();

      if (await isPortTaken(80)) {
        console.error("Port already in use, joining as client...");
        console.log("IP:", IP);
        await F.sleep(500);
        break;
      } else {
        isHost = true;
        log = [];
        await createHost();
        break;
      }
    }

    // Join
    isHost = false;
    console.log("IP:", IP);
    if (await isValidIP()) {
      console.log("IP:", IP);
      await F.sleep(300);
      break;
    }
  }

  isHost ? get() : getPersistent();
}
main();

// Ask name
function askName() {
  return new Promise(resolve => {
    if (rl) {
      rl.close();
    }
    rl = readline.createInterface(process.stdin, process.stdout);
    rl.question("Name: ", answer => {
      rl.close();
      myName = answer;
      resolve(myName);
    });
  });
}

// Refresh msgs (client)
function getPersistent() {
  get(true);
  setTimeout(getPersistent, 500);
}

// Function check if is host
function checkIfHost() {
  if (!isHost) {
    throw "Your not a host. Something went wrong.";
  }
}

// Get msgs
async function get(checkIfNew) {
  var lines = isHost
    ? getAsHost()
    : await new Promise(resolve => {
        fetch(`http://${IP}/get`)
          .then(res => res.json())
          .then(json => resolve(json))
          .catch(err => {
            throw err;
          });
      });

  lines = lines.slice(-process.stdout.rows + 4); // Max amount from client

  // If log not changed since last get()
  if (checkIfNew && log && lines && formatMsgs(lines) === formatMsgs(log)) {
    return;
  }

  // Remember logs to stop constant refresh (client)
  if (!isHost) {
    log = lines;
  }

  title();
  console.log(lines?.length ? formatMsgs(lines) : "  [no logs]");

  askMessage();
}

// Format message as line
function formatMsgs(lines) {
  return lines.map(i => `  <${i.name}> ${i.msg}`).join("\n");
}

// Get raw msgs (host)
function getAsHost() {
  checkIfHost();
  return log.slice(-100); // Max amount from server
}

// Listen for new msg input
function askMessage() {
  if (rl) {
    rl.close();
  }
  rl = readline.createInterface(process.stdin, process.stdout);
  rl.question("> ", answer => {
    rl.close();
    post(answer);
  });
}

// Post msg
function post(msg) {
  isHost
    ? postAsHost(msg, myName)
    : fetch(`http://${IP}/post?msg=${msg}&name=${myName}`)
        .then(get)
        .catch(err => {
          throw err;
        });
}

// Post msg to log (host)
function postAsHost(msg, name) {
  checkIfHost();
  log.push({ msg, name, time: Date.now() });
  get();
}

// Log title
function title(firstTime) {
  clear(firstTime);
  console.log("======= IRC =======");
  if (!firstTime) {
    console.log(`[ ${IP} ] <${myName}>` + (isHost ? " [HOST]" : ""));
  }
}

// Clear console
function clear(scroll) {
  if (scroll) {
    console.log("\n".repeat(Math.max(0, process.stdout.rows - 1)));
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    return;
  }
  process.stdout.write("\x1Bc");
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
var ipTimeout;
function isValidIP() {
  return new Promise(async resolve => {
    console.log("Checking IP...");

    if (
      !IP ||
      IP.split(".").length !== 4 ||
      IP.split(".").filter(i => i < 0 && i > 255).length
    ) {
      await F.sleep(100);
      console.error("Incorrect IP format. Try again.");
      resolve(false);
      return;
    }

    Promise.race([
      fetch(`http://${IP}`),
      new Promise(timeout => {
        clearTimeout(ipTimeout);
        ipTimeout = setTimeout(timeout, 3000, { timeout: true });
      }),
    ])
      .then(async res => {
        clearTimeout(ipTimeout);
        if (res.timeout) {
          console.error("Timeout. Try again.");
          resolve(false);
          return;
        }

        if (res.status === 200 && res.headers.get("is-irc") == "true") {
          resolve(true);
          return;
        }

        console.error("Invalid response status or header. Try again.");
        resolve(false);
      })
      .catch(async err => {
        console.log(err);
        clearTimeout(ipTimeout);
        await F.sleep(1000);
        console.error("Invalid IP. Try again.");
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
      res.header("is-irc", true);
      res.status(200).send("Running host!");
    });

    // Get msgs
    app.get("/get", (req, res) => {
      res.status(200).json(getAsHost());
    });

    // Post msg
    app.get("/post", (req, res) => {
      postAsHost(req.query.msg, req.query.name);
      res.sendStatus(200);
    });

    // Listen on default http port on LAN
    app.listen(80, "0.0.0.0", resolve);
  });
}

// Check if host already using that IP and port
function isPortTaken(port) {
  return new Promise(resolve => {
    var tester = net
      .createServer()
      .once("error", function (err) {
        if (err.code != "EADDRINUSE") {
          throw err;
        }
        resolve(true);
      })
      .once("listening", function () {
        tester
          .once("close", function () {
            resolve(false);
          })
          .close();
      })
      .listen(80, "0.0.0.0");
  });
}
