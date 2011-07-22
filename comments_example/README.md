#Backbone Couchapp example:

- Install couchapp -> README at [https://github.com/couchapp/couchapp]
- `couchapp generate PROJECTNAME`
- Open the newly generated folder in your favorite editor
- Remove some unnecessary scripts from vendor/ folder and remove them from vendor/couchapp/_attachements/loader.js
- Add new view -> byCollection: Create a new folder in /views called `byCollection` and add a new file `map.js`.
- Add this code to `map.js`:
	function(doc){
		if(doc.collection){
			emit(doc.collection, doc);
		}
	};
- Remove `evently` folder
- Alter information in couchapp.json (if you want to)
- Copy your Backbone App into `/_attachements` (you could also simply take this example app)
- Push the couchapp to your CouchDB: `couchapp push http://user:pw@blahblah.couchone.com/DBNAME`
- Go to the url couchapp just printed out
- Et Voilà, your first backbone-couchapp