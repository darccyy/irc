const readline = require("readline");
const fetch = require("node-fetch");
const express = require("express");
const app = express();

var isHost, IP, log, rl;

// Host / join new
async function init() {
  clear();
  writeTitle();

  // Ask and validate IP
  while (true) {
    if ((await askIP()) === null) {
      isHost = true;
      break;
    }
    isHost = false;

    console.log("Checking IP...");
    var isValid = await checkIP();
    if (isValid === true) {
      break;
    }
    console.log(isValid ? "Timeout. Try again." : "IP invalid. Try again.");
  }

  if (isHost) {
    await setupHost();
    await getIP();

    log = [];
    get();
  } else {
    listen();
  }
}
init();

// Console log title
function writeTitle() {
  console.log("=== IRC" + (isHost ? " [HOST]" : "") + " ===");
}

// Get IP from machine
function getIP() {
  return new Promise(resolve => {
    require("dns").lookup(require("os").hostname(), function (err, ip) {
      if (err) {
        throw err;
      }
      IP = ip;
      resolve(IP);
    });
  });
}

// Set IP from user input
function askIP() {
  return new Promise(resolve => {
    rl = readline.createInterface(process.stdin, process.stdout);
    rl.question("IP: (Leave blank to host new) http://", answer => {
      if (!answer) {
        resolve(null);
      } else {
        IP = answer;
        resolve(answer);
      }
      rl.close();
    });
  });
}

// Check if IP is valid
function checkIP() {
  // return new Promise(resolve => {
  //   fetch(`http://${IP}`)
  //     .then(res => resolve(true))
  //     .catch(err => resolve(false));
  // });

  return new Promise(resolve => {
    Promise.race([
      fetch(`http://${IP}`),
      new Promise(timeout => setTimeout(timeout, 2000, { timeout: true })),
    ])
      .then(res => {
        if (res.timeout) {
          resolve(1);
        }
        resolve(true);
      })
      .catch(err => resolve(0));
  });
}

// Listen for msg input, repeat unless quit
async function input() {
  var msg = await new Promise(resolve => {
    if (rl) {
      rl.close();
    }
    rl = readline.createInterface(process.stdin, process.stdout);
    process.stdout.write("> ");

    // Warn on exit
    // rl.on("SIGINT", () => {
    //   rl.question("Are you sure you want to quit? (y) ", answer => {
    //     if (answer.match(/^y(es)?$/i)) {
    //       resolve(true);
    //       rl.close();
    //       return;
    //     }

    //     resolve(false);
    //   });
    // });

    // Message input
    rl.on("line", input => {
      resolve(input);
      rl.close();
    });
  });

  if (msg === true) {
    quit();
  } else if (msg !== false) {
    post(msg);
  }
}

// Listen for new msgs
function listen() {
  get(true);
  listener = setTimeout(listen, 500);
}

// Exit chat
function quit() {
  console.log("End of session :(");
  process.exit();
}

// Get if is host
function getIsHost() {
  if (!isHost) {
    throw "YOUR NOT HOSTING!!!";
  }
  return log.slice(-20);
}

// Post if is host
function postIsHost(msg) {
  if (!isHost) {
    throw "YOUR NOT HOSTING!!!";
  }
  log.push(msg);
  get();
}

// Get messages
async function get(checkIfNew) {
  var newLog = isHost
    ? getIsHost()
    : await new Promise(resolve => {
        fetch(`http://${IP}/get`)
          .then(res => res.json())
          .then(json => resolve(json))
          .catch(err => {
            throw err;
          });
      });

  if (checkIfNew && log && !(newLog?.length !== log.length)) {
    return;
  }

  if (!isHost) {
    log = newLog;
  }

  clear();
  writeTitle();
  console.log(`IP: < ${IP} >`);

  if (!newLog || !newLog.length) {
    console.log("  [no messages]");
  } else {
    newLog.forEach(msg => {
      console.log("  : ", msg);
    });
  }

  input();
}

// Post message
async function post(msg) {
  isHost
    ? postIsHost(msg)
    : fetch(`http://${IP}/post?msg=${msg}`)
        .then(get)
        .catch(err => {
          throw err;
        });
}

// Create server
function setupHost() {
  return new Promise(resolve => {
    // Test message
    app.get("/", (req, res) => {
      res.status(200).send("its-a working !");
    });

    // Chat
    app.get("/get", (req, res) => {
      res.status(200).json(getIsHost());
    });
    app.get("/post", (req, res) => {
      postIsHost(req.query.msg);
      res.sendStatus(200);
    });

    // Listen - default port on LAN
    app.listen(80, "0.0.0.0", resolve);
  });
}

// Clear console (scroll down)
function clear() {
  console.log("\n".repeat(Math.max(0, process.stdout.rows - 1)));
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
}
