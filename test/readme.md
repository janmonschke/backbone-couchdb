# Setup

- Install node.js from [nodejs.org](http://nodejs.org)
- Run `npm install`

# Run the tests

- Start your CouchDB server.
- Check if all information in `server.js` is set correctly four your setup. Look for `TARGET` (the URL of the CouchDB you want to test with), `PORT` (the PORT of that CouchDB instance) and `USERNAME` & `PASSWORD` (if your instance is password protected)
- Run `node server.js`
- Go to [http://localhost:3000/](http://localhost:3000/)

# Write tests

Tests are located in `testrunner/test.js`.