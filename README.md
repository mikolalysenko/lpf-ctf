Capture the flag demo
=====================

This is a multiplayer capture the flag game which uses space-time causality (for asynchronous execution) and local perception filters to hide latency.  For more information, see the following blog posts:

* Replication in networked games: [Part 1](http://0fps.net/2014/02/10/replication-in-networked-games-overview-part-1/) [Part 2](http://0fps.net/2014/02/17/replication-in-networked-games-latency-part-2/) [Part 3](http://0fps.net/2014/02/26/replication-in-networked-games-spacetime-consistency-part-3/) [Part 4](http://0fps.net/2014/03/09/replication-in-network-games-bandwidth-part-4/)

## First time set up

#### 1.  Install node.js, npm and git

You can get [node.js here](http://nodejs.org/download/), and this website (github.com) has instructions on how to set up git on various systems.

#### 2.  Clone the repo

Open up a shell and type:

```
git clone https://github.com/mikolalysenko/lpf-ctf
```

#### 3. Install all dependencies

Go into the folder that was just cloned and type:

```
npm install
```

#### 4. Start the server

Again from the same folder, type:

```
npm start
```

#### 5. Open a page to connect to it

Open up a browser tab for `localhost:8080` and you should be good to go.

## Using the software

To play the game, use the arrow keys to move your player and spacebar to shoot.  The shift key slows down time, though using this excessively can cause your client to drop.

To view the history of the game, open the `/visualize.html` file which is hosted by the server.